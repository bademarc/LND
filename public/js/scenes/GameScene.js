export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.nodes = [];
        this.webSocket = null;
    }

    init(data) {
        // Data passed from other scenes, if any
        console.log('GameScene: Initializing with data:', data);
    }

    preload() {
        // Assets for this scene specifically, if not loaded in BootScene
        console.log('GameScene: Preload method called.');
    }

    create() {
        console.log('GameScene: Create method called.');
        this.cameras.main.setBackgroundColor('#0a0a23'); // Dark blue space-like background

        // Example: Add a title or placeholder text
        this.add.text(this.cameras.main.width / 2, 50, 'LayerEdge Network Defender - Game Area', {
            font: '28px Orbitron, sans-serif', // Using a futuristic font
            fill: '#00ff00'
        }).setOrigin(0.5);

        // Initialize WebSocket connection
        this.connectWebSocket();

        // Example: Create a player node (this would be more dynamic)
        this.createPlayerNode(this.cameras.main.width / 2, this.cameras.main.height / 2, 'node_default', 'MyNode');

        // Setup input handlers or game loops
        this.input.on('pointerdown', (pointer) => {
            // Example: interact with nodes or place new ones
            console.log(`Pointer down at x: ${pointer.x}, y: ${pointer.y}`);
            // this.createPlayerNode(pointer.x, pointer.y, 'node_default', `Node-${this.nodes.length + 1}`);
            // Send action to server via WebSocket
            if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
                this.webSocket.send(JSON.stringify({ type: 'player_action', action: 'click', x: pointer.x, y: pointer.y }));
            }
        });

        // Listen for events from UIScene (e.g., button clicks)
        this.events.on('ui_event', this.handleUIEvent, this);
        // Listen for chat messages to send from UIScene
        this.events.on('send_chat_message', this.sendChatMessageToServer, this);
    }

    update(time, delta) {
        // Game loop logic
        // Example: move nodes, check for collisions, update game state
    }

    connectWebSocket() {
        // Determine WebSocket protocol based on window.location.protocol
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.hostname}:${window.location.port || (wsProtocol === 'wss:' ? 443 : 80)}`;
        
        this.webSocket = new WebSocket(wsUrl);

        this.webSocket.onopen = () => {
            console.log('GameScene: Connected to WebSocket server.');
            this.webSocket.send(JSON.stringify({ type: 'join_game', playerId: `player_${Date.now()}` }));
            // Notify UI scene about connection status
            this.scene.get('UIScene').events.emit('websocket_status', { connected: true });
        };

        this.webSocket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('GameScene: Message from server:', message);
                this.handleServerMessage(message);
            } catch (error) {
                console.error('GameScene: Error parsing message from server:', error);
            }
        };

        this.webSocket.onerror = (error) => {
            console.error('GameScene: WebSocket error:', error);
            this.scene.get('UIScene').events.emit('websocket_status', { connected: false, error: 'Connection error' });
        };

        this.webSocket.onclose = () => {
            console.log('GameScene: Disconnected from WebSocket server.');
            this.scene.get('UIScene').events.emit('websocket_status', { connected: false, error: 'Disconnected' });
        };
    }

    handleServerMessage(message) {
        // Process messages from the server (e.g., game state updates, new players, attacks)
        switch (message.type) {
            case 'connection_ack':
                console.log('Server Acknowledged Connection:', message.message);
                break;
            case 'game_state_update':
                // Update local game state based on server data
                // e.g., update node positions, resources, etc.
                break;
            case 'new_player_joined':
                // Add representation for new player
                break;
            case 'player_left':
                // Remove representation for player who left
                break;
            case 'network_event': // e.g., transaction surge, attack
                this.scene.get('UIScene').showNotification(`Network Event: ${message.details}`);
                break;
            case 'chat_message': // Handle incoming chat messages from server
                console.log('GameScene: Received chat message:', message);
                this.scene.get('UIScene').events.emit('chat_message_received', message);
                break;
            case 'broadcast':
                console.log('Broadcast from another client:', message.data);
                // Potentially show other player actions
                break;
            default:
                console.log('GameScene: Received unhandled message type:', message.type);
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
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.send(JSON.stringify({ type: 'ui_action', action: event.action, details: event.details }));
        }
        // Handle actions like 'upgrade_node', 'allocate_resource', etc.
    }

    sendChatMessageToServer(chatData) {
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.send(JSON.stringify({ type: 'chat_message', payload: chatData }));
            console.log('GameScene: Sent chat message to server:', chatData);
        } else {
            console.warn('GameScene: WebSocket not open. Chat message not sent.');
            // Optionally, notify UI that message failed to send
            this.scene.get('UIScene').showNotification('Chat: Connection offline.', 2000);
        }
    }

    // Make sure to clean up WebSocket connection when the scene is shut down
    shutdown() {
        if (this.webSocket) {
            this.webSocket.close();
        }
        this.events.off('ui_event', this.handleUIEvent, this);
        this.events.off('send_chat_message', this.sendChatMessageToServer, this);
        console.log('GameScene: Shutdown, WebSocket closed.');
    }
}