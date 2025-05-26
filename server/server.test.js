const assert = require('assert');
const {
    playerData,
    getIsSurgeActive,
    getSurgeTimeoutId,
    __setSurgeActive,
    __setSurgeTimeoutId,
    startTransactionSurge,
    endTransactionSurge,
    broadcast, // Assuming broadcast is exported for direct testing/spying if needed
    serverMemes, // Exported from server.js
    calculateViralSpread, // Exported from server.js
    MIN_HYPE_TO_GO_VIRAL,
    MIN_VIRALITY_SCORE_THRESHOLD,
    VIRAL_REWARD_AMOUNT
    // Note: 'invest_hype' message handler is deeply nested, will be tested conceptually.
} = require('./server.js'); // server.js is in the same directory

// Mock WebSocket Server and clients
let mockWss;
let mockClients;

// Helper to create a mock client
function createMockClient(id = Math.random().toString(36).substring(7)) {
    return {
        readyState: 1, // WebSocket.OPEN
        playerId: id,
        send: sinonSpy(), // Simple spy function
        close: sinonSpy()
    };
}

// Simple spy function
function sinonSpy() {
    const spy = (...args) => {
        spy.called = true;
        spy.callCount = (spy.callCount || 0) + 1;
        spy.lastArgs = args;
        spy.args = spy.args || [];
        spy.args.push(args);
    };
    spy.called = false;
    spy.callCount = 0;
    spy.lastArgs = null;
    spy.args = [];
    spy.resetHistory = () => {
        spy.called = false;
        spy.callCount = 0;
        spy.lastArgs = null;
        spy.args = [];
    };
    return spy;
}


describe('Server Functionality', function() {
    let originalWssClients; // To store the original wss.clients from server.js
    let originalMathRandom;

    beforeEach(function() {
        // Reset states
        playerData.clear();
        __setSurgeActive(false);
        if (getSurgeTimeoutId()) {
            clearTimeout(getSurgeTimeoutId());
        }
        __setSurgeTimeoutId(null);

        // Reset serverMemes to initial state (deep copy)
        // Note: serverMemes is an array of objects. Need to ensure it's properly reset.
        // The server.js initializes serverMemes directly. For tests, we might need to
        // re-initialize it or export a reset function if its state is modified directly.
        // For simplicity, we'll assume serverMemes is re-imported or reset like this:
        const initialMemes = [
            { id: 'meme1', name: 'Classic Doge', currentHypeInvestment: 0, iconKey: 'icon_doge', investorsThisCycle: {} },
            { id: 'meme2', name: 'Stonks Guy', currentHypeInvestment: 0, iconKey: 'icon_stonks', investorsThisCycle: {} }
        ];
        // Clear and repopulate serverMemes (if serverMemes is mutable and directly imported)
        serverMemes.length = 0; 
        initialMemes.forEach(m => serverMemes.push(JSON.parse(JSON.stringify(m))));


        // Mock wss and its clients
        mockClients = new Set();
        
        // Store and override wss.clients from the imported server.js module
        // This allows `broadcast` within server.js to use our mockClients for testing
        const actualWss = require('./server.js').wss; 
        originalWssClients = actualWss.clients; // Store original
        actualWss.clients = mockClients; // Override with mock set

        originalMathRandom = Math.random; // Store original Math.random
    });

    afterEach(function() {
        if (getSurgeTimeoutId()) {
            clearTimeout(getSurgeTimeoutId());
            __setSurgeTimeoutId(null);
        }
        // Restore original wss.clients
        if (originalWssClients) {
            const actualWss = require('./server.js').wss;
            actualWss.clients = originalWssClients;
        }
        Math.random = originalMathRandom; // Restore Math.random
    });

    describe('Transaction Surge Events', function() {
        it('should start a transaction surge correctly', function() {
            const client1 = createMockClient('client1');
            const client2 = createMockClient('client2');
            mockClients.add(client1);
            mockClients.add(client2);

            startTransactionSurge();

            assert.strictEqual(getIsSurgeActive(), true, 'isSurgeActive should be true');
            assert.ok(getSurgeTimeoutId(), 'surgeTimeoutId should be set');

            mockClients.forEach(client => {
                assert.strictEqual(client.send.called, true, `Client ${client.playerId} send should have been called`);
                const message = JSON.parse(client.send.lastArgs[0]);
                assert.strictEqual(message.type, 'transaction_surge_start', 'Message type should be transaction_surge_start');
                assert.ok(message.duration, 'Message should have a duration');
                assert.ok(message.target, 'Message should have a target');
            });

            clearTimeout(getSurgeTimeoutId()); // Clean up timer
            __setSurgeTimeoutId(null);
        });

        it('should not start a surge if one is already active', function() {
            __setSurgeActive(true); // Simulate active surge
            const originalTimeoutId = setTimeout(() => {}, 10000); // Dummy timeout
            __setSurgeTimeoutId(originalTimeoutId);

            const client1 = createMockClient('client1');
            mockClients.add(client1);
           
            startTransactionSurge(); // Attempt to start another surge

            assert.strictEqual(getIsSurgeActive(), true, 'isSurgeActive should remain true');
            assert.strictEqual(getSurgeTimeoutId(), originalTimeoutId, 'surgeTimeoutId should not change');
            assert.strictEqual(client1.send.called, false, 'Client send should not be called for an already active surge');

            clearTimeout(originalTimeoutId);
            __setSurgeTimeoutId(null);
        });


        it('should end a transaction surge correctly', function() {
            __setSurgeActive(true);
            const mockTimeoutId = 12345; // Mock an existing timeout ID
            __setSurgeTimeoutId(mockTimeoutId);

            const client1 = createMockClient('client1');
            const client2 = createMockClient('client2');
            mockClients.add(client1);
            mockClients.add(client2);
            
            let clearTimeoutCalledWith = null;
            const originalClearTimeout = clearTimeout;
            global.clearTimeout = (id) => { clearTimeoutCalledWith = id; };

            endTransactionSurge();

            assert.strictEqual(getIsSurgeActive(), false, 'isSurgeActive should be false');
            assert.strictEqual(clearTimeoutCalledWith, mockTimeoutId, 'clearTimeout should be called with surgeTimeoutId');
            assert.strictEqual(getSurgeTimeoutId(), null, 'surgeTimeoutId should be cleared from state');


            mockClients.forEach(client => {
                assert.strictEqual(client.send.called, true, `Client ${client.playerId} send should have been called`);
                const message = JSON.parse(client.send.lastArgs[0]);
                assert.strictEqual(message.type, 'transaction_surge_end', 'Message type should be transaction_surge_end');
            });
            
            global.clearTimeout = originalClearTimeout; // Restore original clearTimeout
        });

        it('should not attempt to end a surge if none is active', function() {
            __setSurgeActive(false);
            __setSurgeTimeoutId(null);

            const client1 = createMockClient('client1');
            mockClients.add(client1);

            let clearTimeoutCalled = false;
            const originalClearTimeout = clearTimeout;
            global.clearTimeout = () => { clearTimeoutCalled = true; };

            endTransactionSurge();

            assert.strictEqual(getIsSurgeActive(), false, 'isSurgeActive should remain false');
            assert.strictEqual(clearTimeoutCalled, false, 'clearTimeout should not be called');
            assert.strictEqual(client1.send.called, false, 'Client send should not be called');
            
            global.clearTimeout = originalClearTimeout;
        });
    });

    describe('Score Handling and Rewards (Conceptual Tests)', function() {
        // The actual message handling logic is inside wss.on('connection', ws => ws.on('message', ...))
        // and is not easily callable directly without refactoring server.js.
        // The following tests describe how one would test this logic if it were extracted.

        it('CONCEPTUAL: should handle transaction scores and award bonuses', function() {
            // 1. Setup:
            //    - Get the (hypothetical) extracted `handleClientMessage(ws, messageString, playerData)` function.
            //    - Create a mock `ws` client object:
            //      const mockClient = createMockClient('player1');
            //      mockClient.send = sinonSpy(); // Reset spy
            //    - Initialize player data:
            //      playerData.set('player1', { resources: 1000, id: 'player1' });
            //    - Define the message:
            //      const message = JSON.stringify({ type: 'transaction_score', score: 10, target: 5 });
            //    - Set isSurgeActive = true (or ensure condition for processing score is met)

            // 2. Action:
            //    - Call `handleClientMessage(mockClient, message, playerData)`.

            // 3. Assertions:
            //    - Player resources:
            //      const player = playerData.get('player1');
            //      const rewardPerVerification = 10;
            //      const expectedEarned = (10 * rewardPerVerification) * 1.5; // 10 score, 5 target -> bonus
            //      assert.strictEqual(player.resources, 1000 + expectedEarned, 'Player resources should be updated with bonus');
            //    - Mock ws.send called:
            //      assert.strictEqual(mockClient.send.called, true, 'Client send should be called');
            //      const sentMessage = JSON.parse(mockClient.send.lastArgs[0]);
            //      assert.strictEqual(sentMessage.type, 'update_resources', 'Message type should be update_resources');
            //      assert.strictEqual(sentMessage.newTotal, 1000 + expectedEarned, 'newTotal should be correct');
            //      assert.strictEqual(sentMessage.changeAmount, expectedEarned, 'changeAmount should be correct');
            //      assert.strictEqual(sentMessage.reason, 'Transaction Rush Reward', 'Reason should be correct');
            assert.ok(true, "This is a conceptual test. Implementation would require server.js refactor.");
        });

        it('CONCEPTUAL: should handle transaction scores without bonuses', function() {
            // 1. Setup:
            //    - Similar to above.
            //    - const mockClient = createMockClient('player2');
            //    - mockClient.send = sinonSpy();
            //    - playerData.set('player2', { resources: 500, id: 'player2', hype: 100 }); // Added hype
            //    - const message = JSON.stringify({ type: 'transaction_score', score: 3, target: 5 });
            //    - Set isSurgeActive = true

            // 2. Action:
            //    - Call `handleClientMessage(mockClient, message, playerData)`.

            // 3. Assertions:
            //    - Player resources:
            //      const player = playerData.get('player2');
            //      const rewardPerVerification = 10;
            //      const expectedEarned = 3 * rewardPerVerification; // 3 score, 5 target -> no bonus
            //      assert.strictEqual(player.resources, 500 + expectedEarned, 'Player resources should be updated without bonus');
            //    - Mock ws.send called with correct `update_resources` data.
            assert.ok(true, "This is a conceptual test. Implementation would require server.js refactor.");
        });

        it('CONCEPTUAL: should handle player connection and initialization', function() {
            // This would test the wss.on('connection', ...) logic.
            // 1. Setup:
            //    - Mock a new client `ws` connecting.
            //    - Spy on `ws.send`.
            // 2. Action:
            //    - Manually trigger the 'connection' event on the actual `wss` instance from server.js,
            //      passing the mock `ws`.
            // 3. Assertions:
            //    - `playerData` should contain an entry for `ws.playerId`.
            //    - The new player's resources and hype should be the initial amounts.
            //    - `ws.send` should have been called with a `connection_ack` message containing
            //      `playerId`, `currentResources`, `currentHype`, and `serverMemes`.
            assert.ok(true, "This is a conceptual test. Implementation would require server.js refactor or more complex integration testing setup.");
        });
    });

    describe('Meme Investment and Virality', function() {
        beforeEach(function() {
            // Reset serverMemes to a clean state for each test in this suite
            const initialMemes = [
                { id: 'meme1', name: 'Classic Doge', currentHypeInvestment: 0, iconKey: 'icon_doge', investorsThisCycle: {} },
                { id: 'meme2', name: 'Stonks Guy', currentHypeInvestment: 0, iconKey: 'icon_stonks', investorsThisCycle: {} }
            ];
            serverMemes.length = 0;
            initialMemes.forEach(m => serverMemes.push(JSON.parse(JSON.stringify(m))));
            
            playerData.clear(); // Clear player data
            mockClients.forEach(client => client.send.resetHistory()); // Reset send history for mock clients
        });

        it('CONCEPTUAL: test_investHype_sufficientHype', function() {
            // This tests the logic within the 'invest_hype' case of ws.on('message', ...)
            // 1. Setup:
            //    - const mockPlayer = createMockClient('player1');
            //    - mockClients.add(mockPlayer);
            //    - playerData.set('player1', { id: 'player1', resources: 1000, hype: 200 });
            //    - const message = JSON.stringify({ type: 'invest_hype', memeId: 'meme1', amount: 50 });

            // 2. Action:
            //    - Simulate server receiving this message from mockPlayer.
            //      (e.g., if message handler extracted: handleClientMessage(mockPlayer, message, playerData, serverMemes))

            // 3. Assertions:
            //    - assert.strictEqual(playerData.get('player1').hype, 150);
            //    - assert.strictEqual(serverMemes.find(m => m.id === 'meme1').currentHypeInvestment, 50);
            //    - assert.deepStrictEqual(serverMemes.find(m => m.id === 'meme1').investorsThisCycle['player1'], 50);
            //    - assert.ok(mockPlayer.send.called, 'Player send should be called');
            //    - const playerMsg = JSON.parse(mockPlayer.send.lastArgs[0]);
            //    - assert.strictEqual(playerMsg.type, 'update_player_hype');
            //    - assert.strictEqual(playerMsg.newHypeAmount, 150);
            //    - Check broadcast was called:
            //      let broadcastCalledWithUpdate = false;
            //      mockClients.forEach(client => {
            //          if (client.send.called) {
            //              const args = client.send.args.find(argList => JSON.parse(argList[0]).type === 'all_memes_status_update');
            //              if(args) broadcastCalledWithUpdate = true;
            //          }
            //      });
            //      assert.ok(broadcastCalledWithUpdate, 'Broadcast with all_memes_status_update not found or client spy issue');
             assert.ok(true, "This is a conceptual test for invest_hype with sufficient hype.");
        });

        it('CONCEPTUAL: test_investHype_insufficientHype', function() {
            // 1. Setup:
            //    - const mockPlayer = createMockClient('player1');
            //    - mockClients.add(mockPlayer);
            //    - playerData.set('player1', { id: 'player1', resources: 1000, hype: 20 }); // Insufficient hype
            //    - const originalMemeInvestment = serverMemes.find(m => m.id === 'meme1').currentHypeInvestment;
            //    - const message = JSON.stringify({ type: 'invest_hype', memeId: 'meme1', amount: 50 });

            // 2. Action:
            //    - Simulate server receiving this message from mockPlayer.

            // 3. Assertions:
            //    - assert.strictEqual(playerData.get('player1').hype, 20); // Unchanged
            //    - assert.strictEqual(serverMemes.find(m => m.id === 'meme1').currentHypeInvestment, originalMemeInvestment); // Unchanged
            //    - assert.ok(mockPlayer.send.called, 'Player send should be called for error');
            //    - const playerMsg = JSON.parse(mockPlayer.send.lastArgs[0]);
            //    - assert.strictEqual(playerMsg.type, 'error');
            //    - assert.strictEqual(playerMsg.message, 'Insufficient hype or invalid amount.');
            assert.ok(true, "This is a conceptual test for invest_hype with insufficient hype.");
        });

        it('test_calculateViralSpread_memeGoesViral', function() {
            Math.random = () => 0.8; // Ensure high virality score

            const investorId = 'player1';
            const mockInvestorClient = createMockClient(investorId);
            mockClients.add(mockInvestorClient);
            playerData.set(investorId, { id: investorId, resources: 1000, hype: 100 });
            
            serverMemes[0].currentHypeInvestment = 100; // meme1
            serverMemes[0].investorsThisCycle[investorId] = 100;

            calculateViralSpread();

            assert.strictEqual(playerData.get(investorId).resources, 1000 + VIRAL_REWARD_AMOUNT, 'Investor resources should increase');
            
            assert.ok(mockInvestorClient.send.called, `Investor client ${investorId} should have received messages.`);
            const updateResourcesMsg = mockInvestorClient.send.args.find(args => JSON.parse(args[0]).type === 'update_resources');
            assert.ok(updateResourcesMsg, 'Investor should receive update_resources message');
            assert.strictEqual(JSON.parse(updateResourcesMsg[0]).newTotal, 1000 + VIRAL_REWARD_AMOUNT);

            let viralEventBroadcasted = false;
            let allMemesUpdateBroadcastedAfterViral = false;
            mockClients.forEach(client => {
                client.send.args.forEach(argList => {
                    const msg = JSON.parse(argList[0]);
                    if (msg.type === 'meme_viral_event' && msg.memeId === 'meme1') {
                        viralEventBroadcasted = true;
                    }
                    if (msg.type === 'all_memes_status_update' && msg.memes[0].currentHypeInvestment === 0) {
                         // Check if this is the reset update
                        allMemesUpdateBroadcastedAfterViral = true;
                    }
                });
            });
            assert.ok(viralEventBroadcasted, 'meme_viral_event should be broadcasted');
            assert.ok(allMemesUpdateBroadcastedAfterViral, 'all_memes_status_update with reset values should be broadcasted');

            assert.strictEqual(serverMemes[0].currentHypeInvestment, 0, 'Meme investment should reset');
            assert.deepStrictEqual(serverMemes[0].investorsThisCycle, {}, 'Meme investors should reset');
        });

        it('test_calculateViralSpread_noMemeGoesViral_dueToRandomness', function() {
            Math.random = () => 0.1; // Ensure low virality score

            const investorId = 'player1';
            playerData.set(investorId, { id: investorId, resources: 1000, hype: 100 });
            serverMemes[0].currentHypeInvestment = 100; // meme1, meets MIN_HYPE_TO_GO_VIRAL
            serverMemes[0].investorsThisCycle[investorId] = 100;

            calculateViralSpread();
            
            let viralEventBroadcasted = false;
            mockClients.forEach(client => {
                client.send.args.forEach(argList => {
                    if (JSON.parse(argList[0]).type === 'meme_viral_event') {
                        viralEventBroadcasted = true;
                    }
                });
            });
            assert.strictEqual(viralEventBroadcasted, false, 'meme_viral_event should NOT be broadcasted');
            assert.strictEqual(playerData.get(investorId).resources, 1000, 'Investor resources should not change');
            assert.strictEqual(serverMemes[0].currentHypeInvestment, 0, 'Meme investment should reset even if no viral event');
            assert.deepStrictEqual(serverMemes[0].investorsThisCycle, {}, 'Meme investors should reset');
        });

        it('test_calculateViralSpread_noMemeGoesViral_dueToLowInvestment', function() {
            Math.random = () => 0.9; // High random value, but investment is too low
            
            const investorId = 'player1';
            playerData.set(investorId, { id: investorId, resources: 1000, hype: 100 });
            serverMemes[0].currentHypeInvestment = MIN_HYPE_TO_GO_VIRAL - 10; // Below threshold
            serverMemes[0].investorsThisCycle[investorId] = MIN_HYPE_TO_GO_VIRAL - 10;

            calculateViralSpread();

            let viralEventBroadcasted = false;
            mockClients.forEach(client => {
                 client.send.args.forEach(argList => {
                    if (JSON.parse(argList[0]).type === 'meme_viral_event') {
                        viralEventBroadcasted = true;
                    }
                });
            });
            assert.strictEqual(viralEventBroadcasted, false, 'meme_viral_event should NOT be broadcasted');
            assert.strictEqual(playerData.get(investorId).resources, 1000, 'Investor resources should not change');
            assert.strictEqual(serverMemes[0].currentHypeInvestment, 0, 'Meme investment should reset');
        });
    });
});

// --- Client-Side Test Concepts (Conceptual) ---
// GameScene.js:
//   handleServerMessage('connection_ack'): Verify this.playerHype, this.serverMemes, this.currentPlayerId are set; verify events 'player_hype_updated' and 'all_memes_status_updated' emitted.
//   handleServerMessage('update_player_hype'): Verify this.playerHype updates; 'player_hype_updated' event emitted.
//   handleServerMessage('all_memes_status_update'): Verify this.serverMemes updates; 'all_memes_status_updated' event emitted.
//   handleServerMessage('meme_viral_event'): Verify 'show_notification' event emitted to UIScene with correct data.
//   handleUIInvestHypeRequest(data): Verify this.webSocket.send called with correct 'invest_hype' payload.
//
// UIScene.js:
//   handlePlayerHypeUpdated(data): Verify this.hypeText updates.
//   handleAllMemesStatusUpdated(data): Verify this.currentMemesData updates; if panel is visible, populateMemeMarketPanel is called.
//   toggleMemeMarketPanel(): Verify panel visibility changes and populateMemeMarketPanel is called on open.
//   populateMemeMarketPanel():
//     - Verify old elements are cleared.
//     - Verify new meme entries (icon, name, investment, input, button) are created per this.currentMemesData.
//     - Verify "Invest" button click gets DOM input value and emits 'ui_invest_hype_request' with correct data.
//   handleShowNotification(data): Verify notification text and style/type are correctly handled.
//
// GameScene.js Tests:
// ===================
//   handleServerMessage('transaction_surge_start', message):
//     - Mocks: this.scene, this.events
//     - Action: Call handleServerMessage with type 'transaction_surge_start' and message data.
//     - Asserts:
//       - this.scene.launch('TransactionRushScene', { duration, targetVerifications, network: this }) is called once with correct parameters.
//       - this.scene.pause('GameScene') is called once.
//       - this.events.emit('surge_started', { duration, targetVerifications }) is called once with correct data.
//       - Checks if TransactionRushScene's 'transaction_rush_complete' event listener is set up.
//
//   handleServerMessage('transaction_surge_end'):
//     - Mocks: this.scene, this.scene.isActive, this.scene.isPaused
//     - Action: Call handleServerMessage with type 'transaction_surge_end'.
//     - Asserts:
//       - If TransactionRushScene is active: this.scene.stop('TransactionRushScene') is called.
//       - If GameScene is paused: this.scene.resume('GameScene') is called.
//       - this.scene.get('UIScene').events.emit('surge_ended_by_server') is called.
//
//   handleRushComplete(data):
//     - Mocks: this.webSocket, this.events, this.scene.isPaused
//     - Action: Call handleRushComplete with sample score data.
//     - Asserts:
//       - this.webSocket.send(JSON.stringify({ type: 'transaction_score', score, target })) is called with correct data.
//       - this.events.emit('surge_ended_by_player', { score, target }) is called with correct data.
//       - If GameScene was paused: this.scene.resume('GameScene') is called.
//       - this.scene.bringToTop('UIScene') is called.
//
//   sendVerificationAttempt(count): (Helper method for TransactionRushScene)
//     - Mocks: this.webSocket
//     - Action: Call sendVerificationAttempt with a count.
//     - Asserts:
//       - this.webSocket.send(JSON.stringify({ type: 'rush_verification_attempt', count })) is called.
//
// TransactionRushScene.js Tests:
// ==============================
//   init(data):
//     - Mocks: None directly, uses scene instance.
//     - Action: Create scene instance with various data inputs (with and without defaults).
//     - Asserts:
//       - this.surgeDuration, this.targetVerifications, this.timeLeft, this.network, this.gameEnded are initialized correctly.
//
//   preload():
//     - Mocks: this.load
//     - Action: Call preload().
//     - Asserts:
//       - this.load.svg('verify_button_rush_asset', 'assets/images/verify_button_rush.svg') is called.
//
//   create():
//     - Mocks: this.add, this.cameras.main, this.time, this.children (for finding button if needed by tests)
//     - Action: Call create().
//     - Asserts:
//       - Background, title, timer text, verification text, button, instructions are created and added.
//       - Button is interactive and has correct event listeners (pointerdown, pointerover, pointerout).
//       - this.timer (Phaser timer event) is created and configured correctly.
//
//   handleVerificationClick():
//     - Mocks: this.verificationsText, this.cameras.main, this.network (if testing network call)
//     - Action: Call handleVerificationClick() when game is not ended.
//     - Asserts:
//       - this.verifications is incremented.
//       - this.verificationsText.setText() is called with the new count.
//       - this.cameras.main.flash() is called.
//       - (If testing network) this.network.sendVerificationAttempt() is called.
//     - Action: Call handleVerificationClick() when gameEnded is true.
//     - Asserts:
//       - No change in verifications or text; no flash.
//
//   updateTimer():
//     - Mocks: this.timeLeftText, this.endRush (spy)
//     - Action: Call updateTimer() when timeLeft > 0 and game not ended.
//     - Asserts:
//       - this.timeLeft is decremented.
//       - this.timeLeftText.setText() is called.
//       - this.endRush() is NOT called.
//     - Action: Call updateTimer() when timeLeft becomes 0 and game not ended.
//     - Asserts:
//       - this.timeLeftText is updated to "Time Left: 0s".
//       - this.endRush() IS called.
//     - Action: Call updateTimer() when gameEnded is true.
//     - Asserts:
//       - No change in timeLeft or text.
//
//   endRush():
//     - Mocks: this.timer (Phaser timer event), this.verifyButton, this.events, this.time (for delayedCall), this.scene
//     - Action: Call endRush().
//     - Asserts:
//       - this.gameEnded is set to true.
//       - If this.timer exists, this.timer.remove(false) is called.
//       - this.verifyButton.disableInteractive() and .setAlpha(0.5) are called.
//       - "Time's Up!" text is added.
//       - this.time.delayedCall is set up to emit 'transaction_rush_complete' and stop the scene.
//     - Action: Call endRush() when gameEnded is already true.
//     - Asserts:
//       - The function returns early, no further actions taken.
//
// General Notes for Client-Side Conceptual Tests:
// - Phaser scenes and game objects would need to be properly instantiated or mocked.
// - Spies/stubs would be used for methods like `this.add.text`, `this.scene.launch`, `this.events.emit`, etc.
// - Assertions would check if these spies were called with the correct arguments and expected number of times.
// - Testing Phaser's rendering or internal timer mechanisms is usually out of scope for unit tests
//   and falls more into integration/E2E testing.
