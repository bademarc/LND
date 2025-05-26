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

// Meme Definitions
let serverMemes = [
    { id: 'meme1', name: 'Classic Doge', currentHypeInvestment: 0, iconKey: 'icon_doge', investorsThisCycle: {} },
    { id: 'meme2', name: 'Stonks Guy', currentHypeInvestment: 0, iconKey: 'icon_stonks', investorsThisCycle: {} }
];
const MIN_HYPE_TO_GO_VIRAL = 50; 
const MIN_VIRALITY_SCORE_THRESHOLD = 30; 
const VIRAL_REWARD_AMOUNT = 500; 

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
    const initialHype = 100;
    playerData.set(ws.playerId, { resources: initialResources, hype: initialHype, id: ws.playerId });
    const player = playerData.get(ws.playerId); // Get reference for use in connection_ack
    console.log(`Client ${ws.playerId} connected. Initialized with ${initialResources} resources and ${initialHype} hype.`);

    // Send a welcome message with playerId and resources
    ws.send(JSON.stringify({ 
        type: 'connection_ack', 
        message: 'Welcome to LayerEdge Network Defender!',
        playerId: ws.playerId,
        currentResources: player.resources,
        currentHype: player.hype,
        serverMemes: serverMemes.map(m => ({ id: m.id, name: m.name, currentHypeInvestment: m.currentHypeInvestment, iconKey: m.iconKey })) // Send current meme status
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
                case 'invest_hype':
                    if (!player) { // Should have been caught earlier, but double check
                        console.error(`Player data not found for invest_hype from ${ws.playerId}.`);
                        return;
                    }
                    const meme = serverMemes.find(m => m.id === parsedMessage.memeId);
                    if (!meme) {
                        console.error(`Meme ${parsedMessage.memeId} not found for investment by ${ws.playerId}.`);
                        ws.send(JSON.stringify({ type: 'error', message: `Meme ${parsedMessage.memeId} not found.`}));
                        return;
                    }
                    const amount = parseInt(parsedMessage.amount, 10);
                    if (isNaN(amount) || amount <= 0 || player.hype < amount) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Insufficient hype or invalid amount.' }));
                        return;
                    }

                    player.hype -= amount;
                    meme.currentHypeInvestment += amount;
                    meme.investorsThisCycle[ws.playerId] = (meme.investorsThisCycle[ws.playerId] || 0) + amount;
                    
                    playerData.set(ws.playerId, player); // Save player changes

                    ws.send(JSON.stringify({ type: 'update_player_hype', newHypeAmount: player.hype }));
                    
                    broadcast({ 
                        type: 'all_memes_status_update', 
                        memes: serverMemes.map(m => ({ id: m.id, name: m.name, currentHypeInvestment: m.currentHypeInvestment, iconKey: m.iconKey })) 
                    });
                    console.log(`Player ${ws.playerId} invested ${amount} hype in ${meme.name}. Player Hype: ${player.hype}. Meme Hype: ${meme.currentHypeInvestment}`);
                    break;
                case 'transaction_score':
                    if (!player) return; // Player context already checked
                    console.log(`Received transaction_score from ${ws.playerId}: ${parsedMessage.score} / ${parsedMessage.target}`);
                    
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
                case 'rush_verification_attempt': // Placeholder
                    // console.log(`Player ${ws.playerId} verification attempt: ${parsedMessage.count}`);
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

function calculateViralSpread() {
    console.log('Calculating viral spread...');
    let winningMeme = null;
    let maxViralityScore = 0;

    serverMemes.forEach(meme => {
        if (meme.currentHypeInvestment < MIN_HYPE_TO_GO_VIRAL) {
            console.log(`Meme ${meme.name} has ${meme.currentHypeInvestment} hype, less than ${MIN_HYPE_TO_GO_VIRAL} required. Not eligible for virality.`);
            return; // continue to next meme
        }

        let viralityScore = meme.currentHypeInvestment * Math.random(); // Randomness factor
        console.log(`Meme ${meme.name} current investment: ${meme.currentHypeInvestment}, calculated virality score: ${viralityScore}`);

        if (viralityScore > maxViralityScore) {
            maxViralityScore = viralityScore;
            winningMeme = meme;
        }
    });

    if (winningMeme && maxViralityScore >= MIN_VIRALITY_SCORE_THRESHOLD) {
        console.log(`Meme '${winningMeme.name}' went viral with score ${maxViralityScore}!`);
        let investorPlayerIds = Object.keys(winningMeme.investorsThisCycle);

        if (investorPlayerIds.length > 0) {
            broadcast({ 
                type: 'meme_viral_event', 
                memeId: winningMeme.id, 
                memeName: winningMeme.name, 
                investorPlayerIds: investorPlayerIds, 
                rewardAmount: VIRAL_REWARD_AMOUNT, 
                message: `${winningMeme.name} went VIRAL! Investors got ${VIRAL_REWARD_AMOUNT} resources!` 
            });

            for (const pId of investorPlayerIds) {
                const investorObject = playerData.get(pId);
                if (investorObject) {
                    investorObject.resources += VIRAL_REWARD_AMOUNT;
                    playerData.set(pId, investorObject); // Update server-side data
                    
                    for (const client of wss.clients) {
                        if (client.playerId === pId && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'update_resources',
                                newTotal: investorObject.resources,
                                changeAmount: VIRAL_REWARD_AMOUNT,
                                reason: `Viral Meme '${winningMeme.name}' Payout`
                            }));
                            break; 
                        }
                    }
                }
            }
        } else {
             console.log(`Meme '${winningMeme.name}' went viral, but had no tracked investors in investorsThisCycle.`);
        }
    } else {
        console.log('No meme reached viral status this cycle or met the virality score threshold.');
        // Optionally broadcast a "no_viral_event"
        // broadcast({ type: 'no_viral_event', message: 'No meme went viral this cycle.' });
    }

    // Reset for next cycle
    console.log('Resetting meme investments for next cycle.');
    serverMemes.forEach(m => {
        m.currentHypeInvestment = 0;
        m.investorsThisCycle = {};
    });
    broadcast({ 
        type: 'all_memes_status_update', 
        memes: serverMemes.map(m => ({ id: m.id, name: m.name, currentHypeInvestment: m.currentHypeInvestment, iconKey: m.iconKey })) 
    });
}

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
        
        // Start periodic calculation for viral spread
        setInterval(calculateViralSpread, 120000); // Every 2 minutes
        console.log(`Periodic viral spread calculation started. Interval: 120000ms`);
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
    broadcast,
    serverMemes, // For testing
    calculateViralSpread, // For testing
    MIN_HYPE_TO_GO_VIRAL, // For testing
    MIN_VIRALITY_SCORE_THRESHOLD, // For testing
    VIRAL_REWARD_AMOUNT // For testing
    // Note: Direct testing of on-message logic for 'transaction_score' is hard without refactoring
    // The core logic is inside wss.on('connection', ws => ws.on('message', ...))
    // A full test would require mocking a WebSocket connection and triggering the message event.
};