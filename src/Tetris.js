"use strict";

/*
	Main Tetris game logic using Canvas API and Vanilla JS.
	Handles rendering, game state, input, and scoring.
*/

// --- Global Variables ---
let ctx;                                // Canvas 2D context
let width;                              // Canvas Width Size
let height;                             // Canvas Height Size
let canvas;                             // Canvas DOM element
let bgImage;                            // Background image
let sizeblock;                          // Block Size
let viewportWidth;                      // Width Screen Size

// --- Game Constants ---
const MAX_HEIGHT = 4;           		// Y threshold for game over
const TIME_FLOW = 300;          		// Drop interval (ms)
const NEXT_SPEED = 500;         		// Score threshold for speed up
const BOX_COLLIDER = 2;         		// Collision check depth
const BONUS_SCORE = 100;        		// Score per cleared line
const MOVE_COOLDOWN = 150;      		// Touch move debounce (ms)

// --- Audio Elements ---
const bgMusic = document.getElementById('background-music');
const bonusSound = document.getElementById('line-clear-sound');
const gameOverSound = document.getElementById('game-over-sound');

// --- Font Elements ---
const font = new FontFace('Chewy', 'url(/fonts/Chewy-Regular.ttf)');
font.load()
    .then(async () => {
        document.fonts.add(font);

        // --- Create the Game ---
        const game = new Game();
        await game.initGame();
    })
    .catch((err) => {
        console.error(`Failed to load font: ${err}`);
    });

// --- Tetromino Definitions ---
const TETROMINOES = {
	'L': { color: 'orange', shape: [[8,4],[8,3],[9,3],[10,3],[11,3]] }, 
	'T': { color: 'yellow', shape: [[9,2],[8,3],[9,3],[10,3]] }, 
	'O': { color: 'blue', shape: [[9,2],[10,2],[9,3],[10,3]] }, 
	'I': { color: 'green', shape: [[8,2],[9,2],[10,2],[11,2]] }, 
	'J': { color: 'purple', shape: [[8,2],[9,2],[10,2],[11,2],[11,3]] }
};

// --- Block Gradient Colors ---
const GRADIENT_COLORS = {
	'orange': { lightColor: '#FFD700', darkColor: '#FF8C00' },
	'yellow': { lightColor: '#FFFF99', darkColor: '#FFD700' },
	'blue': { lightColor: '#6495ED', darkColor: '#0000CD' }, 
	'green': { lightColor: '#7FFF00', darkColor: '#006400' },
	'purple': { lightColor: '#DA70D6', darkColor: '#8A2BE2' },
	'red': { lightColor: '#FF6347', darkColor: '#8B0000' },
	'pink': { lightColor: '#FFB6C1', darkColor: '#FF69B4' }
};

/*
	Block class represents a tetromino.
	Handles drawing, movement, collision and rotation.
*/
export class Block {
    constructor(coord, color, sign, game) {
        // Deep copy coordinates to avoid mutation
        this.coord = JSON.parse(JSON.stringify(coord));
        this.color = color;
        this.sign = sign;
        this.game = game;
    }

    // Draws the block on the canvas
    draw() {
        for (let coord of this.coord) 
            drawBlock(coord, this.color, ctx);
    }

    // Moves the block down by one cell (gravity)
    gravity() {
        this.coord = this.coord.map(([x, y]) => [x, y + 1]);
    }

    // Fixes the block in the scene and records its position
    staticInScene() {
        this.game.currentBlock = null;
        this.game.storeBlock.push({ coord: this.coord, color: this.color });
        for (let [x, y] of this.coord)
            this.game.storeCoord[x][y] = 'full';
    }

    // Moves the block in the specified direction ('left', 'right', 'down')
    direction(direction) {
        this.coord = this.coord.map(([x, y]) => {
            switch(direction) {
                case 'left':
                    return [x - 1, y];
                case 'right':
                    return [x + 1, y];
                default:
                    return [x, y + 1];
            }
        });
    }

    // Rotates the block with SRS (Super Rotation System)
    rotation() {
        let newCoords = [];
        const [px, py] = this.coord[2]; // Pivot point
        if (this.sign === 'O') return; // O-block does not rotate

        // Calculate rotated positions
        for (let [x, y] of this.coord) {
            let newX = px - (y - py),
                newY = py + (x - px);
            newCoords.push([newX, newY]);
        }

        // Check for wall or block collision after rotation
        let isWallsKicked = false;
        for (let [x, y] of newCoords) {
            if (x < 0 || x > this.game.numberBlockWidth - 1 
                || y < 0 || y > this.game.numberBlockHeight - 1 
                || this.game.storeCoord[x][y] === 'full') {
                isWallsKicked = true;
                break;
            }
        }

        // Apply rotation if no collision
        if (!isWallsKicked) this.coord = newCoords;
    }

    // Checks if any part of the block collides with the ground
    collisionWithGround() {
        for (let coord of this.coord) {
            if (coord[1] === this.game.numberBlockHeight - 1)
                return true;
        }
        return false;
    }

    // Checks if any part of the block collides with another block
    collisionWithBlock() {
        for (let [x, y] of this.coord) {
            if (this.game.storeCoord[x][y + 1] === 'full') 
                return true;
        }
        return false;
    }

    // Checks collision with left wall or block
    allLeftCollision() {
        for (let [x, y] of this.coord) {
            if (this.game.storeCoord[x - 1][y] === 'full') 
                return true;
        }
        return false;
    }

    // Checks collision with right wall or block
    allRightCollision() {
        for (let [x, y] of this.coord) {
            if (this.game.storeCoord[x + 1][y] === 'full') 
                return true;
        }
        return false;
    }

    // Checks for probable collision below the block
    probaCollision() {
        for (let [x, y] of this.coord) {
            for (let i = 1; i <= BOX_COLLIDER; i++)
                if (this.game.storeCoord[x][y] === 'full' 
                    || y + i === this.game.numberBlockHeight - 1)
                    return true;
        }
        return false;
    }
}

/* EventManager Class handles touch screen and keyboard events. */
export class EventManager {
    constructor(scene) {
        this.scene = scene;

        this.tapStartX = 0;
        this.tapStartY = 0;
        this.lastMoveTime = 0;
        this.tapStartTime = 0;
    }

    handleTouchStart = (event) => {
        const touch = event.touches?.[0];
        if (!touch || this.scene.isGamePaused) return;

        this.tapStartTime = Date.now();
        this.tapStartX = touch.clientX;
        this.tapStartY = touch.clientY;
    }

    handleTouchEnd = (event) => {
        const touch = event.changedTouches?.[0];
        if (!touch || this.scene.isGamePaused) return;

        const duration = Date.now() - this.tapStartTime;
        const distance = Math.hypot(touch.clientX - this.tapStartX, touch.clientY - this.tapStartY);

        // Tap: Rotate Block or Restart Scene
        if (duration < 300 && distance < 10) {
            if (!this.scene.isSceneLoading) {
                this.scene.restartGame();
            } else if (this.scene.currentBlock) {
                if (!this.scene.currentBlock.collisionWithGround() &&
                    !this.scene.currentBlock.collisionWithBlock())
                this.scene.currentBlock.rotation();
            }
        }
    }

    handleTouchMove = (event) => {
        const touch = event.changedTouches?.[0];
        if (!touch || this.scene.isGamePaused || !this.scene.isSceneLoading || !this.scene.currentBlock) return;

        const deltaX = touch.clientX - this.tapStartX;
        const deltaY = touch.clientY - this.tapStartY;

        const currentTime = Date.now();
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        // Swipe: Move Block in a direction
        if (currentTime - this.lastMoveTime > MOVE_COOLDOWN && Math.max(absDeltaX, absDeltaY) > 10) {
            if (this.scene.currentBlock.collisionWithGround() || this.scene.currentBlock.collisionWithBlock()) return;

            if (absDeltaX > absDeltaY) {
                if (deltaX > 0 && !this.scene.currentBlock.allRightCollision())
                this.scene.currentBlock.direction('right');
                else if (deltaX < 0 && !this.scene.currentBlock.allLeftCollision())
                this.scene.currentBlock.direction('left');
            } else {
                if (deltaY > 0 && !this.scene.currentBlock.probaCollision())
                this.scene.currentBlock.direction('down');
            }

            this.tapStartX = touch.clientX;
            this.tapStartY = touch.clientY;
            this.lastMoveTime = currentTime;
        }
    }

    // -- Keyboard Events --
    handleKeyDown = (event) => {
        let key = event.key,
            newdirection = '';
        const scene = this.scene;

        if (key === 'Enter') 
            return scene.restartGame();
        else if (key === ' ') 
            return scene.pauseGame();

        if (scene.isGamePaused || !scene.isSceneLoading || !scene.currentBlock) return;

        switch (key) {
            case 'ArrowUp':
                if (!scene.currentBlock.collisionWithGround() && !scene.currentBlock.collisionWithBlock())
                    scene.currentBlock.rotation();
            return;
            case 'ArrowDown':
                newdirection = 'down';
            break;
            case 'ArrowLeft':
                newdirection = 'left';
            break;
            case 'ArrowRight':
                newdirection = 'right';
            break;
            default:
            return;
        }

        if (!scene.currentBlock.collisionWithGround() && !scene.currentBlock.collisionWithBlock()) {
            if ((!scene.currentBlock.probaCollision() && newdirection === 'down')
            || (!scene.currentBlock.allLeftCollision() && newdirection === 'left')
            || (!scene.currentBlock.allRightCollision() && newdirection === 'right')
            || (!scene.currentBlock.allLeftCollision() && !scene.currentBlock.allRightCollision()))
            scene.currentBlock.direction(newdirection);
        }
    }
}

/* Game class for the state management. */
export class Game {
    constructor() {
        this.score = 0;
        this.lastScore = 0;
        this.numberBlockWidth = 20;
        this.numberBlockHeight = 30;
        this.currentBlock = null;

        this.lastTime = 0;
        this.dropCounter = 0;
        this.dropInterval = TIME_FLOW;

        this.isGridReady = false;
        this.isGamePaused = false;
        this.isSceneLoading = false;
        this.isBgMusicPlayed = false;
        
        this.storeBlock = [];
        this.storeCoord = [];

        this.eventManager = new EventManager(this);
        this.updateFrame = this.updateFrame.bind(this);
        this.animationId = null;
    }

    // Init the game scene and loads assets
    async initGame() {
        canvas = document.getElementById('canvas');
        ctx = canvas.getContext('2d');

        // Touch listeners
        canvas.addEventListener('touchstart', this.eventManager.handleTouchStart, { passive: true });
        canvas.addEventListener('touchend', this.eventManager.handleTouchEnd, { passive: true });
        canvas.addEventListener('touchmove', this.eventManager.handleTouchMove, { passive: true });

        // Keyboard controls
        document.addEventListener('keydown', this.eventManager.handleKeyDown);

        // Button controls
        document.getElementById('pause').addEventListener('click', () => this.pauseGame());
        document.getElementById('restart').addEventListener('click', () => this.restartGame());

        bgImage = await loadImage('images/background.png');

        this.resizeCanvas();

        ctx.drawImage(bgImage, 0, 0, width, height);
        drawWalls(this);

        this.score = window.localStorage.getItem('score') || 0;
        if (!this.score) window.localStorage.setItem('score', '0');

        displayMessage(`${viewportWidth > 768 ? 'Press Enter' : 'Tap'} to Start 🕹️!`, 2, 0.4);
        displayMessage(this.score, 5, 0.5);
    }

    startLoop() {
        if (this.animationId) return;
        this.animationId = requestAnimationFrame(this.updateFrame);
    }

    stopLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // Main animation loop for the game
    updateFrame(time = 0) {
        const delta = time - this.lastTime;
        this.lastTime = time;

        this.dropCounter += delta;
        if (this.dropCounter >= this.dropInterval) {
            if (!this.isBgMusicPlayed) {
                playSound(bgMusic, true);
                this.isBgMusicPlayed = true;
            }

            this.refreshGame();
            this.dropCounter = 0;
        }

        if (this.isSceneLoading && !this.isGamePaused && !this.gameOver())
            this.animationId = requestAnimationFrame(this.updateFrame);
        else
            this.animationId = null;
    }

    // Handles the logic game in the scene
    refreshGame() {
        if (!this.isGridReady) this.fillGrid();

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(bgImage, 0, 0, width, height);
        drawWalls(this);

        if (!this.currentBlock) {
            const listBlocks = Object.keys(TETROMINOES);
            const randomBlock = Math.floor(Math.random() * listBlocks.length);
            const sign = listBlocks[randomBlock];
            const { shape, color } = TETROMINOES[sign];
            
            this.currentBlock = new Block(shape, color, sign, this);
        }

        this.reduceStack();
        displayMessage(this.score, 5, 0.5);
        drawScene(ctx, this);

        this.currentBlock.draw();
        if (this.currentBlock.collisionWithGround() || this.currentBlock.collisionWithBlock())
            this.currentBlock.staticInScene();
        else
            this.currentBlock.gravity();
    }

    // Toggles the game pause state and music
    pauseGame() {
        if (!this.isSceneLoading) return;

        this.isGamePaused = !this.isGamePaused;
        
        if (this.isGamePaused) {
            this.stopLoop();
            if (bgMusic) bgMusic.pause();
            displayMessage(this.score, 5, 0.5);
            displayMessage('⏸️ Pause ⏸️', 3, 0.25);
        } else {
            if (bgMusic) bgMusic.play();
            this.startLoop();
        }
    }

    // Checks if the game is over (block above MAX_HEIGHT)
    gameOver() {
        let isGameOver = false;
        if (this.isGridReady) {
            for (let i = 1; i < this.numberBlockWidth - 1; i++) {
                if (this.storeCoord[i][MAX_HEIGHT] === 'full') {
                    isGameOver = true;
                    break;
                }
            }
        }

        if (isGameOver) {
            this.stopLoop();

            if (bgMusic) bgMusic.pause();
            playSound(gameOverSound, false);
            this.isSceneLoading = false;

            displayMessage(this.score, 5, 0.5);
            displayMessage('💀 Game Over 💀', 3, 0.2);
            displayMessage(`${viewportWidth > 768 ? 'Press Enter' : 'Tap'} to Restart 🔁!`, 2, 0.3);
        }
        return (isGameOver);
    }

    // Resets all game state and restarts the game
    restartGame() {
        this.score = 0;
        this.lastScore = 0;
        this.currentBlock = null;

        this.lastTime = 0;
        this.dropCounter = 0;
        this.dropInterval = TIME_FLOW;

        this.isGridReady = false;
        this.isGamePaused = false;
        this.isSceneLoading = true;
        this.isBgMusicPlayed = false;

        this.storeBlock = [];
        this.storeCoord = [];

        this.startLoop();
    }

    // Init the grid and fills wall cells as 'full'
    fillGrid() {
        this.isGridReady = true; 
        for (let i = 0; i <= this.numberBlockWidth - 1; i++) {
            this.storeCoord.push([]);
            for (let j = 0; j <= this.numberBlockHeight - 1; j++)
                this.storeCoord[i].push('empty');
        }
        for (let j = 0; j <= this.numberBlockHeight - 1; j++)
            this.storeCoord[0][j] = 'full';
        for (let j = 0; j <= this.numberBlockHeight - 1; j++)
            this.storeCoord[this.numberBlockWidth - 1][j] = 'full';
    }

    // Checks for and clears full lines, updates score and speed
    reduceStack() {
        for (let y = this.numberBlockHeight - 1; y >= 0; y--) {
            let isRowFull = true;
            for (let x = 1; x < this.numberBlockWidth - 1; x++) {
                if (this.storeCoord[x][y] !== 'full') {
                    isRowFull = false;
                    break;
                }
            }

            if (isRowFull) {
                this.score += BONUS_SCORE;
                playSound(bonusSound, false);

                const delta = this.score - this.lastScore;
                if (delta >= NEXT_SPEED) {
                    this.lastScore = this.score;
                    this.dropInterval = Math.max(this.dropInterval - 25, TIME_FLOW - 100);
                }

                if (this.score > Number(window.localStorage.getItem('score')))
                    window.localStorage.setItem('score', this.score.toFixed(0));

                // Clear the row in the grid
                for (let x = 1; x < this.numberBlockWidth - 1; x++)
                    this.storeCoord[x][y] = 'empty';

                // Remove cleared cells from blocks
                for (let i = 0; i < this.storeBlock.length; i++) {
                    this.storeBlock[i].coord = this.storeBlock[i].coord.filter(coord => coord[1] !== y);

                    if (this.storeBlock[i].coord.length === 0) {
                        this.storeBlock.splice(i, 1);
                        i--;
                    }
                }

                // Move above rows down
                for (let aboveY = y - 1; aboveY >= 0; aboveY--) {
                    for (let x = 1; x < this.numberBlockWidth - 1; x++) {
                        if (this.storeCoord[x][aboveY] === 'full') {
                            this.storeCoord[x][aboveY] = 'empty';
                            this.storeCoord[x][aboveY + 1] = 'full';

                            for (let i = 0; i < this.storeBlock.length; i++) {
                                for (let j = 0; j < this.storeBlock[i].coord.length; j++) {
                                    if (this.storeBlock[i].coord[j][0] === x && this.storeBlock[i].coord[j][1] === aboveY)
                                        this.storeBlock[i].coord[j][1] += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Resizes the canvas to fit the container
    resizeCanvas() {
        const container = document.querySelector('.container');
        viewportWidth = container.clientWidth;

        const maxWidth = Math.min(viewportWidth, 440);
        const aspectRatio = 440 / 660;
        const newHeight = maxWidth / aspectRatio;
        
        canvas.width = maxWidth;
        canvas.height = newHeight;

        width = canvas.width;
        height = canvas.height;
        sizeblock = maxWidth / this.numberBlockWidth;
    }
}

// Loads an image and returns a Promise
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => reject(`Failed to load image: ${src}`);
    });
}

// Plays a sound, optionally looping
function playSound(sound, loop) {
    if (sound) {
        sound.volume = 0.6;
        sound.currentTime = 0;
        if (loop) sound.loop = true;
        sound.play().catch(err => console.error(`Failed to play sound: ${err}`));
    }
}

// Displays a message on the canvas at a given position and size
function displayMessage(msg, size, position) {
    ctx.lineWidth = 5;
    ctx.fillStyle = 'black';
    ctx.strokeStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const positionX = width / 2;
    const positionY = height * position;
    
    ctx.font = `${size}rem 'Chewy'`;
    ctx.strokeText(msg, positionX, positionY);
    ctx.fillText(msg, positionX, positionY);
}

// Draws a single block cell with gradient and shadow
function drawBlock(coord, color, ctx) {
    let x = coord[0] * sizeblock;
    let y = coord[1] * sizeblock;

    const gradient = ctx.createLinearGradient(x, y, x + sizeblock, y + sizeblock);
    const { lightColor, darkColor } = GRADIENT_COLORS[color];
    
    gradient.addColorStop(0, lightColor);
    gradient.addColorStop(1, darkColor);
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, sizeblock, sizeblock);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + sizeblock, y);
    ctx.lineTo(x + sizeblock, y + sizeblock);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + sizeblock);
    ctx.lineTo(x + sizeblock, y + sizeblock);
    ctx.stroke();
}

// Draws all placed blocks in the scene
function drawScene(ctx, scene) {
    for (let block of scene.storeBlock) {
        for (let coord of block.coord) {
            drawBlock(coord, block.color, ctx);
        }
    }
}

// Draws the left and right walls and the ceiling
function drawWalls(scene) {
    for (let i = 0; i <= scene.numberBlockHeight - 1; i++) {
        drawBlock([0, i], 'red', ctx);
        drawBlock([scene.numberBlockWidth - 1, i], 'red', ctx);
    }
    for (let limit = 0; limit <= 2 ; limit++) {
        if (limit > 0)
            drawBlock([scene.numberBlockWidth - 1, MAX_HEIGHT], 'pink', ctx);
        else
            drawBlock([0, MAX_HEIGHT], 'pink', ctx);
    }
}
