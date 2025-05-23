# LayerEdge Network Defender

## Overview

LayerEdge Network Defender is a multiplayer online strategy/simulation game where players act as nodes in a decentralized blockchain network. The game is inspired by LayerEdge's mission to enhance Bitcoin's capabilities using technologies like ZK proofs and BitVM. Players collaborate and compete to maintain the network’s security, efficiency, and growth while facing real-time challenges and threats.

This project is being developed step-by-step based on the detailed [Game Design Document](./gamedesign.md).

## Tech Stack

*   **Frontend:** JavaScript with [Phaser 3](https://phaser.io/) for 2D game development.
*   **Backend:** Node.js with [Express](https://expressjs.com/) and [WebSockets (ws)](https://github.com/websockets/ws) for real-time multiplayer communication.
*   **Database:** (Planned) MongoDB Atlas (free tier) for persistent storage.
*   **Development Environment:** The game design mentions Codesphere, but local development is also supported.

## Project Structure

```
LayerEdge Network Defender/
├── public/                   # Client-side static assets (HTML, CSS, JS, images, audio)
│   ├── assets/
│   │   ├── images/           # Game images (SVG format preferred)
│   │   └── spritesheets/     # Spritesheets for animations
│   ├── audio/                # Game audio files
│   ├── js/
│   │   ├── scenes/           # Phaser scenes (BootScene, GameScene, UIScene, etc.)
│   │   └── main.js           # Main Phaser game initialization script
│   └── index.html            # Main HTML file for the game client
├── server/                   # Backend Node.js application
│   ├── package.json          # Server dependencies and scripts
│   └── server.js             # Main server logic (Express, WebSockets)
├── gamedesign.md             # Detailed game design document
├── package.json              # Root project configuration, scripts for client & server
└── README.md                 # This file
```

## Prerequisites

*   [Node.js](https://nodejs.org/) (which includes npm) installed on your system.

## Setup and Installation

1.  **Clone the repository (if applicable) or ensure you have the project files.**

2.  **Install root dependencies:**
    Open a terminal in the project root directory (`LayerEdge Network Defender/`) and run:
    ```bash
    npm install
    ```

3.  **Install server dependencies:**
    Navigate to the server directory and install its dependencies:
    ```bash
    cd server
    npm install
    cd ..
    ```
    Alternatively, you can use the combined script from the root `package.json` (if you have run `npm install` in root first):
    ```bash
    npm run install:all 
    ```
    *(Note: The `client/package.json` is not yet part of this initial setup as the client is served statically by the Node.js server for this Phaser game.)*

## Running the Game

1.  **Start the Backend Server:**
    From the project root directory, run:
    ```bash
    npm run start:server
    ```
    Or for development with automatic restarts (requires `nodemon` installed globally or as a dev dependency in `server/package.json`):
    ```bash
    npm run dev:server
    ```
    The server will typically start on `http://localhost:3000`.

2.  **Access the Game Client:**
    Open your web browser and navigate to:
    ```
    http://localhost:3000
    ```
    The `index.html` file from the `public` directory will be served, loading the Phaser game.

## Development Notes

*   **Client-Side:** The client-side game is built with Phaser 3. All client code resides in the `public` directory. Changes to these files will be reflected when you refresh the browser, as they are served statically.
*   **Server-Side:** The server uses Node.js, Express, and WebSockets. If using `npm run dev:server`, `nodemon` will automatically restart the server upon changes to server files.
*   **Assets:** Place all static assets (images, audio, spritesheets) in the appropriate subdirectories within `public/assets/`.
*   **Codesphere:** While the game design mentions Codesphere for online deployment, this README focuses on local development. For Codesphere, you would typically push your code to a Git repository linked to your Codesphere workspace and configure the run commands there.

## Next Steps (Based on Game Design)

*   Implement core gameplay mechanics in `GameScene.js` (transaction verification, resource management).
*   Develop the visual blockchain dashboard in `UIScene.js`.
*   Integrate MongoDB for persistent data storage.
*   Expand on node specialization, dynamic events, and other features outlined in `gamedesign.md`.

## Contributing

(Placeholder for contribution guidelines if this were an open project)