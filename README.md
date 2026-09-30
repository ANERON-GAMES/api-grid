# api-grid

Color a health grid from whether HTTP came back, and how long it took.

A 500 that returns in 80 ms is green. A 200 that takes 900 ms is yellow. A probe that gets no HTTP response inside 10 seconds is red. A cell that was never checked this sweep stays gray.

When the probe process itself dies, the grid keeps the last colors. Repainting every cell red because the painter missed a beat hides the one endpoint that is actually down.

```js
import { paintSweep } from "./src/index.js";

const sweep = paintSweep(previous, [
  { id: "core", checkedAtMs: Date.now(), http: true, elapsedMs: 80, status: 500 },
  { id: "mail", checkedAtMs: Date.now(), http: true, elapsedMs: 900, status: 200 },
  { id: "edge", checkedAtMs: Date.now(), http: false, elapsedMs: null, status: null }
], Date.now());
```

`rowsOf` lays the cells out at 20 per row. The thresholds are exported, so a dashboard can reuse the same contract without copying the numbers into CSS.

```
node --test
```

MIT. Vadim Gubin.
