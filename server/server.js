const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
// const { MongoClient } = require('mongodb'); // Placeholder for MongoDB connection

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Player Data Storage
const playerData = new Map();

// Global Surge State
let isSurgeActive = false;
let surgeTimeoutId = null;

// const MONGODB_URI = process.env.MONGODB_URI; // || 'mongodb://localhost:27017/layeredge_defender'; // Placeholder for MongoDB URI
// let db;

// Serve static files from the 'public' directory (client-side game)
// The 'public' directory should be at the root of the project, sibling to 'server' and 'client' folders.
app.use(express.static(path.join(__dirname, '..', 'public')));

// Broadcasting Helper
function broadcast(messageObject) {
    const messageString = JSON.stringify(messageObject);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}

// Transaction Surge Functions
function startTransactionSurge() {
    if (isSurgeActive) {
        console.log('Surge is already active. Ignoring request to start a new surge.');
        return;
    }
    isSurgeActive = true;
    const surgeDuration = 30000; // 30 seconds
    const targetVerifications = 50;

    const message = {
        type: 'transaction_surge_start',
        duration: surgeDuration,
        target: targetVerifications,
        timestamp: new Date().toISOString()
    };
    broadcast(message);
    console.log(`Transaction surge started! Duration: ${surgeDuration / 1000}s, Target: ${targetVerifications} verifications.`);

    surgeTimeoutId = setTimeout(endTransactionSurge, surgeDuration);
}

function endTransactionSurge() {
    if (!isSurgeActive) {
        console.log('No surge is active to end.');
        return;
    }
    isSurgeActive = false;
    if (surgeTimeoutId) {
        clearTimeout(surgeTimeoutId);
        surgeTimeoutId = null;
    }

    const message = {
        type: 'transaction_surge_end',
        timestamp: new Date().toISOString()
    };
    broadcast(message);
    console.log('Transaction surge ended.');
}

// WebSocket server logic
wss.on('connection', (ws) => {
    // Generate unique playerId
    ws.playerId = Date.now().toString() + Math.random().toString(36).substring(2);
    
    // Initialize player data
    const initialResources = 1000;
    playerData.set(ws.playerId, { resources: initialResources, id: ws.playerId });
    console.log(`Client ${ws.playerId} connected. Initialized with ${initialResources} resources.`);

    // Send a welcome message with playerId and resources
    ws.send(JSON.stringify({ 
        type: 'connection_ack', 
        message: 'Welcome to LayerEdge Network Defender!',
        playerId: ws.playerId,
        currentResources: initialResources
    }));

    // Trigger surge for testing (if not already active)
    // This logic might be adjusted based on game design (e.g., needs more players to start)
    if (!isSurgeActive && wss.clients.size === 1) { // Example: Start surge if it's the first client or surge isn't active
        console.log('No surge active. Scheduling a new surge in 5 seconds.');
        setTimeout(() => {
            // Check again before starting, in case another connection triggered it
            if (!isSurgeActive) {
                startTransactionSurge();
            }
        }, 5000); // Start surge 5 seconds after connection if not already active
    }


    ws.on('message', (message) => {
        console.log('Received: %s', message);
        try {
            const parsedMessage = JSON.parse(message);
            
            // Ensure player context for messages that need it
            const player = playerData.get(ws.playerId);
            if (!player && (parsedMessage.type === 'transaction_score' || parsedMessage.type === 'rush_verification_attempt')) {
                console.error(`Player data not found for ${ws.playerId} for message type ${parsedMessage.type}. Ignoring.`);
                ws.send(JSON.stringify({ type: 'error', message: 'Player session not found. Please reconnect.' }));
                return;
            }

            // Handle incoming messages based on type
            switch (parsedMessage.type) {
                case 'chat_message':
                    broadcast({ 
                        type: 'chat_message', 
                        payload: parsedMessage.payload,
                        timestamp: new Date().toISOString()
                    });
                    break;
                case 'transaction_score':
                    console.log(`Received transaction_score from ${ws.playerId}: ${parsedMessage.score} / ${parsedMessage.target}`);
                    
                    // Basic validation: Score processing is more lenient here, assuming it arrives during/soon after surge
                    // A more robust solution would involve server-side state tracking of player participation in a surge.
                    // if (!isSurgeActive) {
                    //     console.log(`Score from ${ws.playerId} received while surge is not active. Ignoring.`);
                    //     return; // Or send an error/info message
                    // }

                    const rewardPerVerification = 10;
                    let earnedResources = parsedMessage.score * rewardPerVerification;

                    if (parsedMessage.score >= parsedMessage.target) {
                        earnedResources *= 1.5; // 50% bonus for meeting target
                        console.log(`Bonus applied for ${ws.playerId} meeting target.`);
                    }
                    
                    player.resources += Math.floor(earnedResources);
                    playerData.set(ws.playerId, player);

                    const resourceUpdateMsg = {
                        type: 'update_resources',
                        newTotal: player.resources,
                        changeAmount: Math.floor(earnedResources),
                        reason: 'Transaction Rush Reward'
                    };
                    ws.send(JSON.stringify(resourceUpdateMsg));
                    console.log(`Awarded ${Math.floor(earnedResources)} resources to ${ws.playerId}. New total: ${player.resources}`);
                    break;
                case 'rush_verification_attempt': // Placeholder for potential server-side validation if needed later
                    // console.log(`Player ${ws.playerId} verification attempt: ${parsedMessage.count}`);
                    // This message type is currently handled client-side primarily for the mini-game itself.
                    // Server might log it or use it for anti-cheat in the future.
                    break;
                default:
                    // Handle other game-related messages (broadcast to others)
                    wss.clients.forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            // Ensure the 'other' client has a session
                            if (playerData.has(client.playerId)) {
                                client.send(JSON.stringify({ type: 'broadcast', data: parsedMessage, sender: ws.playerId }));
                            }
                        }
                    });
                    break;
            }
        } catch (error) {
            console.error(`Failed to parse message or handle client message from ${ws.playerId || 'unknown client'}:`, error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format.' }));
        }
    });

    ws.on('close', () => {
        if (ws.playerId && playerData.has(ws.playerId)) {
            playerData.delete(ws.playerId);
            console.log(`Client ${ws.playerId} disconnected and data removed.`);
        } else {
            console.log('Client disconnected (no playerId or data found).');
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${ws.playerId || 'unknown'}:`, error);
    });
});

// Placeholder for MongoDB connection function
/*
async function connectDB() {
    if (db) return db;
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(); // Defaults to the database specified in MONGODB_URI
        console.log('Successfully connected to MongoDB');
        return db;
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
}
*/

async function startServer() {
    // await connectDB(); // Connect to DB before starting server
    server.on('error', (error) => {
        console.error('Server failed to start:', error);
        if (error.code === 'EADDRINUSE') {
            console.error(`Error: Port ${PORT} is already in use.`);
        }
        process.exit(1); // Exit if server fails to start
    });

    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        console.log(`Game client should be accessible at http://localhost:${PORT}`);
    });
}

startServer();

// For testing purposes
module.exports = { 
    app, 
    server, 
    wss,
    playerData,
    getIsSurgeActive: () => isSurgeActive, // Getter to access isSurgeActive
    getSurgeTimeoutId: () => surgeTimeoutId, // Getter for surgeTimeoutId
    __setSurgeActive: (value) => isSurgeActive = value, // Setter for testing
    __setSurgeTimeoutId: (value) => surgeTimeoutId = value, // Setter for testing
    startTransactionSurge,
    endTransactionSurge,
    broadcast // Export broadcast if needed for specific tests, or to mock its behavior
    // Note: Direct testing of on-message logic for 'transaction_score' is hard without refactoring
    // The core logic is inside wss.on('connection', ws => ws.on('message', ...))
    // A full test would require mocking a WebSocket connection and triggering the message event.
};