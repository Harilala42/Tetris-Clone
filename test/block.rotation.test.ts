"use strict";

import { describe, beforeEach, test, expect } from "vitest";
import { Block, Game } from "../src/Tetris.js";

describe("Block rotation", () => {
    let game: Game;
    beforeEach(() => {
        game = new Game();

        for (let x = 0; x < game.numberBlockWidth; x++) {
            game.storeCoord[x] = [];
            for (let y = 0; y < game.numberBlockHeight; y++)
                game.storeCoord[x][y] = (x === 0 || x === game.numberBlockWidth - 1) ? "full" : "empty";
        }
    });

    test("O block not allowed to rotate", () => {
        const initialCoords: [number, number][] = [[4,1],[5,1],[4,2],[5,2]];
        const block: Block = new Block(initialCoords, "blue", "O", game);
        const before: string = JSON.stringify(block.coord);

        block.rotation();

        expect(JSON.stringify(block.coord)).toBe(before);
    });

    test("T block rotates in open space", () => {
        const initialCoords: [number, number][] = [[4,2],[5,2],[6,2],[5,3]];
        const block: Block = new Block(initialCoords, "yellow", "T", game);
        const expected: string = JSON.stringify([[6,0],[6,1],[6,2],[5,1]]);

        block.rotation();

        expect(JSON.stringify(block.coord)).toEqual(expected);
    });

    test("I block shouldn't rotate into left wall", () => {
        const initialCoords: [number, number][] = [[1,3],[1,4],[1,5],[1,6]];
        const block: Block = new Block(initialCoords, "green", "I", game);
        const before: string = JSON.stringify(block.coord);

        block.rotation();

        expect(JSON.stringify(block.coord)).toBe(before);
    });

    test("J block shouldn't rotate next to a placed block", () => {
        game.storeCoord[10][2] = "full";
        const initialCoords: [number, number][] = [[11,3], [9,2], [10,2], [11,2]];
        const block: Block = new Block(initialCoords, "purple", "J", game);
        const before: string = JSON.stringify(block.coord);

        block.rotation();

        expect(JSON.stringify(block.coord)).toBe(before);
    });
});
