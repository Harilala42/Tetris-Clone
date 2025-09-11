"use strict";

import { describe, beforeEach, test, expect } from "vitest";
import { Block, storeCoord, numberBlockHeight, numberBlockWidth } from "../src/Tetris.js";

describe("Block collision detection", () => {
    beforeEach(() => {
        for (let x = 0; x < numberBlockWidth; x++) {
            storeCoord[x] = [];
            for (let y = 0; y < numberBlockHeight; y++)
                storeCoord[x][y] = (x === 0 || x === numberBlockWidth - 1) ? "full" : "empty";
        }
    });

    test("detects collision with ground", () => {
        const block = new Block([[5, numberBlockHeight - 1]], "blue", "O");
        expect(block.collisionWithGround()).toBe(true);
    });

    test("detects collision with another block", () => {
        storeCoord[5][10] = "full";
        const block = new Block([[5, 9]], "blue", "O");
        expect(block.collisionWithBlock()).toBe(true);
    });

    test("no collision when space below", () => {
        const block = new Block([[5, 5]], "blue", "O");
        expect(block.collisionWithBlock()).toBe(false);
    });
});
