"use strict";

import { describe, beforeEach, test, expect } from "vitest";
import { Block, Game } from "../src/Tetris.js";

describe("Block rotation", () => {
    let game;
    beforeEach(() => {
        game = new Game();

        for (let x = 0; x < game.numberBlockWidth; x++) {
            game.storeCoord[x] = [];
            for (let y = 0; y < game.numberBlockHeight; y++)
                game.storeCoord[x][y] = (x === 0 || x === game.numberBlockWidth - 1) ? "full" : "empty";
        }
    });

    test("O block not allowed to rotate", () => {
        const block = new Block([[4,1],[5,1],[4,2],[5,2]], "blue", "O", game);
        const before = JSON.stringify(block.coord);
        block.rotation();
        expect(JSON.stringify(block.coord)).toBe(before);
    });

    test("T block rotates in open space", () => {
        const block = new Block([[4,2],[5,2],[6,2],[5,3]], "yellow", "T", game);
        const expected = JSON.stringify([[6,0],[6,1],[6,2],[5,1]]);
        block.rotation();
        expect(JSON.stringify(block.coord)).toEqual(expected);
    });

    test("L block shouldn't rotate into left wall", () => {
        const block = new Block([[2,6],[1,3],[1,4],[1,5],[1,6]], "orange", "L", game);
        const before = JSON.stringify(block.coord);
        block.rotation();
        expect(JSON.stringify(block.coord)).toBe(before);
    });

    test("L block shouldn't rotate next to a placed block", () => {
        game.storeCoord[10][2] = "full";
        const block = new Block([[8,2],[9,2],[10,2],[11,2],[11,3]], "purple", "J", game);
        const before = JSON.stringify(block.coord);
        block.rotation();
        expect(JSON.stringify(block.coord)).toBe(before);
    });
});
