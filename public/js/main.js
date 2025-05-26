// Import scenes if they are in separate files (good practice for larger games)
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';
import TransactionRushScene from './scenes/TransactionRushScene.js';

const config = {
    type: Phaser.AUTO, // Phaser will try to use WebGL, and fall back to Canvas if it's not available
    width: 1280,       // Game width in pixels
    height: 720,      // Game height in pixels
    parent: 'game-container', // ID of the DOM element to add the canvas to
    backgroundColor: '#000015', // A dark background, can be overridden by scenes
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // No gravity in a top-down or UI-focused game
            debug: false // Set to true for physics debugging visuals
        }
    },
    scene: [
        BootScene, // First scene to load assets
        GameScene, // Main gameplay scene
        UIScene,   // UI overlay scene (dashboard, etc.)
        TransactionRushScene // Transaction Rush mini-game scene
    ],
    scale: {
        mode: Phaser.Scale.FIT, // Scale the game to fit the parent container
        autoCenter: Phaser.Scale.CENTER_BOTH // Center the game canvas
    }
};

// Initialize the game instance
const game = new Phaser.Game(config);

// Global WebSocket connection (or manage it within a scene/service)
// Example: const socket = new WebSocket('ws://localhost:3000');
// socket.onopen = () => console.log('Connected to WebSocket server');
// socket.onmessage = (event) => {
//     const message = JSON.parse(event.data);
//     console.log('Message from server:', message);
//     // Pass the message to the active scene or a global event bus
//     game.scene.getScenes(true).forEach(scene => {
//         if (scene.handleServerMessage) {
//             scene.handleServerMessage(message);
//         }
//     });
// };
// socket.onerror = (error) => console.error('WebSocket error:', error);
// socket.onclose = () => console.log('Disconnected from WebSocket server');

// Make socket globally available or manage through a registry/plugin
// game.registry.set('socket', socket);

export default game;