"use strict";

import { describe, beforeEach, test, expect } from 'vitest';
import { Game } from "../src/Tetris.js";

describe('reduceStack', () => {
    let game;
    beforeEach(() => {
        game = new Game();

        for (let x = 0; x < game.numberBlockWidth; x++) {
            game.storeCoord[x] = [];
            for (let y = 0; y < game.numberBlockHeight; y++)
                game.storeCoord[x][y] = (x === 0 || x === game.numberBlockWidth - 1) ? "full" : "empty";
        }

        for (let x = 1; x < game.numberBlockWidth - 1; x++)
            game.storeCoord[x][10] = "full";
    });

    test('clears a full line and increases score', () => {
        let lastScore = game.score;
        game.reduceStack();
        for (let x = 1; x < game.numberBlockWidth - 1; x++)
            expect(game.storeCoord[x][10]).toBe("empty");
        expect(game.score).toBe(lastScore + 100);
    });

    test("should't clear an almost full line", () => {
        let lastScore = game.score;
        game.storeCoord[5][10] = "empty";
        game.reduceStack();
        for (let x = 1; x < game.numberBlockWidth - 1; x++) {
            if (x === 5)
                expect(game.storeCoord[x][10]).toBe("empty");
            else
                expect(game.storeCoord[x][10]).toBe("full");
        }
        expect(game.score).toBe(lastScore);
    });

    test("after clearing a line, rows above fall down", () => {
        let lastScore = game.score;
        game.storeCoord[5][9] = "full";
        game.reduceStack();
        expect(game.storeCoord[5][10]).toBe("full");
        expect(game.storeCoord[5][9]).toBe("empty");
        expect(game.score).toBe(lastScore + 100);
    });
});
