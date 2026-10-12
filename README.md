# api-grid

Color a health grid from whether HTTP came back, and how long it took.

A 500 that returns in 80 ms is green. A 200 that takes 900 ms is yellow. A probe that gets no HTTP response inside 10 seconds is red. A cell that was never checked this sweep stays gray. The HTTP status code is recorded on the cell. An integer status from 100 through 599 does not change that color. A missing status does not change it either. A fractional or out-of-range status is not a real HTTP response, and that cell is red.

When the probe process itself dies, the grid keeps the last colors. Repainting every cell red because the painter missed a beat hides the one endpoint that is actually down.

## Install

The package is an ES module. It needs Node.js 20 or newer. It has no runtime dependencies. The package name is `@aneron/api-grid`. It is not published to the npm registry.

Clone this repository and run the tests:

```bash
git clone https://github.com/ANERON-GAMES/api-grid.git
cd api-grid
npm install
npm test
```

`npm test` runs `node --test`. `npm run lint` runs ESLint. `npm run format:check` runs Prettier.

Install it as a dependency from the git repository:

```bash
npm install github:ANERON-GAMES/api-grid
```

```js
import { paintSweep, rowsOf } from "@aneron/api-grid";
```

Code in this repository imports the same entry point with `./src/index.js`.

## Usage

A sweep is one pass over the grid. Pass the previous sweep back in. Pass `null` for the sample list when the probe process produced nothing.

```js
import { paintSweep, rowsOf } from "@aneron/api-grid";

const now = Date.now();

const sweep = paintSweep(
  null,
  [
    { id: "core", checkedAtMs: now, http: true, elapsedMs: 80, status: 500 },
    { id: "mail", checkedAtMs: now, http: true, elapsedMs: 900, status: 200 },
    { id: "edge", checkedAtMs: now, http: false, elapsedMs: null, status: null }
  ],
  now
);

const held = paintSweep(sweep, null, now + 2500);
const rows = rowsOf(held.cells);
```

`sweep.cells` is green, yellow, then red. `held.held` is `true`, and the three colors are unchanged. `rows` is one row, because three cells are below the 20-column width.

An unchecked cell in a live sweep keeps the last color of the same id. The match is by `id`, not by position. Swapping `mail` and `core`, and leaving `core` unchecked, still holds green for `core`.

```js
const reordered = paintSweep(
  sweep,
  [
    { id: "mail", checkedAtMs: now + 2500, http: true, elapsedMs: 80, status: 204 },
    { id: "core", checkedAtMs: null },
    { id: "edge", checkedAtMs: now + 2500, http: true, elapsedMs: 1200, status: 200 }
  ],
  now + 2500
);
```

`mail` is green with status 204. `core` is still green, `held` on that cell is `true`, and its recorded status stays 500. `edge` is yellow.

## API reference

All functions are pure. They do not read the clock, the network, or the filesystem. The caller passes `nowMs`.

### Constants

| Export              | Value      | Meaning                                                                               |
| ------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `FAST_MS`           | `350`      | Elapsed time below this, with a real HTTP response, is green.                         |
| `DEAD_MS`           | `10000`    | Elapsed time at or above this is red.                                                 |
| `GRID_COLUMNS`      | `20`       | Default row width for `rowsOf`.                                                       |
| `MIN_HTTP_STATUS`   | `100`      | Lowest status that counts as a real HTTP response.                                    |
| `MAX_HTTP_STATUS`   | `599`      | Highest status that counts as a real HTTP response.                                   |
| `ProbeColor.Green`  | `"green"`  | A fast, real HTTP response.                                                           |
| `ProbeColor.Yellow` | `"yellow"` | A slow, real HTTP response that is still under `DEAD_MS`.                             |
| `ProbeColor.Red`    | `"red"`    | No HTTP response, a dead elapsed time, a negative elapsed time, or a rejected status. |
| `ProbeColor.Gray`   | `"gray"`   | The cell was not checked, or the timestamp is in the future.                          |

`ProbeColor` is frozen. Compare colors to these strings, or to the `ProbeColor` fields. They are the same values.

### `classifyProbe(sample, nowMs)`

Return the color for one probe reading.

`sample` may be `null`. When it is an object, the fields are:

| Field         | Type             | Role                                                                                                  |
| ------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `checkedAtMs` | number or `null` | When the probe finished, in milliseconds since the Unix epoch. `null` means the cell was not checked. |
| `http`        | boolean          | `true` when an HTTP response arrived. `false` when it did not.                                        |
| `elapsedMs`   | number or `null` | Time until that response, in milliseconds. `null` means there is no measurement.                      |
| `status`      | number or `null` | HTTP status code, when one was recorded. Omitted and `null` mean no code was recorded.                |

`nowMs` is the sweep clock, in the same epoch milliseconds.

The checks run in this order. The first match wins.

1. `sample` is `null` or `undefined`, or `checkedAtMs` is `null` or `undefined`: gray.
2. `nowMs - checkedAtMs` is not a finite number, or it is negative: gray. A timestamp in the future is not a reading.
3. `http` is `false`, or `elapsedMs` is `null` or `undefined`: red.
4. `elapsedMs` is not a finite number, is negative, or is greater than or equal to `DEAD_MS`: red.
5. `status` is present and rejected: red. `null` and `undefined` are not rejected. A rejected status is anything other than an integer from `MIN_HTTP_STATUS` through `MAX_HTTP_STATUS`, including `0`, negatives, fractions, and values above 599.
6. `elapsedMs` is below `FAST_MS`: green.
7. Otherwise: yellow.

`id` is ignored here. Status codes from 100 through 599 are read and then do not change the color. A fast 500 is green. A slow 503 is yellow. A fast response with status `0` is red.

### `paintSweep(previous, samples, nowMs)`

Paint one sweep.

| Argument   | Type            | Role                                                                                        |
| ---------- | --------------- | ------------------------------------------------------------------------------------------- |
| `previous` | sweep or `null` | The last returned sweep. `null` means there is no history.                                  |
| `samples`  | array or `null` | The readings for this pass. `null` or `undefined` means the probe process produced no list. |
| `nowMs`    | number          | Sweep clock, passed through to `classifyProbe` and stored as `at`.                          |

The return value is a sweep:

| Field   | Type             | Meaning                                                                                                                                                                                                                                |
| ------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `at`    | string or `null` | ISO-8601 time of this sweep when `samples` is an array and `nowMs` is finite. When the whole sweep is held, this is the previous `at`, or `null` when there was no previous sweep. A non-finite `nowMs` on a live sweep stores `null`. |
| `held`  | boolean          | `true` only when `samples` was `null` or `undefined`. A live sweep is `false` even when some cells are held.                                                                                                                           |
| `cells` | array            | One cell per sample, in sample order. A held sweep is a shallow copy of the previous cells.                                                                                                                                            |

Each cell is `{ id, color, elapsedMs, status, held }`.

| Field       | Meaning                                                                             |
| ----------- | ----------------------------------------------------------------------------------- |
| `id`        | The sample id. `null` when the sample entry itself is `null`.                       |
| `color`     | A `ProbeColor` string.                                                              |
| `elapsedMs` | The elapsed time kept for this cell, or `null`.                                     |
| `status`    | The HTTP status kept for this cell, or `null`.                                      |
| `held`      | `true` when this cell kept a previous non-gray color because this reading was gray. |

Hold rules:

- `samples` of `null` or `undefined` copies the previous cells and sets `held` on the sweep. Colors are not recomputed. An empty history returns `{ at: null, held: true, cells: [] }`.
- An array, including an empty array, is a live sweep. The array is the whole grid. Ids that are absent from it are dropped. An empty array does not keep the previous cells.
- A gray reading keeps the previous cell with the same `id`, when that cell has a non-gray string color. The kept fields are `color`, `elapsedMs`, and `status`. The cell's `held` flag is `true`. The sweep's `held` flag stays `false`.
- Ids are matched with strict equality. The first previous cell with that id wins. Position in the array is not used. A sample with `id` of `null` or `undefined` does not match a previous cell.
- A gray reading with no previous non-gray cell stays gray, and the cell records the sample's own `elapsedMs` and `status`.
- Any other color replaces the previous cell. `held` on that cell is `false`.
- `samples` must be an array or `null`/`undefined`. Any other value throws `TypeError`.

### `rowsOf(cells, columns)`

Split `cells` into rows. This does not classify anything.

| Argument  | Type             | Role                                                                                                                  |
| --------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `cells`   | array            | Cell objects, usually `sweep.cells`.                                                                                  |
| `columns` | number, optional | Row width. A positive integer is used. Any other value, including `0`, fractions, and negatives, uses `GRID_COLUMNS`. |

The last row may be shorter. An empty `cells` array returns an empty array.

## Design notes

The grid answers two questions: did HTTP come back, and how long did it take. It does not grade the application behind the status code. A fast 500 means the process answered. A slow 200 means the caller waited. Painting 500 as red would hide a latency problem behind an error that already has its own log.

Status is still an input. It is stored on the cell so a dashboard can show the code next to the color. It changes the color only when it cannot be an HTTP status. `null` means the probe did not record one, which is normal for a transport failure and for a caller that only has timing. A zero, a fraction, or a code outside 100–599 means the reading is not an HTTP response, so the cell is red even when the elapsed time is short.

Gray is not down. Gray means this sweep has no usable timestamp for that id. The timestamp is missing, or it is later than `nowMs`. The previous non-gray color stays on the screen until a real reading replaces it. A negative age therefore holds the last color of that id, and it does not apply the new status or the new elapsed time. A negative elapsed time is different: the timestamp is usable, and the measurement says the duration is impossible, so the cell becomes red and the new status is recorded.

The whole-sweep hold is only for a missing sample list. That is the probe process dying. A live list with one unchecked cell holds only that cell, and only when its id matches a previous non-gray cell. Reordering the list cannot move a color onto a neighbor. Matching by array index did that: the first unchecked sample inherited whatever cell used to sit in slot zero.

`rowsOf` is layout only. Twenty columns is the width the dashboard grid was built around. Pass another positive integer to reuse the same cells in a narrower layout.

This module does not open sockets, schedule probes, or store sweeps. Names, URLs, and credentials stay with the caller. The caller chooses which endpoints exist and what their ids are.

## Compatibility

Version 1.1.0 keeps the function names, the argument order, and the color strings `"green"`, `"yellow"`, `"red"`, and `"gray"`.

The hold in `paintSweep` is by `id`. Version 1.0.0 used the array index, so a reordered sample list could paint one endpoint with another endpoint's color and status.

`classifyProbe` reads `status`. An integer from 100 through 599 still does not change the color, and a fast 500 stays green. Any other status, except `null` and `undefined`, is red. Version 1.0.0 accepted `status` and did not read it.

`elapsedMs` must be a finite number. `NaN` and a numeric string are red. Version 1.0.0 treated `NaN` as yellow, and it coerced numeric strings in the comparisons.

`rowsOf` uses `GRID_COLUMNS` unless `columns` is a positive integer. Version 1.0.0 used any truthy number, including a fraction or a negative width.

A live sweep with a non-finite `nowMs` stores `at` as `null`. Version 1.0.0 threw. A `samples` value that is neither an array nor nullish throws `TypeError`.

`ProbeColor`, `MIN_HTTP_STATUS`, and `MAX_HTTP_STATUS` are new exports.

## License

Released under the MIT License. The full text is in [LICENSE](LICENSE).
