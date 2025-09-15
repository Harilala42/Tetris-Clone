"use strict";

import { describe, beforeEach, test, expect } from "vitest";
import { Block, Game } from "../src/Tetris.js";

describe("Block collision detection", () => {
    let game;
    beforeEach(() => {
        game = new Game();

        for (let x = 0; x < game.numberBlockWidth; x++) {
            game.storeCoord[x] = [];
            for (let y = 0; y < game.numberBlockHeight; y++)
                game.storeCoord[x][y] = (x === 0 || x === game.numberBlockWidth - 1) ? "full" : "empty";
        }
    });

    test("no collision when space below", () => {
        const block = new Block([[5, 5]], "blue", "O", game);
        expect(block.collisionWithBlock()).toBe(false);
    });

    test("detects collision with ground", () => {
        const block = new Block([[5, game.numberBlockHeight - 1]], "blue", "O", game);
        expect(block.collisionWithGround()).toBe(true);
    });

    test("detects collision with another block", () => {
        game.storeCoord[5][10] = "full";
        const block = new Block([[5, 9]], "blue", "O", game);
        expect(block.collisionWithBlock()).toBe(true);
    });

    test("detects collision with left wall", () => {
        const block = new Block([[1, 5]], "blue", "O", game);
        expect(block.allLeftCollision()).toBe(true);
    });

    test("detects collision with right wall", () => {
        const block = new Block([[game.numberBlockWidth - 2, 5]], "blue", "O", game);
        expect(block.allRightCollision()).toBe(true);
    });

    test("detects probable collision with ground", () => {
        const block = new Block([[5, game.numberBlockHeight - 2]], "blue", "O", game);
        expect(block.probaCollision()).toBe(true);
    });
});
