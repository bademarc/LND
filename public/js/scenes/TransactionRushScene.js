class TransactionRushScene extends Phaser.Scene {
    constructor() {
        super('TransactionRushScene');
    }

    init(data) {
        this.surgeDuration = data.duration || 30000; // Default to 30s if not provided
        this.targetVerifications = data.targetVerifications || 50; // Default to 50 if not provided
        this.verifications = 0;
        this.timeLeft = this.surgeDuration / 1000; // Initial time left in seconds
        this.targetVerifications = data.targetVerifications || 50;
        this.verifications = 0;
        this.timer = null;
        this.network = data.network; // Store the network reference
        this.gameEnded = false;
    }

    preload() {
        // Load the new SVG button asset
        this.load.svg('verify_button_rush_asset', 'assets/images/verify_button_rush.svg');
    }

    create() {
        // Background overlay
        this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7).setOrigin(0);

        // Title Text
        this.add.text(this.cameras.main.width / 2, 100, 'Transaction Rush!', { font: '48px Orbitron', fill: '#ffab00' }).setOrigin(0.5);

        // Timer Display
        this.timeLeftText = this.add.text(this.cameras.main.width / 2, 180, `Time Left: ${this.timeLeft}s`, { font: '32px Orbitron', fill: '#ffffff' }).setOrigin(0.5);

        // Verification Count Display
        this.verificationsText = this.add.text(this.cameras.main.width / 2, 240, `Verified: ${this.verifications} / ${this.targetVerifications}`, { font: '32px Orbitron', fill: '#00ff00' }).setOrigin(0.5);

        // "Verify Transaction" Button - Using the loaded SVG asset
        const buttonX = this.cameras.main.width / 2;
        const buttonY = this.cameras.main.height / 2 + 40; // Adjusted Y position

        this.verifyButton = this.add.sprite(buttonX, buttonY, 'verify_button_rush_asset')
            .setInteractive({ useHandCursor: true });

        // Event listeners for the button
        this.verifyButton.on('pointerdown', () => { if (!this.gameEnded) this.handleVerificationClick(); });
        this.verifyButton.on('pointerover', () => { if (!this.gameEnded) this.verifyButton.setAlpha(0.8); });
        this.verifyButton.on('pointerout', () => this.verifyButton.setAlpha(1.0));

        // Instructions Text
        this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 120, 'Click the button as fast as you can!', { font: '20px Orbitron', fill: '#cccccc' }).setOrigin(0.5);

        // Countdown Timer Logic
        this.timer = this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });
    }

    handleVerificationClick() {
        if (this.gameEnded) {
            return;
        }
        this.verifications++;
        this.verificationsText.setText(`Verified: ${this.verifications} / ${this.targetVerifications}`);
        
        // Visual Feedback
        this.cameras.main.flash(50, 0, 255, 0); // Quick green flash

        // Audio Feedback (Placeholder)
        console.log('Verify click sound placeholder');

        // Send verification to server (if network is available)
        if (this.network && this.network.isSocketOpen()) {
            this.network.sendVerificationAttempt(this.verifications); // Assuming this method exists in NetworkManager
        }
    }

    updateTimer() {
        if (this.gameEnded) {
            return;
        }
        this.timeLeft--;
        this.timeLeftText.setText(`Time Left: ${this.timeLeft}s`);

        if (this.timeLeft <= 0) {
            this.timeLeft = 0; // Ensure it doesn't go negative if endRush has a delay
            this.timeLeftText.setText(`Time Left: ${this.timeLeft}s`); // Update text one last time
            this.endRush();
        }
    }

    endRush() {
        if (this.gameEnded) return; // Prevent multiple calls
        this.gameEnded = true;

        if (this.timer) {
            this.timer.remove(false); // Pass false to prevent callback from firing again
            this.timer = null;
        }
        console.log(`Transaction Rush Ended! Score: ${this.verifications}`);

        // Disable the verify button
        if (this.verifyButton) {
            this.verifyButton.disableInteractive();
            this.verifyButton.setAlpha(0.5);
        }
        
        // Display "Time's Up!" message
        this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 180, // Adjusted Y
            "Time's Up!", { font: '40px Orbitron', fill: '#ff0000' }
        ).setOrigin(0.5);

        // Send Score to GameScene after a delay
        this.time.delayedCall(2000, () => {
            this.events.emit('transaction_rush_complete', {
                score: this.verifications,
                target: this.targetVerifications
            });
            // Make sure GameScene is resumed/started if it was paused/stopped
            // For now, just stopping this scene. GameScene should handle reactivation.
            this.scene.stop(); 
        });
    }
}

// Export the class for main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TransactionRushScene;
} else {
    window.TransactionRushScene = TransactionRushScene;
}
