"use strict";

let ctx;
let score;
let canvas;
let bgImage;
let currentBlock = null;
let isGridReady = false;
let isGamePaused = false;
let isSceneLoading = false;
let isBgMusicPlayed = false;
let isGameOverSoundPlayed = false;
let doesPauseAlreadyDisplay = false;
let storeBlock = [];
let storeCoord = [];

const NB_BLOCK = 5;
const MAX_HEIGHT = 4;
const TIME_FLOW = 300;
const NEXT_SPEED = 500;
const BOX_COLLIDER = 2;
const BONUS_SCORE = 100;
const MOVE_COOLDOWN = 150;

const bgMusic = document.getElementById('background-music');
const bonusSound = document.getElementById('line-clear-sound');
const gameOverSound = document.getElementById('game-over-sound');

const TETROMINOES = {
    1: { color: 'orange', shape: [[8,4],[8,3],[9,3],[10,3],[11,3]], sign: 'L' }, 
    2: { color: 'yellow', shape: [[9,2],[8,3],[9,3],[10,3]], sign: 'T' }, 
    3: { color: 'blue', shape: [[9,2],[10,2],[9,3],[10,3]], sign: 'O' }, 
    4: { color: 'green', shape: [[8,2],[9,2],[10,2],[11,2]], sign: 'I' }, 
    5: { color: 'purple', shape: [[8,2],[9,2],[10,2],[11,2],[11,3]], sign: 'J' }
};

const GRADIENT_COLORS = {
    'orange': { lightColor: '#FFD700', darkColor: '#FF8C00' },
    'yellow': { lightColor: '#FFFF99', darkColor: '#FFD700' },
    'blue': { lightColor: '#6495ED', darkColor: '#0000CD' }, 
    'green': { lightColor: '#7FFF00', darkColor: '#006400' },
    'purple': { lightColor: '#DA70D6', darkColor: '#8A2BE2' },
    'red': { lightColor: '#FF6347', darkColor: '#8B0000' },
    'pink': { lightColor: '#FFB6C1', darkColor: '#FF69B4' }
};

class Block {
    constructor(coord, color, sign) {
        this.coord = JSON.parse(JSON.stringify(coord));
        this.color = color;
        this.sign = sign;
    }

    draw() {
        for (let i = 0; i <= this.coord.length - 1; i++)
            drawBlock(this.coord[i], this.color, ctx);
    }
    
    gravity() {
        for (let i = 0; i <= this.coord.length - 1; i++)
            this.coord[i][1] = gravityBlock(this.coord[i]);
    }

    staticInScene() {
        storeBlock.push({ coord: this.coord, color: this.color });
        recordBlock(this.coord);
        this.draw();
        currentBlock = null;
    }

    collisionWithGround() {
        for (let i = 0; i <= this.coord.length - 1; i++) {
            if (collisionWithGround(this.coord[(this.coord.length - i) - 1],
                this.coord[(this.coord.length - (this.coord.length - i))]))
                return (true);
        }
        return (false);
    }

    collisionWithBlock() {
        for (let i = 0; i <= this.coord.length - 1; i++)
            if (collisionWithBlock(this.coord[i])) return(true);
        return (false);
    }
    
    direction(direction) {
        for (let i = 0; i <= this.coord.length - 1; i++) {
            if (direction === 'left' || direction === 'right')
                this.coord[i][0] = orientationBlock(this.coord[i], direction);
            else
                this.coord[i][1] = orientationBlock(this.coord[i], direction);
        }
    }

    rotation() {
        let newCoords = [];
        const [px, py] = this.coord[2];
        if (this.sign === 'O') return;

        for (let [x, y] of this.coord) {
            let newX = px - (y - py),
                newY = py + (x - px);
            newCoords.push([newX, newY]);
        }

        let isWallsKicked = false;
        for (let [x, y] of newCoords) {
            if (x < 0 || x > numberBlockWidth - 1 
                || y < 0 || y > numberBlockHeight - 1
                || storeCoord[x][y] === 'full') {
                isWallsKicked = true;
                break;
            }
        }

        if (!isWallsKicked) this.coord = newCoords;
    }

    allLeftCollision() {
        for (let i = 0; i <= this.coord.length - 1; i++)
            if (allLeftCollision(this.coord[i])) return (true);
        return (false);
    }
    
    allRightCollision() {
        for (let i = 0; i <= this.coord.length - 1; i++)
            if (allRightCollision(this.coord[i])) return (true);
        return (false);
    }
    
    probaCollision() {
        for (let i = 0; i <= this.coord.length - 1; i++)
            if (probaCollision(this.coord[i])) return (true);
        return (false);
    }
}

let lastTime = 0;
let dropCounter = 0;
let dropInterval = TIME_FLOW;
function updateFrame(time = 0) {
    const delta = time - lastTime;
    lastTime = time;

    dropCounter += delta;
    if (dropCounter >= dropInterval) {
        if (!isBgMusicPlayed) {
            playSound(bgMusic, true);
            isBgMusicPlayed = true;
        }

        refreshScene();
        dropCounter = 0;
    }

    requestAnimationFrame(updateFrame);
}

const numberBlockHeight = 30;
const numberBlockWidth = 20;
let width, height, sizeblock, viewportWidth;

function resizeCanvas() {
    const container = document.querySelector('.container');
    viewportWidth = container.clientWidth;

    const maxWidth = Math.min(viewportWidth, 440);
    const aspectRatio = 440 / 660;
    const newHeight = maxWidth / aspectRatio;
    
    canvas.width = maxWidth;
    canvas.height = newHeight;

    width = document.getElementById('canvas').width;
    height = document.getElementById('canvas').height;
    sizeblock = maxWidth / numberBlockWidth;

    ctx.drawImage(bgImage, 0, 0, width, height);
    drawWalls();

    if (isSceneLoading) {
        displayMessage(score, 5, 0.5);
        currentBlock.draw();
        bgMusic.pause();
        drawScene(ctx);

        isGamePaused = true;
        doesPauseAlreadyDisplay = false;
        refreshScene();
    } else {
        if (isGridReady && gameOver()) return refreshScene();

        score = window.localStorage.getItem('score') || 0;
        if (!score) window.localStorage.setItem('score', '0');
        
        displayMessage(`${viewportWidth > 768 ? 'Press Enter' : 'Tap'} to Start 🕹️!`, 2, 0.4);
        displayMessage(score, 5, 0.5);
    }
}

(async function initScene() {
    canvas = document.getElementById('canvas');
    canvas.style.margin = '10px auto';
    canvas.style.backgroundColor = '#ddd';
    canvas.style.display = 'block';
    ctx = canvas.getContext('2d');

    bgImage = await loadImage('images/background.png');
    
    resizeCanvas();
})();

function refreshScene() {
    if (isGamePaused) {
        if (doesPauseAlreadyDisplay) return;
        displayMessage('⏸️ Pause ⏸️', 3, 0.25);
        return doesPauseAlreadyDisplay = true;
    }

    if (!isGridReady) fillGrid();

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bgImage, 0, 0, width, height);
    drawWalls();
    
    if(!gameOver()) gameLoop();
    else {
        drawScene(ctx);
        displayMessage(score, 5, 0.5);
        isSceneLoading = false;
        if (!isGameOverSoundPlayed) {
            bgMusic.pause();
            playSound(gameOverSound, false);
            isGameOverSoundPlayed = true;
        }
        displayMessage('💀 Game Over 💀', 3, 0.2);
        displayMessage(`${viewportWidth > 768 ? 'Press Enter' : 'Tap'} to Restart 🔁!`, 2, 0.3);
    }
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => reject(`Failed to load image: ${src}`);
    });
}

function playSound(sound, loop) {
    if (sound) {
        sound.volume = 0.6;
        sound.currentTime = 0;
        if (loop) sound.loop = true;
        sound.play().catch(err => console.error(`Failed to play sound: ${err}`));
    }
}

function displayMessage(msg, size, position) {
    document.fonts.ready.then(() => {
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
    });
}

function pauseGame() {
    if (!isSceneLoading) return;

    isGamePaused = !isGamePaused;
    doesPauseAlreadyDisplay = false;
    return isGamePaused ? bgMusic.pause() : bgMusic.play();
}

function gameOver() {
    let isGameOver = false;
    for (let i = 1; i < numberBlockWidth - 1; i++) {
        if(storeCoord[i][MAX_HEIGHT] === 'full') {
            isGameOver = true;
            break;
        }
    }
    return (isGameOver);
}

function restartGame() {
    score = 0;
    lastTime = 0;
    lastScore = 0;
    dropCounter = 0;
    currentBlock = null;
    dropInterval = TIME_FLOW;
    storeBlock = [];
    storeCoord = [];
    isGridReady = false;
    isGamePaused = false;
    isSceneLoading = true;
    isBgMusicPlayed = false;
    isGameOverSoundPlayed = false;
    doesPauseAlreadyDisplay = false;
    requestAnimationFrame(updateFrame);
}

function randomBlock() {
    return Math.floor(Math.random() * NB_BLOCK) + 1;
}

function gameLoop() {
    if (!currentBlock) {
        const { shape, color, sign } = TETROMINOES[randomBlock()];
        currentBlock = new Block(shape, color, sign);
    }

    reduceStack();
    displayMessage(score, 5, 0.5);
    drawScene(ctx);

    if (currentBlock.collisionWithGround() || currentBlock.collisionWithBlock())
        currentBlock.staticInScene();
    else {
        currentBlock.gravity();
        currentBlock.draw();
    }
}

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

function drawScene(ctx) {
    for (let i = 0; i < storeBlock.length; i++) {
        for (let j = 0; j <= storeBlock[i].coord.length - 1; j++) {
            let x = storeBlock[i].coord[j][0];
            let y = storeBlock[i].coord[j][1];
            drawBlock([x, y], storeBlock[i].color, ctx);
        }
    }
}

function drawWalls() {
    for (let i = 0; i <= numberBlockHeight - 1; i++) {
        drawBlock([0, i], 'red', ctx);
        drawBlock([numberBlockWidth - 1, i], 'red', ctx);
    }
    for (let limit = 0; limit <= 2 ; limit++) {
        if (limit > 0)
            drawBlock([numberBlockWidth - 1, MAX_HEIGHT], 'pink', ctx);
        else
            drawBlock([0, MAX_HEIGHT], 'pink', ctx);
    }
}

function fillGrid() {
    isGridReady = true; 
    for (let i = 0; i <= numberBlockWidth - 1; i++) {
        storeCoord.push([]);
        for (let j = 0; j <= numberBlockHeight - 1; j++)
            storeCoord[i].push('empty');
    }
    for (let j = 0; j <= numberBlockHeight - 1; j++)
        storeCoord[0][j] = 'full';
    for (let j = 0; j <= numberBlockHeight - 1; j++)
        storeCoord[numberBlockWidth - 1][j] = 'full';
}

let lastScore = 0;
function reduceStack() {
    for (let y = numberBlockHeight - 1; y >= 0; y--) {
        let isRowFull = true;
        for (let x = 1; x < numberBlockWidth - 1; x++) {
            if (storeCoord[x][y] !== 'full') {
                isRowFull = false;
                break;
            }
        }

        if (isRowFull) {
            score += BONUS_SCORE;
            playSound(bonusSound, false);

            const delta = score - lastScore;
            if (delta >= NEXT_SPEED) {
                lastScore = score;
                dropInterval = Math.max(dropInterval - 25, TIME_FLOW - 100);
            }

            if (score > Number(window.localStorage.getItem('score')))
                window.localStorage.setItem('score', score.toFixed(0));

            for (let x = 1; x < numberBlockWidth - 1; x++)
                storeCoord[x][y] = 'empty';
            for (let i = 0; i < storeBlock.length; i++) {
                storeBlock[i].coord = storeBlock[i].coord.filter(coord => coord[1] !== y);

                if (storeBlock[i].coord.length === 0) {
                    storeBlock.splice(i, 1);
                    i--;
                }
            }
            for (let aboveY = y - 1; aboveY >= 0; aboveY--) {
                for (let x = 1; x < numberBlockWidth - 1; x++) {
                    if (storeCoord[x][aboveY] === 'full') {
                        storeCoord[x][aboveY] = 'empty';
                        storeCoord[x][aboveY + 1] = 'full';

                        for (let i = 0; i < storeBlock.length; i++) {
                            for (let j = 0; j < storeBlock[i].coord.length; j++) {
                                if (storeBlock[i].coord[j][0] === x && storeBlock[i].coord[j][1] === aboveY)
                                    storeBlock[i].coord[j][1] += 1;
                            }
                        }
                    }
                }
            }
        }
    }
}

function collisionWithBlock(coord) {
    let XCoord = coord[0];
    let YCoord = coord[1] + 1;
    if (storeCoord[XCoord][YCoord] === 'full')
        return (true);
    return (false);
}

function collisionWithGround(coord1, coord2) {
    let xcoord = coord2[0];
    let ycoord = coord2[1];
    let XCoord = coord1[0];
    let YCoord = coord1[1];

    if ((XCoord === 0 || YCoord === (numberBlockHeight - 1)) 
        || (xcoord === 0 || ycoord === (numberBlockHeight - 1)))
        return(true);
    return(false);
}

function recordBlock(coord) {
    for (let z = 0; z <= coord.length - 1; z++) {
        let X = coord[z][0];
        let Y = coord[z][1];
        storeCoord[X][Y] = 'full';
    }
}

function gravityBlock(coord) {
    let YCoord = coord[1];
    return (YCoord += 1);
}

function orientationBlock(coord, direction) {
    let XCoord = coord[0];
    let YCoord = coord[1];
    switch(direction) {
        case 'left':
            return (XCoord -= 1);
        case 'right':
            return (XCoord += 1);
        default:
            return (YCoord += 1);
    }
}

function allLeftCollision(coord) {
    let X = coord[0];
    let Y = coord[1];
    if (storeCoord[X - 1][Y] !== 'full')
        return (false);
    return (true);
}

function allRightCollision(coord) {
    let X = coord[0];
    let Y = coord[1];
    if (storeCoord[X + 1][Y] !== 'full')
        return (false);
    return (true);
}

function probaCollision(coord) {
    let X = coord[0];
    let Y = coord[1];

    for (let i = 1; i <= BOX_COLLIDER; i++) {
        if (storeCoord[X][Y + i] === 'full')
            return (true);
        for (let j = 0; j <= numberBlockWidth - 1; j++) {
            if ((X === j && Y === (numberBlockHeight - 1) - i))
                return (true);
        }
    }
    return (false);
}

window.addEventListener('resize', resizeCanvas);

document.getElementById('restart').addEventListener('click', restartGame);
document.getElementById('pause').addEventListener('click', pauseGame);

let tapStartTime, tapStartX, tapStartY;
canvas.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (isGamePaused) return;

    tapStartTime = Date.now();
    tapStartX = touch.clientX;
    tapStartY = touch.clientY;
}, { passive: true });

canvas.addEventListener('touchend', (event) => {
    const touch = event.changedTouches[0];
    if (isGamePaused) return;

    const duration = Date.now() - tapStartTime;
    const distance = Math.sqrt(Math.pow(touch.clientX - tapStartX, 2) + Math.pow(touch.clientY - tapStartY, 2));
    
    if (duration < 300 && distance < 10) {
        if (!isSceneLoading) 
            restartGame();
        else if (isSceneLoading && currentBlock) {
            if (!currentBlock.collisionWithGround() && !currentBlock.collisionWithBlock())
                currentBlock.rotation();
        }
    }
}, { passive: true });

let lastMoveTime = 0;
canvas.addEventListener('touchmove', (event) => {
    const touch = event.changedTouches[0];
    if (isGamePaused || !isSceneLoading || !currentBlock) return;

    const deltaX = touch.clientX - tapStartX;
    const deltaY = touch.clientY - tapStartY;
    
    const currentTime = Date.now();
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    
    if (currentTime - lastMoveTime > MOVE_COOLDOWN && Math.max(absDeltaX, absDeltaY) > 10) {
        if (currentBlock.collisionWithGround() || currentBlock.collisionWithBlock()) return;

        if (absDeltaX > absDeltaY) {
            if (deltaX > 0 && !currentBlock.allRightCollision()) 
                currentBlock.direction('right');
            else if (deltaX < 0 && !currentBlock.allLeftCollision())
                currentBlock.direction('left');
        } else {
            if (deltaY > 0 && !currentBlock.probaCollision())
                currentBlock.direction('down');
        }
        lastMoveTime = currentTime;
    }
}, { passive: true });

document.addEventListener('keydown', (event) => {
    let key = event.key,
        newdirection = '';

    if (key === 'Enter') 
        return restartGame();
    else if (key === ' ')
        return pauseGame();

    if (isGamePaused || !isSceneLoading || !currentBlock) return;

    switch(key) {
        case 'ArrowUp':
            if (!currentBlock.collisionWithGround() && !currentBlock.collisionWithBlock())
                currentBlock.rotation();
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
        return ;
    }

    if (!currentBlock.collisionWithGround() && !currentBlock.collisionWithBlock()) {
        if ((!currentBlock.probaCollision() && newdirection === 'down')
            || (!currentBlock.allLeftCollision() && newdirection === 'left')
            || (!currentBlock.allRightCollision() && newdirection === 'right')
            || (!currentBlock.allLeftCollision() && !currentBlock.allRightCollision()))
            currentBlock.direction(newdirection);
    }
});
