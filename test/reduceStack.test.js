"use strict";

import { describe, beforeEach, test, expect, vi } from 'vitest';
import { reduceStack, storeCoord, numberBlockWidth, numberBlockHeight, score } from "../src/Tetris.js";

describe('reduceStack', () => {
    let lastScore;

    beforeEach(() => {
        for (let x = 0; x < numberBlockWidth; x++) {
            storeCoord[x] = [];
            for (let y = 0; y < numberBlockHeight; y++)
                storeCoord[x][y] = (x === 0 || x === numberBlockWidth - 1) ? "full" : "empty";
        }

        for (let x = 1; x < numberBlockWidth - 1; x++)
            storeCoord[x][10] = "full";

        lastScore = score;
    });

    test('clears a full line and increases score', () => {
        reduceStack();
        for (let x = 1; x < numberBlockWidth - 1; x++)
            expect(storeCoord[x][10]).toBe("empty");
        expect(score).toBe(lastScore + 100);
    });

    test("should't clear an almost full line", () => {
        storeCoord[5][10] = "empty";
        reduceStack();
        for (let x = 1; x < numberBlockWidth - 1; x++) {
            if (x === 5)
                expect(storeCoord[x][10]).toBe("empty");
            else
                expect(storeCoord[x][10]).toBe("full");
        }
        expect(score).toBe(lastScore);
    });

    test("after clearing a line, rows above fall down", () => {
        storeCoord[5][9] = "full";
        reduceStack();
        expect(storeCoord[5][10]).toBe("full");
        expect(storeCoord[5][9]).toBe("empty");
        expect(score).toBe(lastScore + 100);
    });
});
