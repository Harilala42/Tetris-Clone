"use strict";

import { describe, beforeEach, test, expect, vi } from 'vitest';
import { reduceStack, storeCoord, numberBlockWidth, numberBlockHeight, score } from "../src/Tetris.js";

describe('reduceStack', () => {
    beforeEach(() => {
        for (let x = 0; x < numberBlockWidth; x++) {
            storeCoord[x] = [];
            for (let y = 0; y < numberBlockHeight; y++)
                storeCoord[x][y] = (x === 0 || x === numberBlockWidth - 1) ? "full" : "empty";
        }

        for (let x = 1; x < numberBlockWidth - 1; x++)
            storeCoord[x][10] = "full";
    });

    test('clears a full line and increases score', () => {
        reduceStack();
        for (let x = 1; x < numberBlockWidth - 1; x++)
            expect(storeCoord[x][10]).toBe("empty");
        expect(score).toBe(100);
    });
});
