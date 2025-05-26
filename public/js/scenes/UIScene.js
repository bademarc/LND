export default class UIScene extends Phaser.Scene {
    constructor() {
        super('UIScene');
    }

    preload() {
        // Load UI specific assets if any (e.g., icons, button sprites)
        // this.load.image('button_bg', '../assets/images/button_bg.png'); // Already in BootScene
        console.log('UIScene: Preload method called.');
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

        // --- Connection Status ---
        this.connectionStatusText = this.add.text(this.cameras.main.width - 20, 20, 'Connecting...', {
            font: '16px Orbitron, sans-serif',
            fill: '#ffdd57', // Yellow for connecting
            align: 'right'
        }).setOrigin(1, 0);

        // --- Example Buttons ---
        this.createButton('Verify Tx', 100, this.cameras.main.height - 50, 'verify_transaction_action');
        this.createButton('Upgrade Node', 250, this.cameras.main.height - 50, 'upgrade_node_action');

        // --- Notification Area ---
        this.notificationText = this.add.text(this.cameras.main.width / 2, 30, '', {
            font: '18px Orbitron, sans-serif',
            fill: '#ff5555',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 },
            align: 'center'
        }).setOrigin(0.5).setVisible(false);

        // --- Node Detail Panel (Hidden by default) ---
        this.nodeDetailPanel = this.createNodeDetailPanel();
        this.nodeDetailPanel.setVisible(false);

        // Listen for events from GameScene (e.g., WebSocket status)
        const gameScene = this.scene.get('GameScene');
        if (gameScene) {
            gameScene.events.on('websocket_status', this.updateConnectionStatus, this);
            gameScene.events.on('chat_message_received', this.addChatMessage, this);
            gameScene.events.on('player_resources_updated', this.handlePlayerResourcesUpdated, this);
            gameScene.events.on('surge_started', this.handleSurgeStarted, this);
            gameScene.events.on('surge_ended_by_player', this.handleSurgeEndedByPlayer, this);
            gameScene.events.on('surge_ended_by_server', this.handleSurgeEndedByServer, this);
        }

        // --- Chat Interface ---
        this.createChatInterface();
        // Listen for chat messages from GameScene (which gets them from WebSocket) - Moved above for clarity
        // this.scene.get('GameScene').events.on('chat_message_received', this.addChatMessage, this);
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
            console.log(`UIScene: Button '${text}' clicked.`);
            // Emit an event to GameScene or handle directly
            this.scene.get('GameScene').events.emit('ui_event', { action: eventAction, details: {} });
            this.showNotification(`Action: ${text}`);
        });
        return container;
    }

    showNotification(message, duration = 3000) {
        this.notificationText.setText(message);
        this.notificationText.setVisible(true);
        this.notificationText.setAlpha(1);

        // Fade out notification
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
            this.showNotification(`Resources ${data.changeAmount > 0 ? '+' : ''}${data.changeAmount} (${data.reason})`, 3000);
        } else {
            console.warn('UIScene: resourceText or data not available for handlePlayerResourcesUpdated.', data);
        }
    }

    handleSurgeStarted(data) {
        if (data) {
            this.showNotification(`TRANSACTION RUSH! Verify ${data.targetVerifications} in ${data.duration / 1000}s!`, 5000);
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
            this.showNotification(`Rush Complete! You verified ${data.score} / ${data.target} transactions.`, 4000);
        } else {
            console.warn('UIScene: data not available for handleSurgeEndedByPlayer.');
        }
        if (this.surgeIndicator) {
            this.surgeIndicator.setVisible(false);
        }
    }

    handleSurgeEndedByServer() {
        this.showNotification('Transaction Rush has ended by server.', 3000);
        if (this.surgeIndicator) {
            this.surgeIndicator.setVisible(false);
        }
    }

}