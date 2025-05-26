export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Display a loading message or progress bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Loading LayerEdge Network Defender...',
            style: {
                font: '24px monospace',
                fill: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);

        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 30, 320, 50);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x33ff33, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 20, 300 * value, 30);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            this.startGame();
        });

        // Load assets here
        // Example: this.load.image('logo', 'assets/images/logo.png');
        // Example: this.load.audio('backgroundMusic', 'audio/theme.mp3');
        
        // Placeholder for assets - replace with actual game assets
        this.load.svg('node_default', '../assets/images/node_default.svg'); // Using Phaser's SVG loader
        this.load.svg('node_security', '../assets/images/node_security.svg');
        this.load.svg('node_processor', '../assets/images/node_processor.svg');
        this.load.svg('node_consensus', '../assets/images/node_consensus.svg');
        this.load.svg('button_bg', '../assets/images/button_bg.svg'); // Changed to SVG
        // For spritesheets, PNG is typical. If using SVG for a placeholder spritesheet, ensure Phaser handles it or use a simple image load.
        // For now, let's assume a placeholder SVG for 'explosion' if it's a single frame or simple animation.
        // If it's a complex spritesheet, a PNG would be better. Let's use a single SVG image for placeholder.
        this.load.svg('explosion_placeholder', '../assets/spritesheets/explosion_placeholder.svg');

        // Load Meme Icons
        this.load.svg('icon_doge', '../assets/images/icon_doge.svg');
        this.load.svg('icon_stonks', '../assets/images/icon_stonks.svg');

        // Load audio assets (ensure they are in public/audio)
        // this.load.audio('transaction_sfx', '../audio/transaction.wav');
        // this.load.audio('attack_sfx', '../audio/attack.mp3');

        console.log('BootScene: Preloading assets...');
    }

    create() {
        // This scene transitions to GameScene after assets are loaded (handled by 'complete' event)
        console.log('BootScene: Create method called. Assets should be loading or loaded.');
    }

    startGame() {
        console.log('BootScene: Assets loaded, starting GameScene and UIScene.');
        this.scene.start('GameScene');
        this.scene.launch('UIScene'); // Launch UI scene to run in parallel
    }
}