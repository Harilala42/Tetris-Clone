"use strict";

import { describe, beforeEach, test, expect } from "vitest";
import { Block, storeCoord, numberBlockWidth, numberBlockHeight } from "../src/Tetris.js";

describe("Block rotation", () => {
    beforeEach(() => {
        for (let x = 0; x < numberBlockWidth; x++) {
            storeCoord[x] = [];
            for (let y = 0; y < numberBlockHeight; y++)
                storeCoord[x][y] = (x === 0 || x === numberBlockWidth - 1) ? "full" : "empty";
        }
    });

    test("O block not allowed to rotate", () => {
        const block = new Block([[4,1],[5,1],[4,2],[5,2]], "blue", "O");
        const before = JSON.stringify(block.coord);
        block.rotation();
        expect(JSON.stringify(block.coord)).toBe(before);
    });

    test("T block rotates in open space", () => {
        const block = new Block([[4,2],[5,2],[6,2],[5,3]], "yellow", "T");
        const expected = JSON.stringify([[6,0],[6,1],[6,2],[5,1]]);
        block.rotation();
        expect(JSON.stringify(block.coord)).toEqual(expected);
    });

    test("L block shouldn't rotate into left wall", () => {
        const block = new Block([[2,6],[1,3],[1,4],[1,5],[1,6]], "orange", "L");
        const before = JSON.stringify(block.coord);
        block.rotation();
        expect(JSON.stringify(block.coord)).toBe(before);
    });

    test("L block shouldn't rotate next to a placed block", () => {
        storeCoord[10][2] = "full";
        const block = new Block([[8,2],[9,2],[10,2],[11,2],[11,3]], "purple", "J");
        const before = JSON.stringify(block.coord);
        block.rotation();
        expect(JSON.stringify(block.coord)).toBe(before);
    });
});
