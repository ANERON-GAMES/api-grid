import assert from "node:assert/strict";
import test from "node:test";
import { classifyProbe, paintSweep, rowsOf } from "../src/index.js";

const now = Date.parse("2026-09-30T20:30:00.000Z");

test("a fast 500 is green and a slow 200 is yellow", () => {
  assert.equal(classifyProbe({ checkedAtMs: now, http: true, elapsedMs: 80, status: 500 }, now), "green");
  assert.equal(classifyProbe({ checkedAtMs: now, http: true, elapsedMs: 900, status: 200 }, now), "yellow");
});

test("no HTTP response is red, and an unchecked cell is gray", () => {
  assert.equal(classifyProbe({ checkedAtMs: now, http: false, elapsedMs: null }, now), "red");
  assert.equal(classifyProbe({ checkedAtMs: now, http: true, elapsedMs: 10000 }, now), "red");
  assert.equal(classifyProbe(null, now), "gray");
});

test("a dead probe keeps the previous colors", () => {
  const previous = paintSweep(null, [
    { id: "core", checkedAtMs: now, http: true, elapsedMs: 40, status: 200 },
    { id: "mail", checkedAtMs: now, http: true, elapsedMs: 1200, status: 200 }
  ], now);
  const held = paintSweep(previous, null, now + 2500);
  assert.equal(held.held, true);
  assert.equal(held.cells[0].color, "green");
  assert.equal(held.cells[1].color, "yellow");
});

test("a gray cell in a live sweep keeps its last color", () => {
  const previous = paintSweep(null, [
    { id: "core", checkedAtMs: now, http: true, elapsedMs: 40, status: 200 }
  ], now);
  const next = paintSweep(previous, [
    { id: "core", checkedAtMs: null }
  ], now + 2500);
  assert.equal(next.held, false);
  assert.equal(next.cells[0].color, "green");
  assert.equal(next.cells[0].held, true);
});

test("twenty columns is the sweep width", () => {
  const cells = Array.from({ length: 55 }, (_, i) => ({ id: "c" + i, color: "green" }));
  const rows = rowsOf(cells);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].length, 20);
  assert.equal(rows[2].length, 15);
});
