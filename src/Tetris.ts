"use strict";

/*
	Main Tetris game logic using Canvas API and TypeScript.
	Handles rendering, game state, input, and scoring.
*/

interface IGameConfig
{
    TIME_FLOW: number;
    MAX_HEIGHT: number;
    NEXT_SPEED: number;
    BONUS_SCORE: number;
    MOVE_COOLDOWN: number;
	GRID_COLUMNS: number;
	GRID_ROWS: number;
}

const GAME_CONFIG: IGameConfig = {
    TIME_FLOW: 300,                 // Drop interval (ms)
    MAX_HEIGHT: 4,                  // Y threshold for game over
    NEXT_SPEED: 500,                // Score threshold for speed up
    BONUS_SCORE: 100,               // Score per cleared line
    MOVE_COOLDOWN: 150,             // Touch move debounce (ms)
	GRID_COLUMNS: 20,				// Number of blocks in width
	GRID_ROWS: 30					// Number of blocks in height
} as const;

type TetrominoSign = 'L' | 'T' | 'O' | 'I' | 'J';
type BlockColor = 'orange' | 'yellow' | 'blue' | 'green' | 'purple' | 'red' | 'pink';
type Coordinate = [number, number];
type GridState = 'empty' | 'full';

interface ITetromino
{
    color: BlockColor;
    shape: Coordinate[];
}

interface IGradient
{
    lightColor: string;
    darkColor: string;
}

// --- Tetromino Definitions ---
const TETROMINOES: Record<TetrominoSign, ITetromino> = {
	L: { color: 'orange', shape: [[8,4],[8,3],[9,3],[10,3]] }, 
	T: { color: 'yellow', shape: [[9,2],[8,3],[9,3],[10,3]] }, 
	O: { color: 'blue', shape: [[9,2],[10,2],[9,3],[10,3]] }, 
	I: { color: 'green', shape: [[8,2],[9,2],[10,2],[11,2]] }, 
	J: { color: 'purple', shape: [[11,3],[9,2],[10,2],[11,2]] }
} as const;

// --- Block Gradient Colors ---
const GRADIENT_COLORS: Record<BlockColor, IGradient> = {
	orange: { lightColor: '#FFD700', darkColor: '#FF8C00' },
	yellow: { lightColor: '#FFFF99', darkColor: '#FFD700' },
	blue: { lightColor: '#6495ED', darkColor: '#0000CD' }, 
	green: { lightColor: '#7FFF00', darkColor: '#006400' },
	purple: { lightColor: '#DA70D6', darkColor: '#8A2BE2' },
	red: { lightColor: '#FF6347', darkColor: '#8B0000' },
	pink: { lightColor: '#FFB6C1', darkColor: '#FF69B4' }
} as const;

// --- Audio Elements ---
const bgMusic = document.getElementById('background-music') as HTMLAudioElement;
const bonusSound = document.getElementById('line-clear-sound') as HTMLAudioElement;
const gameOverSound = document.getElementById('game-over-sound') as HTMLAudioElement;

/*
	Block class represents a tetromino.
	Handles drawing, movement, collision and rotation.
*/
export class Block {
    coord: Coordinate[];
    color: BlockColor;
    sign: TetrominoSign;
    game: Game;

    constructor(coord: Coordinate[], color: BlockColor, sign: TetrominoSign, game: Game) {
        // Deep copy coordinates to avoid mutation
        this.coord = structuredClone(coord);
        this.color = color;
        this.sign = sign;
        this.game = game;
    }

    // Moves the block down by one cell (gravity)
    gravity(): void {
        this.coord = this.coord.map(([x, y]) => [x, y + 1]);
    }

    // Fixes the block in the scene and records its position
    staticInScene(): void {
        this.game.currentBlock = null;
        this.game.storeBlock.push({ coord: this.coord, color: this.color });
        for (let [x, y] of this.coord)
            this.game.storeCoord[x][y] = 'full';
    }

    // Moves the block in the specified direction ('left', 'right', 'down')
    direction(direction: "left" | "right" | "down"): Coordinate | null {
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
        return null;
    }

    // Rotates the block with SRS (Super Rotation System)
    rotation(): boolean {
        let newCoords: Coordinate[] = [];
        const [px, py] = this.coord[2]; // Pivot point
        if (this.sign === 'O') return false; // O-block does not rotate

        // Calculate rotated positions
        for (let [x, y] of this.coord) {
            let newX = px - (y - py),
                newY = py + (x - px);
            newCoords.push([newX, newY]);
        }

        // Check for wall or block collision after rotation
        let isWallsKicked: boolean = false;
        for (let [x, y] of newCoords) {
            if (x < 0 || x > this.game.numberBlockWidth - 1 
                || y < 0 || y > this.game.numberBlockHeight - 1 
                || this.game.storeCoord[x][y] === 'full') {
                isWallsKicked = true;
                break;
            }
        }

        // Apply rotation if no collision
        if (!isWallsKicked) {
            this.coord = newCoords;
            return true;
        }

        return false;
    }

    // Checks if any part of the block collides
    collision(offsetX: number, offsetY: number): boolean {
        for (let [x, y] of this.coord) {
            const newX = x + offsetX;
            const newY = y + offsetY;

            if (newX < 1 || newX >= this.game.numberBlockWidth - 1)
                return true; // Collision with side walls

            if (newY >= this.game.numberBlockHeight)
                return true; // Collision with the floor

            if (newY >= 0 && this.game.storeCoord[newX][newY] === 'full')
                return true; // Collision with an existing block
        }
        return false;
    }
}

/* EventManager Class handles touch screen and keyboard events. */
export class EventManager {
    scene: Game;
    tapStartX: number;
    tapStartY: number;
    lastMoveTime: number;
    tapStartTime: number;

    constructor(scene: Game) {
        this.scene = scene;

        this.tapStartX = 0;
        this.tapStartY = 0;
        this.lastMoveTime = 0;
        this.tapStartTime = 0;
    }

    handleTouchStart = (event: TouchEvent): void => {
        const touch = event.touches?.[0];
        if (!touch || this.scene.isGamePaused) return;

        this.tapStartTime = Date.now();
        this.tapStartX = touch.clientX;
        this.tapStartY = touch.clientY;
    }

    handleTouchEnd = (event: TouchEvent): void => {
        const touch = event.changedTouches?.[0];
        if (!touch || this.scene.isGamePaused) return;

        const duration = Date.now() - this.tapStartTime;
        const distance = Math.hypot(touch.clientX - this.tapStartX, touch.clientY - this.tapStartY);

        // Tap: Rotate Block or Restart Scene
        if (duration < 300 && distance < 10) {
            if (!this.scene.isSceneLoading) {
                this.scene.restartGame();
            } else if (this.scene.currentBlock) {
                if (!this.scene.currentBlock.collision(0, 1))
                    this.scene.currentBlock.rotation();
            }
        }
    }

    handleTouchMove = (event: TouchEvent): void => {
        const touch = event.changedTouches?.[0];
        if (!touch || this.scene.isGamePaused || !this.scene.isSceneLoading
            || !this.scene.currentBlock) return;

        const deltaX = touch.clientX - this.tapStartX;
        const deltaY = touch.clientY - this.tapStartY;

        const currentTime = Date.now();
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        // Swipe: Move Block in a direction
        if (currentTime - this.lastMoveTime > GAME_CONFIG.MOVE_COOLDOWN && Math.max(absDeltaX, absDeltaY) > 10) {
            if (this.scene.currentBlock.collision(0, 1)) return;

            if (absDeltaX > absDeltaY) {
                if (deltaX > 0 && !this.scene.currentBlock.collision(1, 0))
                    this.scene.currentBlock.direction('right');
                else if (deltaX < 0 && !this.scene.currentBlock.collision(-1, 0))
                    this.scene.currentBlock.direction('left');
            } else {
                if (deltaY > 0 && !this.scene.currentBlock.collision(0, 1))
                    this.scene.currentBlock.direction('down');
            }

            this.tapStartX = touch.clientX;
            this.tapStartY = touch.clientY;
            this.lastMoveTime = currentTime;
        }
    }

    // -- Keyboard Events --
    handleKeyDown = (event: KeyboardEvent): void => {
        let key = event.key;

        if (key === 'Enter') 
            return this.scene.restartGame();
        else if (key === ' ') 
            return this.scene.pauseGame();

        if (this.scene.isGamePaused || !this.scene.isSceneLoading 
            || !this.scene.currentBlock) return;

        switch (key) {
            case 'ArrowUp':
                this.scene.currentBlock.rotation();
            break;
            case 'ArrowDown':
                if (!this.scene.currentBlock.collision(0, 1))
                    this.scene.currentBlock.direction('down');
            break;
            case 'ArrowLeft':
                if (!this.scene.currentBlock.collision(-1, 0))
                    this.scene.currentBlock.direction('left');
            break;
            case 'ArrowRight':
                if (!this.scene.currentBlock.collision(1, 0))
                    this.scene.currentBlock.direction('right');
            break;
            default:
            return;
        }
    }
}

/* Render handles display on the canvas */
export class Render {
    width: number;
    height: number;
    sizeBlock: number;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;

    constructor(width: number, height: number, blockSize: number) {
        this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;

        this.width = width;
        this.height = height;
        this.sizeBlock = blockSize;
    }

    clear(): void {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    drawImage(image: HTMLImageElement, x: number, y: number): void {
        this.ctx.drawImage(image, x, y, this.width, this.height);
    }

    // Displays a message at a given position and size
    displayMessage(msg: string, size: number, position: number): void {
        this.ctx.lineWidth = 5;
        this.ctx.fillStyle = 'black';
        this.ctx.strokeStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const positionX = this.width / 2;
        const positionY = this.height * position;
        
        this.ctx.font = `${size}rem 'Chewy'`;
        this.ctx.strokeText(msg, positionX, positionY);
        this.ctx.fillText(msg, positionX, positionY);
    }

    // Draws a single block cell with gradient and shadow
    drawBlock(coord: Coordinate, color: BlockColor): void {
        let x = coord[0] * this.sizeBlock;
        let y = coord[1] * this.sizeBlock;

        const gradient = this.ctx.createLinearGradient(x, y, x + this.sizeBlock, y + this.sizeBlock);

        const { lightColor, darkColor } = GRADIENT_COLORS[color];
        
        gradient.addColorStop(0, lightColor);
        gradient.addColorStop(1, darkColor);
        
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        this.ctx.shadowBlur = 4;
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x, y, this.sizeBlock, this.sizeBlock);
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + this.sizeBlock, y);
        this.ctx.lineTo(x + this.sizeBlock, y + this.sizeBlock);
        this.ctx.stroke();

        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x, y + this.sizeBlock);
        this.ctx.lineTo(x + this.sizeBlock, y + this.sizeBlock);
        this.ctx.stroke();
    }
}

/* Game class for the state management. */
export class Game {
    render: Render;
    viewportWidth: number;
    numberBlockWidth: number;
    numberBlockHeight: number;
    currentBlock: Block | null;

    score: number;
    lastScore: number;

    lastTime: number;
    dropCounter: number;
    dropInterval: number;

    isGridReady: boolean;
    isGamePaused: boolean;
    isSceneLoading: boolean;
    isBgMusicPlayed: boolean;

    storeBlock: { coord: Coordinate[], color: BlockColor }[];
    storeCoord: GridState[][];

    eventManager: EventManager;
    bgImage: HTMLImageElement | null;
    animationId: number | null;

    constructor() {
        this.numberBlockWidth = GAME_CONFIG.GRID_COLUMNS;
        this.numberBlockHeight = GAME_CONFIG.GRID_ROWS;
        this.currentBlock = null;

        this.score = 0;
        this.lastScore = 0;

        this.lastTime = 0;
        this.dropCounter = 0;
        this.dropInterval = GAME_CONFIG.TIME_FLOW;

        this.isGridReady = false;
        this.isGamePaused = false;
        this.isSceneLoading = false;
        this.isBgMusicPlayed = false;
        
        this.storeBlock = [];
        this.storeCoord = [];

        this.eventManager = new EventManager(this);
        this.updateFrame = this.updateFrame.bind(this);
        this.animationId = null;

        this.bgImage = null;

        const container = document.querySelector('.container') as HTMLElement;
        this.viewportWidth = container.clientWidth;

        const aspectRatio = 440 / 660;
        const width = Math.min(this.viewportWidth, 440);
        const height = width / aspectRatio;
        const sizeBlock = width / this.numberBlockWidth;

        this.render = new Render(width, height, sizeBlock);
        this.render.canvas.width = width;
        this.render.canvas.height = height;
    }

    // Init the game scene and loads assets
    async initGame(): Promise<void> {
        try {
            // Button controls
            const pauseBtn = document.getElementById('pause') as HTMLButtonElement;
            const restartBtn = document.getElementById('restart') as HTMLButtonElement;

            pauseBtn.addEventListener('click', (e: MouseEvent) => this.pauseGame());
            restartBtn.addEventListener('click', (e: MouseEvent) => this.restartGame());

            // Touch listeners
            this.render.canvas.addEventListener('touchstart', this.eventManager.handleTouchStart, { passive: true });
            this.render.canvas.addEventListener('touchend', this.eventManager.handleTouchEnd, { passive: true });
            this.render.canvas.addEventListener('touchmove', this.eventManager.handleTouchMove, { passive: true });

            // Keyboard controls
            document.addEventListener('keydown', this.eventManager.handleKeyDown);

            await loadFont('Chewy', '/fonts/Chewy-Regular.ttf');

            this.bgImage = await loadImage('images/background.png') as HTMLImageElement;
            this.render.drawImage(this.bgImage, 0, 0);
            this.drawWalls();

            this.score = Number(window.localStorage.getItem('score')) || 0;
            if (!this.score) window.localStorage.setItem('score', '0');

            this.render.displayMessage(`${this.viewportWidth > 768 ? 'Press Enter' : 'Tap'} to Start 🕹️!`, 2, 0.4);
            this.render.displayMessage(this.score.toString(), 5, 0.5);
        } catch(err: any) {
            console.error("Error:", err.message);
        }
    }

    startLoop(): void {
        if (!this.animationId) {
            this.animationId = requestAnimationFrame(this.updateFrame);
        }
    }

    stopLoop(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // Main animation loop for the game
    updateFrame(time: number = 0): void {
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
    refreshGame(): void {
        if (!this.isGridReady) this.fillGrid();

        this.render.clear();
        if (this.bgImage) this.render.drawImage(this.bgImage, 0, 0);
        this.drawWalls();

        if (!this.currentBlock) {
            const listBlocks = Object.keys(TETROMINOES) as TetrominoSign[];
            const randomBlock = Math.floor(Math.random() * listBlocks.length);
            const sign = listBlocks[randomBlock];
            const { shape, color } = TETROMINOES[sign];
            
            this.currentBlock = new Block(shape, color, sign, this);
        }

        this.reduceStack();
        this.render.displayMessage(this.score.toString(), 5, 0.5);
        this.drawScene();

        this.drawCurrentBlock();
        if (this.currentBlock.collision(0, 1))
            this.currentBlock.staticInScene();
        else
            this.currentBlock.gravity();
    }

    // Toggles the game pause state and music
    pauseGame(): void {
        if (!this.isSceneLoading) return;

        this.isGamePaused = !this.isGamePaused;
        
        if (this.isGamePaused) {
            this.stopLoop();
            if (bgMusic) bgMusic.pause();
            this.render.displayMessage(this.score.toString(), 5, 0.5);
            this.render.displayMessage('⏸️ Pause ⏸️', 3, 0.25);
        } else {
            if (bgMusic) bgMusic.play();
            this.startLoop();
        }
    }

    // Checks if the game is over (block above MAX_HEIGHT)
    gameOver(): boolean {
        let isGameOver = false;
        if (this.isGridReady) {
            for (let i = 1; i < this.numberBlockWidth - 1; i++) {
                if (this.storeCoord[i][GAME_CONFIG.MAX_HEIGHT] === 'full') {
                    isGameOver = true;
                    break;
                }
            }
        }

        if (isGameOver) {
            this.stopLoop();

            if (bgMusic) bgMusic.pause();
            playSound(gameOverSound);
            this.isSceneLoading = false;

            this.render.displayMessage(this.score.toString(), 5, 0.5);
            this.render.displayMessage('💀 Game Over 💀', 3, 0.2);
            this.render.displayMessage(`${this.viewportWidth > 768 ? 'Press Enter' : 'Tap'} to Restart 🔁!`, 2, 0.3);
        }
        return (isGameOver);
    }

    // Resets all game state and restarts the game
    restartGame(): void {
        this.score = 0;
        this.lastScore = 0;
        this.currentBlock = null;

        this.lastTime = 0;
        this.dropCounter = 0;
        this.dropInterval = GAME_CONFIG.TIME_FLOW;

        this.isGridReady = false;
        this.isGamePaused = false;
        this.isSceneLoading = true;
        this.isBgMusicPlayed = false;

        this.storeBlock = [];
        this.storeCoord = [];

        this.startLoop();
    }

    // Init the grid and fills wall cells as 'full'
    fillGrid(): void {
        this.isGridReady = true; 
        for (let i = 0; i <= this.numberBlockWidth - 1; i++) {
            this.storeCoord.push([]);
            for (let j = 0; j <= this.numberBlockHeight - 1; j++)
                this.storeCoord[i].push('empty');
        }
        for (let j = 0; j <= this.numberBlockHeight - 1; j++) {
            this.storeCoord[0][j] = 'full';
            this.storeCoord[this.numberBlockWidth - 1][j] = 'full';
        }
    }

    // Checks for and clears full lines, updates score and speed
    reduceStack(): void {
        for (let y = this.numberBlockHeight - 1; y >= 0; y--) {
            let isRowFull = true;
            for (let x = 1; x < this.numberBlockWidth - 1; x++) {
                if (this.storeCoord[x][y] !== 'full') {
                    isRowFull = false;
                    break;
                }
            }

            if (isRowFull) {
                this.score += GAME_CONFIG.BONUS_SCORE;
                playSound(bonusSound);

                const delta = this.score - this.lastScore;
                if (delta >= GAME_CONFIG.NEXT_SPEED) {
                    this.lastScore = this.score;
                    this.dropInterval = Math.max(this.dropInterval - 25, GAME_CONFIG.TIME_FLOW - 100);
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

    // Draws the moved block in the scene
    drawCurrentBlock(): void {
        if (!this.currentBlock) return;

        for (let coords of this.currentBlock.coord) 
            this.render.drawBlock(coords, this.currentBlock.color);
    }

    // Draws all placed blocks in the scene
    drawScene(): void {
        for (let block of this.storeBlock) {
            block.coord.forEach(coord => {
                this.render.drawBlock(coord, block.color);
            });
        }
    }

    // Draws the left and right walls and the ceiling
    drawWalls(): void {
        for (let i = 0; i <= this.numberBlockHeight - 1; i++) {
            this.render.drawBlock([0, i], i != GAME_CONFIG.MAX_HEIGHT ? 'red' : 'pink');
            this.render.drawBlock([this.numberBlockWidth - 1, i], i != GAME_CONFIG.MAX_HEIGHT ? 'red' : 'pink');
        }
    }
}

// Loads an image assets
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    });
}

// Loads a font assets
function loadFont(name: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const font = new FontFace(name, `url(${url})`);

        font.load()
            .then((loadedFont) => {
                document.fonts.add(loadedFont);
                resolve();
            })
            .catch((err) => {
                reject(new Error(`Failed to load font "${name}": ${err}`));
            });
    });
}

// Plays a sound, optionally looping
function playSound(sound: HTMLAudioElement, loop: boolean = false): void {
    if (sound) {
        sound.volume = 0.6;
        sound.currentTime = 0;
        if (loop) sound.loop = true;
        sound.play().catch((err: any) => console.error(`Failed to play sound: ${err}`));
    }
}

// --- Start the game ---
const game = new Game();
game.initGame();
