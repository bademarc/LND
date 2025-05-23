const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
// const { MongoClient } = require('mongodb'); // Placeholder for MongoDB connection

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
// const MONGODB_URI = process.env.MONGODB_URI; // || 'mongodb://localhost:27017/layeredge_defender'; // Placeholder for MongoDB URI
// let db;

// Serve static files from the 'public' directory (client-side game)
// The 'public' directory should be at the root of the project, sibling to 'server' and 'client' folders.
app.use(express.static(path.join(__dirname, '..', 'public')));

// WebSocket server logic
wss.on('connection', (ws) => {
    console.log('Client connected');

    // Example: Send a welcome message
    ws.send(JSON.stringify({ type: 'connection_ack', message: 'Welcome to LayerEdge Network Defender!' }));

    ws.on('message', (message) => {
        console.log('Received: %s', message);
        try {
            const parsedMessage = JSON.parse(message);
            // Handle incoming messages based on type
            if (parsedMessage.type === 'chat_message') {
                // Broadcast chat message to all clients, including sender
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ 
                            type: 'chat_message', 
                            payload: parsedMessage.payload, // Assuming payload contains { user: 'username', text: 'message content' }
                            timestamp: new Date().toISOString()
                        }));
                    }
                });
            } else {
                // Handle other game-related messages (broadcast to others)
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'broadcast', data: parsedMessage, sender: 'other' }));
                    }
                });
            }
        } catch (error) {
            console.error('Failed to parse message or handle client message:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format.' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
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

module.exports = { app, server, wss }; // Export for potential testing or extension