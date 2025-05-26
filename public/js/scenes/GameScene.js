const LOCAL_STORAGE_KEY = 'layerDefenderPlayerData';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.nodes = [];
        // this.webSocket = null; // WebSocket removed
        this.playerResources = 0; 
        this.playerHype = 0;
        this.clientMemes = []; 
        this.currentPlayerId = null;

        // Surge timing parameters
        this.timeToNextSurge = 0; 
        this.surgeIntervalMin = 60000; // 1 minute
        this.surgeIntervalMax = 180000; // 3 minutes

        // Viral Spread constants
        this.MIN_HYPE_TO_GO_VIRAL = 50;
        this.MIN_VIRALITY_SCORE_THRESHOLD = 30;
        this.VIRAL_REWARD_AMOUNT = 500;
        this.VIRAL_CHECK_INTERVAL = 120000; // 2 minutes
        this.viralSpreadTimer = null;
    }

    init(data) {
        // Data passed from other scenes, if any
        console.log('GameScene: Initializing with data:', data);
        
        this.loadPlayerData(); // Load data first

        // Other initializations not covered by localStorage (or to be set if no saved data)
        this.clientMemes = []; 
        this.currentPlayerId = null; 

        // Initialize remaining data and emit events (including initial surge timer)
        this.simulateInitialClientData(); 
    }

    preload() {
        // Assets for this scene specifically, if not loaded in BootScene
        console.log('GameScene: Preload method called.');
    }

    create() {
        console.log('GameScene: Create method called.');
        this.cameras.main.setBackgroundColor('#0a0a23'); // Dark blue space-like background

        // Example: Add a title or placeholder text
        this.add.text(this.cameras.main.width / 2, 50, 'LayerEdge Network Defender - Game Area (Offline)', {
            font: '28px Orbitron, sans-serif', // Using a futuristic font
            fill: '#00ff00'
        }).setOrigin(0.5);

        // Initialize WebSocket connection - REMOVED
        // this.connectWebSocket(); 

        // Example: Create a player node (this would be more dynamic)
        this.createPlayerNode(this.cameras.main.width / 2, this.cameras.main.height / 2, 'node_default', 'MyNode');

        // Setup input handlers or game loops
        this.input.on('pointerdown', (pointer) => {
            // Example: interact with nodes or place new ones
            console.log(`Pointer down at x: ${pointer.x}, y: ${pointer.y}`);
            // this.createPlayerNode(pointer.x, pointer.y, 'node_default', `Node-${this.nodes.length + 1}`);
            // Send action to server via WebSocket - REMOVED
            // if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            //     this.webSocket.send(JSON.stringify({ type: 'player_action', action: 'click', x: pointer.x, y: pointer.y }));
            // }
        });

        // Listen for events from UIScene (e.g., button clicks)
        this.events.on('ui_event', this.handleUIEvent, this);
        // Listen for chat messages to send from UIScene
        this.events.on('send_chat_message', this.sendChatMessageToServer, this);

        // Listen for hype investment requests from UIScene
        const uiScene = this.scene.get('UIScene');
        if (uiScene) { // Check if UIScene is available
            uiScene.events.on('ui_invest_hype_request', this.handleUIInvestHypeRequest, this);
        } else {
            // Poll for UIScene if it's not ready immediately (e.g. race condition on startup)
            this.time.delayedCall(500, () => {
                const uiSceneRetry = this.scene.get('UIScene');
                if (uiSceneRetry) {
                    uiSceneRetry.events.on('ui_invest_hype_request', this.handleUIInvestHypeRequest, this);
                } else {
                    console.error("GameScene: UIScene not found even after delay. Cannot set up 'ui_invest_hype_request' listener.");
                }
            });
        }

        // Schedule periodic viral spread calculation
        if (this.viralSpreadTimer) { // Clear existing timer if scene re-initializes
            this.viralSpreadTimer.remove(false);
        }
        this.viralSpreadTimer = this.time.addEvent({
            delay: this.VIRAL_CHECK_INTERVAL || 120000, 
            callback: this.calculateViralSpreadClientSide,
            callbackScope: this,
            loop: true
        });
        console.log(`Client-side viral spread calculation scheduled every ${(this.VIRAL_CHECK_INTERVAL || 120000) / 1000} seconds.`);
    }

    setNextSurgeTimer() {
        this.timeToNextSurge = Phaser.Math.Between(this.surgeIntervalMin, this.surgeIntervalMax);
        console.log(`Next transaction surge in: ${this.timeToNextSurge / 1000}s`);
    }

    update(time, delta) {
        // Game loop logic
        // Example: move nodes, check for collisions, update game state

        // Client-side surge trigger logic
        if (this.timeToNextSurge > 0) {
            this.timeToNextSurge -= delta;
            if (this.timeToNextSurge <= 0) {
                this.triggerTransactionSurge();
                this.setNextSurgeTimer(); // Set timer for the next one
            }
        }
    }

    // connectWebSocket() - REMOVED

    // handleServerMessage(message) - Largely removed or simplified
    // Kept for potential local client-side events if any, but server messages are gone.
    handleLocalEvent(eventData) {
        console.log('GameScene: handleLocalEvent called with:', eventData);
        // Example: if (eventData.type === 'local_player_action') { ... }
        // For now, this can be a placeholder or used for future client-only logic.
    }

    loadPlayerData() {
        const savedDataJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedDataJSON) {
            try {
                const savedData = JSON.parse(savedDataJSON);
                this.playerResources = typeof savedData.playerResources === 'number' ? savedData.playerResources : 1000;
                this.playerHype = typeof savedData.playerHype === 'number' ? savedData.playerHype : 100;
                console.log('Player data loaded from localStorage:', this.playerResources, this.playerHype);
            } catch (e) {
                console.error('Error parsing player data from localStorage:', e);
                this.playerResources = 1000; // Default value on error
                this.playerHype = 100;    // Default value on error
            }
        } else {
            this.playerResources = 1000; // Default value if no saved data
            this.playerHype = 100;    // Default value if no saved data
            console.log('No saved data found. Initializing with default values for resources and hype.');
        }
    }

    savePlayerData() {
        const dataToSave = {
            playerResources: this.playerResources,
            playerHype: this.playerHype
        };
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
            console.log('Player data saved to localStorage.');
        } catch (e) {
            console.error('Error saving player data to localStorage:', e);
        }
    }

    simulateInitialClientData() { 
        // Player resources and hype are now loaded by loadPlayerData() before this is called.
        // This method now focuses on other client-side initializations and emitting initial state.

        // Initialize other data not stored in localStorage or use defaults if not set by loadPlayerData
        this.currentPlayerId = this.currentPlayerId || 'local_player'; 
        
        // Initialize clientMemes only if it's empty (e.g., first time or not saved/loaded)
        if (!this.clientMemes || this.clientMemes.length === 0) {
            this.clientMemes = [ 
                { id: 'meme1', name: 'Classic Doge', currentHypeInvestment: 0, iconKey: 'icon_doge', investorsThisCycle: {} },
                { id: 'meme2', name: 'Stonks Guy', currentHypeInvestment: 0, iconKey: 'icon_stonks', investorsThisCycle: {} }
            ];
        }
        
        this.setNextSurgeTimer(); // Set initial timer for the first surge

        console.log(`GameScene (Offline Mode): Player ID ${this.currentPlayerId} initialized/confirmed with ${this.playerHype} Hype and ${this.playerResources} resources.`);
        console.log('GameScene (Offline Mode): Initial client memes:', this.clientMemes);

        // Emit events to UIScene with current values (either loaded or default)
        this.events.emit('player_resources_updated', { newTotal: this.playerResources, changeAmount: 0, reason: 'Initial' });
        this.events.emit('player_hype_updated', { newHypeAmount: this.playerHype });
        this.events.emit('all_memes_status_updated', { memes: this.clientMemes });
        
        // Simulate that the "server" (now client) has "acknowledged" the connection
        if (this.scene.isActive('UIScene')) {
             this.scene.get('UIScene').events.emit('websocket_status', { connected: false, error: 'Offline Mode' });
        } else {
            this.time.delayedCall(100, () => { // Wait for UIScene to potentially become active
                if (this.scene.isActive('UIScene')) {
                    this.scene.get('UIScene').events.emit('websocket_status', { connected: false, error: 'Offline Mode' });
                }
            });
        }
    }


    createPlayerNode(x, y, textureKey, name) {
        const nodeSprite = this.add.sprite(x, y, textureKey).setInteractive();
        nodeSprite.setScale(0.5); // Adjust scale as needed
        const nodeNameText = this.add.text(x, y + 40, name, { font: '14px Arial', fill: '#ffffff' }).setOrigin(0.5);
        
        nodeSprite.on('pointerover', () => nodeSprite.setTint(0x00ff00));
        nodeSprite.on('pointerout', () => nodeSprite.clearTint());
        nodeSprite.on('pointerdown', () => {
            console.log(`Clicked on node: ${name}`);
            // Potentially open a detail view in UIScene
            this.scene.get('UIScene').showNodeDetails({ name, type: textureKey, resources: 'N/A' });
        });

        this.nodes.push({ sprite: nodeSprite, text: nodeNameText, data: { name, type: textureKey } });
        console.log(`GameScene: Created node ${name} at (${x}, ${y})`);
    }

    handleUIEvent(event) {
        console.log('GameScene: Received UI event:', event);
        // if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) { // REMOVED
        //     this.webSocket.send(JSON.stringify({ type: 'ui_action', action: event.action, details: event.details }));
        // }
        // Handle actions like 'upgrade_node', 'allocate_resource', etc. - Now client-side only
        if (event.action === 'verify_transaction_action') {
            // Simulate Transaction Rush start for offline play
            if (!this.scene.isActive('TransactionRushScene')) {
                console.log('GameScene (Offline): Simulating Transaction Rush start.');
                this.scene.launch('TransactionRushScene', {
                    duration: 30000, // 30 seconds
                    targetVerifications: 50, // This could be randomized by triggerTransactionSurge if needed
                    network: this // Still pass `this` for sendVerificationAttempt, which is now a stub
                });
                this.scene.pause('GameScene');
                this.scene.bringToTop('UIScene');
                // Ensure listener is set up correctly
                const rushScene = this.scene.get('TransactionRushScene');
                if (rushScene) {
                    rushScene.events.once('transaction_rush_complete', this.handleRushComplete, this);
                } else { // Fallback if scene isn't immediately available (less likely with launch)
                     this.time.delayedCall(100, () => {
                        const rushSceneRetry = this.scene.get('TransactionRushScene');
                        if(rushSceneRetry) rushSceneRetry.events.once('transaction_rush_complete', this.handleRushComplete, this);
                     });
                }
                this.events.emit('surge_started', { duration: 30000, targetVerifications: 50 });
            }
        }
    }

    // sendChatMessageToServer(chatData) - REMOVED (or stubbed)
    sendChatMessageToServer(chatData) {
        console.warn('GameScene: sendChatMessageToServer called in offline mode. Chat is disabled.', chatData);
        // Optionally, notify UI that chat is offline
        if (this.scene.isActive('UIScene')) {
            this.scene.get('UIScene').events.emit('show_notification', { text: 'Chat is offline.', duration: 2000, type: 'info' });
        }
    }

    // Make sure to clean up WebSocket connection when the scene is shut down
    shutdown() {
        // if (this.webSocket) { // REMOVED
        //     this.webSocket.close();
        // }
        this.events.off('ui_event', this.handleUIEvent, this);
        this.events.off('send_chat_message', this.sendChatMessageToServer, this);
        
        // Clean up listener for TransactionRushScene if GameScene is shut down while rush is active
        // .once() handles self-removal, but if GameScene itself is destroyed, direct cleanup is good.
        if (this.scene.manager.keys['TransactionRushScene'] && this.scene.isActive('TransactionRushScene')) {
             const rushScene = this.scene.get('TransactionRushScene');
             if(rushScene && rushScene.events) { // Check if rushScene and its events emitter exist
                rushScene.events.off('transaction_rush_complete', this.handleRushComplete, this);
             }
        }

        // Remove listener for hype investment requests
        const uiScene = this.scene.get('UIScene');
        if (uiScene && uiScene.events) { // Check if UIScene and its events emitter exist
            uiScene.events.off('ui_invest_hype_request', this.handleUIInvestHypeRequest, this);
        }
        
        // Cleanup Viral Spread Timer
        if (this.viralSpreadTimer) {
            this.viralSpreadTimer.remove(false);
            this.viralSpreadTimer = null; 
            console.log('GameScene: Viral spread timer removed.');
        }

        console.log('GameScene: Shutdown, WebSocket closed.');
    }

    handleUIInvestHypeRequest(data) {
        const { memeId, amount } = data; // Amount is expected to be a number from UIScene's parseInt
        
        console.log(`GameScene: Received UI request to invest ${amount} hype in ${memeId}`);

        const currentHype = this.playerHype;
        const memeIndex = this.clientMemes.findIndex(m => m.id === memeId);

        if (memeIndex === -1) {
            console.error(`GameScene: Meme ${memeId} not found for investment.`);
            this.events.emit('show_notification', {
                text: `Meme ${memeId} not found. Investment failed.`,
                duration: 3000,
                type: 'error'
            });
            return;
        }
        const memeToUpdate = this.clientMemes[memeIndex];

        if (isNaN(amount) || amount <= 0 || currentHype < amount) {
            console.warn(`Invalid hype investment: amount ${amount}, current hype ${currentHype}`);
            this.events.emit('show_notification', {
                text: 'Investment failed: Insufficient hype or invalid amount.',
                duration: 3000,
                type: 'error'
            });
            return;
        }

        // Validation passed
        this.playerHype -= amount;
        memeToUpdate.currentHypeInvestment += amount;

        if (!memeToUpdate.investorsThisCycle) {
            memeToUpdate.investorsThisCycle = {};
        }
        memeToUpdate.investorsThisCycle[this.currentPlayerId] = (memeToUpdate.investorsThisCycle[this.currentPlayerId] || 0) + amount;

        console.log(`Player ${this.currentPlayerId} invested ${amount} in ${memeToUpdate.name}. New Hype: ${this.playerHype}. Meme total: ${memeToUpdate.currentHypeInvestment}`);
        
        this.savePlayerData(); // Save playerHype (and resources)

        this.events.emit('player_hype_updated', { newHypeAmount: this.playerHype });
        this.events.emit('all_memes_status_updated', { memes: this.clientMemes });
    }

    // Method for TransactionRushScene to send verifications - STUBBED
    sendVerificationAttempt(verificationsCount) {
        // if (this.webSocket && this.webSocket.readyState === 1) { // REMOVED
        //     this.webSocket.send(JSON.stringify({ type: 'rush_verification_attempt', count: verificationsCount }));
        // }
        console.log(`GameScene (Offline): Verification attempt count: ${verificationsCount}. (Not sent to server)`);
    }

    handleRushComplete(data) {
        console.log('GameScene: handleRushComplete. Score:', data.score, 'Target:', data.target);
        
        const rewardPerVerification = 10;
        const bonusThreshold = data.target; // Or a slightly adjusted threshold if desired
        let earnedResources = data.score * rewardPerVerification;
        let bonusApplied = false;

        if (data.score >= bonusThreshold && bonusThreshold > 0) { // Ensure target is meaningful
            earnedResources *= 1.5; // 50% bonus
            bonusApplied = true;
            console.log('Bonus applied for meeting target!');
        }
        earnedResources = Math.floor(earnedResources);
        
        this.playerResources += earnedResources;
        console.log(`Awarded ${earnedResources} resources. New total: ${this.playerResources}`);
        this.savePlayerData(); // Call the existing localStorage save function

        this.events.emit('player_resources_updated', {
            newTotal: this.playerResources,
            changeAmount: earnedResources,
            reason: bonusApplied ? 'Transaction Rush +Bonus!' : 'Transaction Rush'
        });

        // This event is for UIScene to show a score summary or specific rush end notification
        this.events.emit('surge_ended_by_player', { score: data.score, target: data.target });

        if (this.scene.isPaused('GameScene')) {
            this.scene.resume('GameScene');
        }
        // TransactionRushScene stops itself, so no need to stop it here.


        // UIScene might need to be explicitly brought to top again if TransactionRushScene was over it.
        // Or if UIScene was paused, resume it.
        this.scene.bringToTop('UIScene');
    }

    triggerTransactionSurge() {
        console.log('GameScene: Triggering client-side Transaction Surge!');
        
        const surgeDuration = 30000; // 30 seconds
        const targetVerifications = Phaser.Math.Between(30, 70); // Random target

        if (this.scene.isActive('TransactionRushScene')) {
            console.log('TransactionRushScene already active. Skipping new surge.');
            return;
        }

        this.scene.launch('TransactionRushScene', {
            duration: surgeDuration,
            targetVerifications: targetVerifications,
            network: this // Pass GameScene for sendVerificationAttempt (even if stubbed)
        });
        this.scene.pause('GameScene');
        this.scene.bringToTop('UIScene'); 

        this.events.emit('surge_started', { duration: surgeDuration, targetVerifications: targetVerifications });

        const rushScene = this.scene.get('TransactionRushScene');
        if (rushScene) {
            rushScene.events.once('transaction_rush_complete', this.handleRushComplete, this);
        } else {
            // Fallback listener setup if scene launch is not immediate (less common for 'launch')
            this.time.delayedCall(100, () => {
                const rushSceneRetry = this.scene.get('TransactionRushScene');
                if (rushSceneRetry) {
                    rushSceneRetry.events.once('transaction_rush_complete', this.handleRushComplete, this);
                } else {
                    console.error("GameScene: Failed to get TransactionRushScene to attach complete listener even after delay.");
                }
            });
        }
    }

    calculateViralSpreadClientSide() {
        console.log('GameScene: Calculating viral spread (client-side)...');
        let winningMeme = null;
        let maxViralityScore = 0;

        // Ensure constants are accessible, e.g. this.MIN_HYPE_TO_GO_VIRAL
        const MIN_HYPE_TO_GO_VIRAL = this.MIN_HYPE_TO_GO_VIRAL; 
        const MIN_VIRALITY_SCORE_THRESHOLD = this.MIN_VIRALITY_SCORE_THRESHOLD;
        const VIRAL_REWARD_AMOUNT = this.VIRAL_REWARD_AMOUNT;

        for (const meme of this.clientMemes) {
            if (meme.currentHypeInvestment < MIN_HYPE_TO_GO_VIRAL) {
                console.log(`Meme ${meme.name} has only ${meme.currentHypeInvestment} hype, needs ${MIN_HYPE_TO_GO_VIRAL} to be eligible for viral spread.`);
                continue; 
            }

            let viralityScore = meme.currentHypeInvestment * Math.random();
            console.log(`Meme ${meme.name} current investment: ${meme.currentHypeInvestment}, calculated virality score: ${viralityScore}`);

            if (viralityScore > maxViralityScore) {
                maxViralityScore = viralityScore;
                winningMeme = meme;
            }
        }

        if (winningMeme && maxViralityScore >= MIN_VIRALITY_SCORE_THRESHOLD) {
            console.log(`Meme '${winningMeme.name}' went viral with score ${maxViralityScore}!`);
            
            const playerWasInvestor = winningMeme.investorsThisCycle && winningMeme.investorsThisCycle[this.currentPlayerId];
            let playerReward = 0;

            if (playerWasInvestor) {
                this.playerResources += VIRAL_REWARD_AMOUNT;
                playerReward = VIRAL_REWARD_AMOUNT;
                this.savePlayerData(); // Save updated resources
                console.log(`Player ${this.currentPlayerId} was an investor! Awarded ${VIRAL_REWARD_AMOUNT}. New total: ${this.playerResources}`);
                // UIScene will get individual resource update via this event
                this.events.emit('player_resources_updated', {
                    newTotal: this.playerResources,
                    changeAmount: VIRAL_REWARD_AMOUNT,
                    reason: `Viral Meme '${winningMeme.name}' Payout`
                });
            }

            // Notify UIScene about the viral event (even if player didn't win, so they see it happen)
            this.events.emit('meme_viral_event', {
                memeId: winningMeme.id,
                memeName: winningMeme.name,
                playerWon: !!playerWasInvestor, // Convert to boolean
                rewardAmount: playerReward, // Will be 0 if player didn't invest
                message: `${winningMeme.name} went VIRAL! ${playerWasInvestor ? 'You got ' + playerReward + ' resources!' : 'Investors shared the spoils!'}`
            });

        } else {
            console.log('No meme reached viral status this cycle.');
            this.events.emit('show_notification', { text: 'No meme went viral this cycle.', duration: 3000 });
        }

        // Reset for next cycle
        this.clientMemes.forEach(meme => {
            meme.currentHypeInvestment = 0;
            meme.investorsThisCycle = {}; // Clear investors for this meme
        });

        // Update UIScene with reset meme statuses
        this.events.emit('all_memes_status_updated', { memes: this.clientMemes });
        console.log('Meme investments and investor lists reset for next cycle.');
    }
}