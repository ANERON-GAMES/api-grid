import assert from "node:assert/strict";
import test from "node:test";
import { GRID_COLUMNS, ProbeColor, classifyProbe, paintSweep, rowsOf } from "../src/index.js";

const now = Date.parse("2026-09-30T20:30:00.000Z");

test("a fast 500 is green and a slow 200 is yellow", () => {
  assert.equal(
    classifyProbe({ checkedAtMs: now, http: true, elapsedMs: 80, status: 500 }, now),
    ProbeColor.Green
  );
  assert.equal(
    classifyProbe({ checkedAtMs: now, http: true, elapsedMs: 900, status: 200 }, now),
    ProbeColor.Yellow
  );
});

test("no HTTP response is red, and an unchecked cell is gray", () => {
  assert.equal(
    classifyProbe({ checkedAtMs: now, http: false, elapsedMs: null }, now),
    ProbeColor.Red
  );
  assert.equal(
    classifyProbe({ checkedAtMs: now, http: true, elapsedMs: 10000 }, now),
    ProbeColor.Red
  );
  assert.equal(classifyProbe(null, now), ProbeColor.Gray);
});

test("a dead probe keeps the previous colors", () => {
  const previous = paintSweep(
    null,
    [
      { id: "core", checkedAtMs: now, http: true, elapsedMs: 40, status: 200 },
      { id: "mail", checkedAtMs: now, http: true, elapsedMs: 1200, status: 200 }
    ],
    now
  );
  const held = paintSweep(previous, null, now + 2500);
  assert.equal(held.held, true);
  assert.equal(held.cells[0].color, ProbeColor.Green);
  assert.equal(held.cells[1].color, ProbeColor.Yellow);
});

test("a gray cell in a live sweep keeps its last color", () => {
  const previous = paintSweep(
    null,
    [{ id: "core", checkedAtMs: now, http: true, elapsedMs: 40, status: 200 }],
    now
  );
  const next = paintSweep(previous, [{ id: "core", checkedAtMs: null }], now + 2500);
  assert.equal(next.held, false);
  assert.equal(next.cells[0].color, ProbeColor.Green);
  assert.equal(next.cells[0].held, true);
});

test("twenty columns is the sweep width", () => {
  const cells = Array.from({ length: 55 }, (_, index) => ({
    id: "c" + index,
    color: ProbeColor.Green
  }));
  const rows = rowsOf(cells);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].length, GRID_COLUMNS);
  assert.equal(rows[2].length, 15);
});

test("a reordered sweep holds each unchecked cell by id", () => {
  const previous = paintSweep(
    null,
    [
      { id: "core", checkedAtMs: now, http: true, elapsedMs: 40, status: 200 },
      { id: "mail", checkedAtMs: now, http: true, elapsedMs: 1200, status: 503 }
    ],
    now
  );
  const next = paintSweep(
    previous,
    [
      { id: "mail", checkedAtMs: null, status: null },
      { id: "core", checkedAtMs: null, status: null }
    ],
    now + 2500
  );

  assert.equal(next.held, false);
  assert.deepEqual(next.cells[0], {
    id: "mail",
    color: ProbeColor.Yellow,
    elapsedMs: 1200,
    status: 503,
    held: true
  });
  assert.deepEqual(next.cells[1], {
    id: "core",
    color: ProbeColor.Green,
    elapsedMs: 40,
    status: 200,
    held: true
  });
});

test("a negative age is gray and keeps the previous color for that id", () => {
  assert.equal(
    classifyProbe({ checkedAtMs: now + 5000, http: true, elapsedMs: 10, status: 200 }, now),
    ProbeColor.Gray
  );

  const previous = paintSweep(
    null,
    [{ id: "core", checkedAtMs: now, http: true, elapsedMs: 40, status: 200 }],
    now
  );
  const next = paintSweep(
    previous,
    [{ id: "core", checkedAtMs: now + 5000, http: true, elapsedMs: 10, status: 500 }],
    now
  );

  assert.equal(next.held, false);
  assert.equal(next.cells[0].color, ProbeColor.Green);
  assert.equal(next.cells[0].held, true);
  assert.equal(next.cells[0].status, 200);
  assert.equal(next.cells[0].elapsedMs, 40);
});

test("a negative elapsed time is red and replaces the previous color", () => {
  assert.equal(
    classifyProbe({ checkedAtMs: now, http: true, elapsedMs: -1, status: 200 }, now),
    ProbeColor.Red
  );
  assert.equal(
    classifyProbe({ checkedAtMs: now, http: true, elapsedMs: Number.NaN, status: 200 }, now),
    ProbeColor.Red
  );

  const previous = paintSweep(
    null,
    [{ id: "core", checkedAtMs: now, http: true, elapsedMs: 40, status: 204 }],
    now
  );
  const next = paintSweep(
    previous,
    [{ id: "core", checkedAtMs: now + 10, http: true, elapsedMs: -1, status: 200 }],
    now + 10
  );

  assert.equal(next.cells[0].color, ProbeColor.Red);
  assert.equal(next.cells[0].held, false);
  assert.equal(next.cells[0].elapsedMs, -1);
  assert.equal(next.cells[0].status, 200);
});

test("an HTTP status from 100 through 599 does not recolor a timed response", () => {
  assert.equal(
    classifyProbe({ checkedAtMs: now, http: true, elapsedMs: 80, status: 404 }, now),
    ProbeColor.Green
  );
  assert.equal(
    classifyProbe({ checkedAtMs: now, http: true, elapsedMs: 900, status: 503 }, now),
    ProbeColor.Yellow
  );
  assert.equal(
    classifyProbe({ checkedAtMs: now, http: true, elapsedMs: 80, status: null }, now),
    ProbeColor.Green
  );
});

test("a status outside the HTTP range is red", () => {
  assert.equal(
    classifyProbe({ checkedAtMs: now, http: true, elapsedMs: 80, status: 0 }, now),
    ProbeColor.Red
  );
  assert.equal(
    classifyProbe({ checkedAtMs: now, http: true, elapsedMs: 80, status: -1 }, now),
    ProbeColor.Red
  );
  assert.equal(
    classifyProbe({ checkedAtMs: now, http: true, elapsedMs: 80, status: 600 }, now),
    ProbeColor.Red
  );
  assert.equal(
    classifyProbe({ checkedAtMs: now, http: true, elapsedMs: 80, status: 200.5 }, now),
    ProbeColor.Red
  );
});

test("a live sweep holds only the unchecked id", () => {
  const previous = paintSweep(
    null,
    [
      { id: "core", checkedAtMs: now, http: true, elapsedMs: 40, status: 500 },
      { id: "mail", checkedAtMs: now, http: true, elapsedMs: 1200, status: 200 }
    ],
    now
  );
  const next = paintSweep(
    previous,
    [
      { id: "mail", checkedAtMs: now + 1000, http: true, elapsedMs: 80, status: 204 },
      { id: "core", checkedAtMs: null }
    ],
    now + 1000
  );

  assert.equal(next.held, false);
  assert.deepEqual(next.cells[0], {
    id: "mail",
    color: ProbeColor.Green,
    elapsedMs: 80,
    status: 204,
    held: false
  });
  assert.deepEqual(next.cells[1], {
    id: "core",
    color: ProbeColor.Green,
    elapsedMs: 40,
    status: 500,
    held: true
  });
});

test("rowsOf uses an explicit positive column count", () => {
  const cells = Array.from({ length: 25 }, (_, index) => ({
    id: "c" + index,
    color: ProbeColor.Green
  }));
  const rows = rowsOf(cells, 10);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].length, 10);
  assert.equal(rows[2].length, 5);
});

test("a column count that is not a positive integer uses the default width", () => {
  const cells = Array.from({ length: 21 }, (_, index) => ({ id: "c" + index }));
  assert.equal(rowsOf(cells, 10.5)[0].length, GRID_COLUMNS);
  assert.equal(rowsOf(cells, 0)[0].length, GRID_COLUMNS);
  assert.equal(rowsOf(cells, -4)[0].length, GRID_COLUMNS);
});

test("a sample list that is not an array throws", () => {
  assert.throws(() => paintSweep(null, { id: "core" }, now), TypeError);
});

test("color names stay the stable strings", () => {
  assert.equal(ProbeColor.Green, "green");
  assert.equal(ProbeColor.Yellow, "yellow");
  assert.equal(ProbeColor.Red, "red");
  assert.equal(ProbeColor.Gray, "gray");
});
