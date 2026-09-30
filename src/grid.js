export const GRID_COLUMNS = 20;
export const FAST_MS = 350;
export const DEAD_MS = 10000;

export function classifyProbe(sample, nowMs) {
  if (!sample || sample.checkedAtMs == null) return "gray";
  const age = nowMs - sample.checkedAtMs;
  if (!Number.isFinite(age) || age < 0) return "gray";
  if (sample.http === false || sample.elapsedMs == null) return "red";
  if (sample.elapsedMs < 0) return "red";
  if (sample.elapsedMs >= DEAD_MS) return "red";
  if (sample.elapsedMs < FAST_MS) return "green";
  return "yellow";
}

export function paintSweep(previous, samples, nowMs) {
  const prior = previous && Array.isArray(previous.cells) ? previous.cells : [];
  if (!samples) {
    return {
      at: previous ? previous.at : null,
      held: true,
      cells: prior.map((cell) => ({ ...cell }))
    };
  }
  const cells = samples.map((sample, index) => {
    const color = classifyProbe(sample, nowMs);
    const old = prior[index];
    if (color === "gray" && old && old.color && old.color !== "gray") {
      return { id: sample.id, color: old.color, elapsedMs: old.elapsedMs, status: old.status, held: true };
    }
    return {
      id: sample.id,
      color,
      elapsedMs: sample.elapsedMs == null ? null : sample.elapsedMs,
      status: sample.status == null ? null : sample.status,
      held: false
    };
  });
  return { at: new Date(nowMs).toISOString(), held: false, cells };
}

export function rowsOf(cells, columns) {
  const width = columns || GRID_COLUMNS;
  const rows = [];
  for (let i = 0; i < cells.length; i += width) rows.push(cells.slice(i, i + width));
  return rows;
}
