export default class UIScene extends Phaser.Scene {
    constructor() {
        super('UIScene');
        this.currentMemesData = [];
        this.memeMarketPanel = null;
        this.memeListArea = null;
    }

    preload() {
        // Load UI specific assets if any (e.g., icons, button sprites)
        // this.load.image('button_bg', '../assets/images/button_bg.png'); // Already in BootScene
        console.log('UIScene: Preload method called.');
        // Assuming BootScene loads these. If not, uncomment:
        // this.load.svg('icon_doge', 'assets/images/icon_doge.svg', { width: 32, height: 32 });
        // this.load.svg('icon_stonks', 'assets/images/icon_stonks.svg', { width: 32, height: 32 });
    }

    create() {
        console.log('UIScene: Create method called.');
        this.cameras.main.setBackgroundColor('rgba(0,0,0,0)'); // Transparent background

        // --- Score/Resource Display Example ---
        this.resourceText = this.add.text(20, 20, 'Resources: 1000', {
            font: '20px Orbitron, sans-serif',
            fill: '#00ff00',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 10, y: 5 }
        });
        // --- Hype Display ---
        this.hypeText = this.add.text(20, 50, 'Hype: 0', {
            font: '20px Orbitron, sans-serif',
            fill: '#ff00ff', // Magenta for Hype
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 10, y: 5 }
        });


        // --- Connection Status ---
        this.connectionStatusText = this.add.text(this.cameras.main.width - 20, 20, 'Connecting...', {
            font: '16px Orbitron, sans-serif',
            fill: '#ffdd57', // Yellow for connecting
            align: 'right'
        }).setOrigin(1, 0);

        // --- Example Buttons ---
        this.createButton('Verify Tx', 100, this.cameras.main.height - 50, 'verify_transaction_action');
        this.createButton('Upgrade Node', 250, this.cameras.main.height - 50, 'upgrade_node_action');
        this.createButton('Meme Market', 420, this.cameras.main.height - 50, 'toggle_meme_market');


        // --- Notification Area ---
        this.notificationText = this.add.text(this.cameras.main.width / 2, 30, '', {
            font: '18px Orbitron, sans-serif',
            fill: '#ff5555', // Default error color
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 },
            align: 'center'
        }).setOrigin(0.5).setVisible(false);

        // --- Node Detail Panel (Hidden by default) ---
        this.nodeDetailPanel = this.createNodeDetailPanel();
        this.nodeDetailPanel.setVisible(false);

        // --- Meme Market Panel (Hidden by default) ---
        this.memeMarketPanel = this.createMemeMarketPanel();
        this.memeMarketPanel.setVisible(false);


        // Listen for events from GameScene
        const gameScene = this.scene.get('GameScene');
        if (gameScene) {
            gameScene.events.on('websocket_status', this.updateConnectionStatus, this);
            gameScene.events.on('chat_message_received', this.addChatMessage, this);
            gameScene.events.on('player_resources_updated', this.handlePlayerResourcesUpdated, this);
            gameScene.events.on('surge_started', this.handleSurgeStarted, this);
            gameScene.events.on('surge_ended_by_player', this.handleSurgeEndedByPlayer, this);
            gameScene.events.on('surge_ended_by_server', this.handleSurgeEndedByServer, this);
            gameScene.events.on('player_hype_updated', this.handlePlayerHypeUpdated, this);
            gameScene.events.on('all_memes_status_updated', this.handleAllMemesStatusUpdated, this);
            gameScene.events.on('show_notification', this.handleShowNotification, this); // General notification handler
        }

        // --- Chat Interface ---
        this.createChatInterface();
    }

    updateConnectionStatus(status) {
        if (status.connected) {
            this.connectionStatusText.setText('Connected');
            this.connectionStatusText.setFill('#00ff00'); // Green for connected
        } else {
            this.connectionStatusText.setText(status.error || 'Disconnected');
            this.connectionStatusText.setFill('#ff5555'); // Red for disconnected/error
        }
    }

    createButton(text, x, y, eventAction) {
        const buttonBG = this.add.image(0, 0, 'button_bg').setScale(0.6, 0.4).setAlpha(0.8);
        const buttonText = this.add.text(0, 0, text, { font: '16px Orbitron, sans-serif', fill: '#ffffff' }).setOrigin(0.5);
        
        const container = this.add.container(x, y, [buttonBG, buttonText]);
        container.setSize(buttonBG.displayWidth, buttonBG.displayHeight);
        container.setInteractive({ useHandCursor: true });

        container.on('pointerover', () => buttonBG.setAlpha(1).setTint(0x00ff00));
        container.on('pointerout', () => buttonBG.setAlpha(0.8).clearTint());
        container.on('pointerdown', () => {
            console.log(`UIScene: Button '${text}' clicked, action: ${eventAction}`);
            if (eventAction === 'toggle_meme_market') {
                this.toggleMemeMarketPanel();
            } else {
                // Emit an event to GameScene or handle directly
                const gameScene = this.scene.get('GameScene');
                if (gameScene) {
                    gameScene.events.emit('ui_event', { action: eventAction, details: {} });
                }
                this.showNotification({ text: `Action: ${text}` });
            }
        });
        return container;
    }

    // Modified showNotification to handle different types
    showNotification(data, durationParam, typeParam) {
        // Compatibility for old calls: showNotification("message", 3000)
        let messageText, duration, type;
        if (typeof data === 'string') {
            messageText = data;
            duration = durationParam || 3000;
            type = typeParam || 'info'; // Default type if not specified
        } else { // New call style: showNotification({ text, duration, type })
            messageText = data.text;
            duration = data.duration || 3000;
            type = data.type || 'info';
        }

        this.notificationText.setText(messageText);
        this.notificationText.setVisible(true);
        this.notificationText.setAlpha(1);

        // Set color based on type
        switch(type) {
            case 'error':
                this.notificationText.setFill('#ff5555'); // Red
                break;
            case 'success':
                this.notificationText.setFill('#55ff55'); // Green
                break;
            case 'viral':
                this.notificationText.setFill('#ffab00'); // Orange/Gold for viral
                break;
            case 'info':
            default:
                this.notificationText.setFill('#ffffff'); // White for general info
                break;
        }
        
        // Clear any existing tween on this object
        if (this.notificationTween) {
            this.notificationTween.stop();
        }
        
        // Fade out notification
        this.notificationTween = this.tweens.add({
            targets: this.notificationText,
            alpha: 0,
            delay: duration - 500, // Start fading 500ms before duration ends
            duration: 500,
            onComplete: () => {
                this.notificationText.setVisible(false);
                this.notificationTween = null;
            }
        });
    }

    createNodeDetailPanel() {
        this.tweens.add({
            targets: this.notificationText,
            alpha: 0,
            delay: duration - 500, // Start fading 500ms before duration ends
            duration: 500,
            onComplete: () => {
                this.notificationText.setVisible(false);
            }
        });
    }

    createNodeDetailPanel() {
        const panelWidth = 300;
        const panelHeight = 200;
        const panelX = this.cameras.main.width / 2 - panelWidth / 2;
        const panelY = this.cameras.main.height / 2 - panelHeight / 2;

        const panelBG = this.add.graphics();
        panelBG.fillStyle(0x1a1a2e, 0.95);
        panelBG.lineStyle(2, 0x4a4a8a, 1);
        panelBG.fillRect(0, 0, panelWidth, panelHeight);
        panelBG.strokeRect(0, 0, panelWidth, panelHeight);

        const titleText = this.add.text(panelWidth / 2, 20, 'Node Details', { font: '20px Orbitron, sans-serif', fill: '#00ff00' }).setOrigin(0.5);
        this.nodeNameText = this.add.text(20, 60, 'Name: ', { font: '16px Arial', fill: '#e0e0e0' });
        this.nodeTypeText = this.add.text(20, 90, 'Type: ', { font: '16px Arial', fill: '#e0e0e0' });
        this.nodeResourcesText = this.add.text(20, 120, 'Resources: ', { font: '16px Arial', fill: '#e0e0e0' });

        const closeButton = this.add.text(panelWidth - 20, 20, 'X', { font: '20px Arial', fill: '#ff5555', backgroundColor: '#333333', padding: {x:5, y:2} }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        closeButton.on('pointerdown', () => this.nodeDetailPanel.setVisible(false));

        const container = this.add.container(panelX, panelY, [panelBG, titleText, this.nodeNameText, this.nodeTypeText, this.nodeResourcesText, closeButton]);
        container.setDepth(10); // Ensure it's above other UI elements
        return container;
    }

    showNodeDetails(nodeData) {
        this.nodeNameText.setText(`Name: ${nodeData.name || 'N/A'}`);
        this.nodeTypeText.setText(`Type: ${nodeData.type || 'N/A'}`);
        this.nodeResourcesText.setText(`Resources: ${nodeData.resources || 'N/A'}`);
        this.nodeDetailPanel.setVisible(true);
    }

    update(time, delta) {
        // UI specific updates, e.g., animations, timers
    }

    createChatInterface() {
        const chatWidth = 300;
        const chatHeight = 200;
        const chatX = this.cameras.main.width - chatWidth - 20; // Position to the right
        const chatY = this.cameras.main.height - chatHeight - 80; // Position above buttons

        // Chat area background
        const chatAreaBG = this.add.graphics();
        chatAreaBG.fillStyle(0x0a0a1e, 0.85);
        chatAreaBG.fillRect(chatX, chatY, chatWidth, chatHeight);
        chatAreaBG.lineStyle(1, 0x3a3a7a, 1);
        chatAreaBG.strokeRect(chatX, chatY, chatWidth, chatHeight);

        // Message display area (simple text for now, could be a list)
        this.chatMessagesText = this.add.text(chatX + 10, chatY + 10, '', {
            font: '14px Arial', 
            fill: '#e0e0e0', 
            wordWrap: { width: chatWidth - 20, useAdvancedWrap: true },
            lineSpacing: 5
        }).setOrigin(0,0);
        this.chatMessagesLog = []; // To store messages

        // Input field (using DOM element for better input handling)
        this.chatInput = this.add.dom(chatX + chatWidth / 2, chatY + chatHeight + 25).createFromHTML(`
            <input type="text" id="chatInputField" placeholder="Type message..." style="width: ${chatWidth - 80}px; padding: 8px; border: 1px solid #3a3a7a; background-color: #1a1a2e; color: #e0e0e0; font-family: Arial;">
        `);
        this.chatInput.setOrigin(0.5);

        // Send button
        const sendButtonBG = this.add.image(0, 0, 'button_bg').setScale(0.3, 0.3).setAlpha(0.8);
        const sendButtonText = this.add.text(0, 0, 'Send', { font: '14px Orbitron, sans-serif', fill: '#ffffff' }).setOrigin(0.5);
        const sendButton = this.add.container(chatX + chatWidth - 35, chatY + chatHeight + 25, [sendButtonBG, sendButtonText]);
        sendButton.setSize(sendButtonBG.displayWidth, sendButtonBG.displayHeight);
        sendButton.setInteractive({ useHandCursor: true });

        sendButton.on('pointerover', () => sendButtonBG.setAlpha(1).setTint(0x00ff00));
        sendButton.on('pointerout', () => sendButtonBG.setAlpha(0.8).clearTint());
        sendButton.on('pointerdown', () => {
            const inputElement = document.getElementById('chatInputField');
            if (inputElement && inputElement.value.trim() !== '') {
                this.sendChatMessage(inputElement.value.trim());
                inputElement.value = ''; // Clear input field
            }
        });

        // Allow sending with Enter key
        this.input.keyboard.on('keydown-ENTER', () => {
            const inputElement = document.getElementById('chatInputField');
            if (inputElement && inputElement.value.trim() !== '' && document.activeElement === inputElement) {
                this.sendChatMessage(inputElement.value.trim());
                inputElement.value = '';
            }
        });
    }

    sendChatMessage(messageText) {
        console.log(`UIScene: Sending chat message: ${messageText}`);
        // Emit an event to GameScene to send via WebSocket
        // Assuming a simple user name for now, could be dynamic later
        this.scene.get('GameScene').events.emit('send_chat_message', { user: 'Player', text: messageText });
        // Optionally, add to local chat log immediately for responsiveness
        // this.addChatMessage({ payload: { user: 'Me', text: messageText }, timestamp: new Date().toISOString() });
    }

    addChatMessage(messageData) {
        // messageData expected: { type: 'chat_message', payload: { user, text }, timestamp }
        const { user, text } = messageData.payload;
        const timestamp = new Date(messageData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formattedMessage = `[${timestamp}] ${user}: ${text}`;

        this.chatMessagesLog.push(formattedMessage);
        if (this.chatMessagesLog.length > 10) { // Keep only last 10 messages
            this.chatMessagesLog.shift();
        }
        this.chatMessagesText.setText(this.chatMessagesLog.join('\n'));
        
        // Auto-scroll (simple version: just keep text at top of box)
        // For a proper scrollable area, a more complex setup (e.g., render texture or mask) would be needed.
    }

    // Clean up listeners when scene is shut down
    shutdown() {
        const gameScene = this.scene.get('GameScene'); // Check if GameScene still exists
        if (gameScene && gameScene.events) {
            gameScene.events.off('websocket_status', this.updateConnectionStatus, this);
            gameScene.events.off('chat_message_received', this.addChatMessage, this);
            gameScene.events.off('player_resources_updated', this.handlePlayerResourcesUpdated, this);
            gameScene.events.off('surge_started', this.handleSurgeStarted, this);
            gameScene.events.off('surge_ended_by_player', this.handleSurgeEndedByPlayer, this);
            gameScene.events.off('surge_ended_by_server', this.handleSurgeEndedByServer, this);
            gameScene.events.off('player_hype_updated', this.handlePlayerHypeUpdated, this);
            gameScene.events.off('all_memes_status_updated', this.handleAllMemesStatusUpdated, this);
            gameScene.events.off('show_notification', this.handleShowNotification, this);
        }

        if (this.input.keyboard) {
            this.input.keyboard.off('keydown-ENTER');
        }
        console.log('UIScene: Shutdown.');
    }

    // --- Event Handlers for GameScene Events ---

    handlePlayerResourcesUpdated(data) {
        if (this.resourceText && data) {
            this.resourceText.setText(`Resources: ${data.newTotal}`);
            this.showNotification({text: `Resources ${data.changeAmount > 0 ? '+' : ''}${data.changeAmount} (${data.reason})`, duration: 3000, type: 'info'});
        } else {
            console.warn('UIScene: resourceText or data not available for handlePlayerResourcesUpdated.', data);
        }
    }
     handlePlayerHypeUpdated(data) {
        if (this.hypeText && typeof data.newHypeAmount !== 'undefined') {
            this.hypeText.setText(`Hype: ${data.newHypeAmount}`);
        } else {
            console.warn('UIScene: hypeText or data.newHypeAmount not available for handlePlayerHypeUpdated.', data);
        }
    }

    handleAllMemesStatusUpdated(data) {
        this.currentMemesData = data.memes || [];
        console.log('UIScene: Received meme status update', this.currentMemesData);
        if (this.memeMarketPanel && this.memeMarketPanel.visible) {
            this.populateMemeMarketPanel();
        }
    }
    
    handleShowNotification(data) {
        if (data && data.text) {
            this.showNotification(data); // data should be an object {text, duration, type}
        } else {
            console.warn('UIScene: Invalid data for handleShowNotification', data);
        }
    }


    handleSurgeStarted(data) {
        if (data) {
             this.showNotification({text: `TRANSACTION RUSH! Verify ${data.targetVerifications} in ${data.duration / 1000}s!`, duration: 5000, type: 'info'});
            // Optional: Display a persistent indicator
            if (!this.surgeIndicator) {
                this.surgeIndicator = this.add.text(this.cameras.main.width / 2, 70, 'SURGE ACTIVE!', {
                    font: '16px Orbitron', fill: '#ffab00', backgroundColor: 'rgba(50,0,0,0.7)', padding: {x:5, y:2}
                }).setOrigin(0.5);
            }
            this.surgeIndicator.setVisible(true);
        } else {
            console.warn('UIScene: data not available for handleSurgeStarted.');
        }
    }

    handleSurgeEndedByPlayer(data) {
        if (data) {
            this.showNotification({text: `Rush Complete! You verified ${data.score} / ${data.target} transactions.`, duration: 4000, type: 'success'});
        } else {
            console.warn('UIScene: data not available for handleSurgeEndedByPlayer.');
        }
        if (this.surgeIndicator) {
            this.surgeIndicator.setVisible(false);
        }
    }

    handleSurgeEndedByServer() {
        this.showNotification({text: 'Transaction Rush has ended by server.', duration: 3000, type: 'info'});
        if (this.surgeIndicator) {
            this.surgeIndicator.setVisible(false);
        }
    }

    // --- Meme Market Panel ---
    createMemeMarketPanel() {
        const panelWidth = 450;
        const panelHeight = 400;
        const panelX = this.cameras.main.width / 2 - panelWidth / 2;
        const panelY = this.cameras.main.height / 2 - panelHeight / 2;

        const panelBG = this.add.graphics();
        panelBG.fillStyle(0x1a1a2e, 0.95); // Dark purple-blue
        panelBG.lineStyle(2, 0x4a4a8a, 1); // Lighter purple border
        panelBG.fillRect(0, 0, panelWidth, panelHeight);
        panelBG.strokeRect(0, 0, panelWidth, panelHeight);

        const titleText = this.add.text(panelWidth / 2, 30, 'Meme Market', { font: '24px Orbitron', fill: '#ffab00' }).setOrigin(0.5);
        
        const closeButton = this.add.text(panelWidth - 30, 30, 'X', { font: '24px Arial', fill: '#ff5555', backgroundColor: '#333333', padding: {x:5, y:2} }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        closeButton.on('pointerdown', () => this.toggleMemeMarketPanel());

        // Area for meme listings
        this.memeListArea = this.add.container(25, 70); // Positioned within the panel

        const container = this.add.container(panelX, panelY, [panelBG, titleText, closeButton, this.memeListArea]);
        container.setDepth(20); // Ensure it's above other UI elements
        container.setVisible(false); // Start hidden
        return container;
    }

    toggleMemeMarketPanel() {
        if (!this.memeMarketPanel) return;
        this.memeMarketPanel.setVisible(!this.memeMarketPanel.visible);
        if (this.memeMarketPanel.visible) {
            this.populateMemeMarketPanel();
        }
    }

    populateMemeMarketPanel() {
        if (!this.memeListArea || !this.currentMemesData) return;

        this.memeListArea.removeAll(true); // Clear previous listings

        let yOffset = 0;
        const itemHeight = 80; // Height for each meme item
        const listWidth = 400;

        this.currentMemesData.forEach((meme, index) => {
            // Background for each item
            const itemBg = this.add.graphics().fillStyle(0x2a2a4e, 0.7).fillRect(0, yOffset, listWidth, itemHeight - 5);
            this.memeListArea.add(itemBg);
            
            // Meme Icon (placeholder if not loaded)
            const icon = this.add.image(30, yOffset + (itemHeight / 2) - 2, meme.iconKey || 'default_icon').setScale(0.8).setOrigin(0.5);
            // If iconKey is missing or asset not loaded, Phaser might show a broken texture. Handle appropriately.
            // Check if texture exists: this.textures.exists(meme.iconKey)
            if (!this.textures.exists(meme.iconKey)) {
                 icon.setTexture('node_default').setDisplaySize(32,32); // Fallback to a default loaded asset
            }
            this.memeListArea.add(icon);

            // Meme Name
            const nameText = this.add.text(70, yOffset + 15, meme.name, { font: '16px Orbitron', fill: '#ffffff' });
            this.memeListArea.add(nameText);

            // Current Hype Invested
            const hypeText = this.add.text(70, yOffset + 40, `Market Hype: ${meme.currentHypeInvestment}`, { font: '14px Arial', fill: '#cccccc' });
            this.memeListArea.add(hypeText);

            // Investment DOM Input
            const inputX = listWidth - 180; // Position for input and button
            const inputY = yOffset + (itemHeight / 2) - 15; // Centered vertically
            
            const inputElementId = `meme_invest_amount_${meme.id}`;
            const inputHTML = `<input type="number" id="${inputElementId}" placeholder="Hype" style="width: 80px; padding: 5px; border: 1px solid #4a4a8a; background-color: #1a1a2e; color: #e0e0e0; font-family: Arial; text-align: right;">`;
            const domInput = this.add.dom(inputX, inputY).createFromHTML(inputHTML).setOrigin(0,0.5);
            this.memeListArea.add(domInput);
            
            // Invest Button
            const investButtonBG = this.add.image(0,0, 'button_bg').setScale(0.35, 0.3).setAlpha(0.8);
            const investButtonText = this.add.text(0,0, 'Invest', { font: '14px Orbitron', fill: '#ffffff' }).setOrigin(0.5);
            const investButton = this.add.container(inputX + 130, inputY, [investButtonBG, investButtonText]);
            investButton.setSize(investButtonBG.displayWidth, investButtonBG.displayHeight);
            investButton.setInteractive({ useHandCursor: true });
            
            investButton.on('pointerover', () => investButtonBG.setAlpha(1).setTint(0x00ff00));
            investButton.on('pointerout', () => investButtonBG.setAlpha(0.8).clearTint());
            investButton.on('pointerdown', () => {
                const inputField = document.getElementById(inputElementId);
                if (inputField) {
                    const amountValue = parseInt(inputField.value, 10);
                    if (!isNaN(amountValue) && amountValue > 0) {
                        console.log(`UIScene: Emitting ui_invest_hype_request for ${meme.id} with amount ${amountValue}`);
                        this.events.emit('ui_invest_hype_request', { memeId: meme.id, amount: amountValue });
                        inputField.value = ''; // Clear input
                        // Optional: Show "Investing..." feedback
                        investButtonText.setText('...');
                        investButton.disableInteractive();
                        this.time.delayedCall(1000, () => {
                             investButtonText.setText('Invest');
                             if (investButton.scene) investButton.setInteractive(); // Check scene exists before re-enabling
                        });
                    } else {
                        this.showNotification({text: 'Invalid amount. Please enter a positive number.', duration: 2000, type: 'error'});
                    }
                }
            });
            this.memeListArea.add(investButton);

            yOffset += itemHeight;
        });
    }
}