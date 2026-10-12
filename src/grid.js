export const GRID_COLUMNS = 20;
export const FAST_MS = 350;
export const DEAD_MS = 10000;
export const MIN_HTTP_STATUS = 100;
export const MAX_HTTP_STATUS = 599;

export const ProbeColor = Object.freeze({
  Green: "green",
  Yellow: "yellow",
  Red: "red",
  Gray: "gray"
});

export function classifyProbe(sample, nowMs) {
  if (sample == null || sample.checkedAtMs == null) {
    return ProbeColor.Gray;
  }

  const ageMs = nowMs - sample.checkedAtMs;
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return ProbeColor.Gray;
  }

  if (sample.http === false || sample.elapsedMs == null) {
    return ProbeColor.Red;
  }

  if (!Number.isFinite(sample.elapsedMs) || sample.elapsedMs < 0 || sample.elapsedMs >= DEAD_MS) {
    return ProbeColor.Red;
  }

  if (isStatusRejected(sample.status)) {
    return ProbeColor.Red;
  }

  if (sample.elapsedMs < FAST_MS) {
    return ProbeColor.Green;
  }

  return ProbeColor.Yellow;
}

export function paintSweep(previous, samples, nowMs) {
  const priorCells = previousCells(previous);
  if (samples == null) {
    return {
      at: previous == null ? null : (previous.at ?? null),
      held: true,
      cells: priorCells.map((cell) => ({ ...cell }))
    };
  }

  if (!Array.isArray(samples)) {
    throw new TypeError("samples must be an array or null");
  }

  const cellsById = indexCellsById(priorCells);
  return {
    at: timestampFromMs(nowMs),
    held: false,
    cells: samples.map((sample) => paintCell(sample, cellsById, nowMs))
  };
}

export function rowsOf(cells, columns) {
  const width = resolveColumnCount(columns);
  const rows = [];
  for (let index = 0; index < cells.length; index += width) {
    rows.push(cells.slice(index, index + width));
  }
  return rows;
}

function previousCells(previous) {
  if (previous == null || !Array.isArray(previous.cells)) {
    return [];
  }
  return previous.cells;
}

function indexCellsById(cells) {
  const cellsById = new Map();
  for (const cell of cells) {
    if (cell == null || cell.id == null || cellsById.has(cell.id)) {
      continue;
    }
    cellsById.set(cell.id, cell);
  }
  return cellsById;
}

function paintCell(sample, cellsById, nowMs) {
  const color = classifyProbe(sample, nowMs);
  const previousCell = previousCellFor(sample, cellsById);
  if (color === ProbeColor.Gray && isHoldable(previousCell)) {
    return {
      id: sample.id,
      color: previousCell.color,
      elapsedMs: valueOrNull(previousCell.elapsedMs),
      status: valueOrNull(previousCell.status),
      held: true
    };
  }

  return {
    id: sample == null ? null : sample.id,
    color,
    elapsedMs: sample == null ? null : valueOrNull(sample.elapsedMs),
    status: sample == null ? null : valueOrNull(sample.status),
    held: false
  };
}

function previousCellFor(sample, cellsById) {
  if (sample == null || sample.id == null) {
    return undefined;
  }
  return cellsById.get(sample.id);
}

function isHoldable(cell) {
  return (
    cell != null &&
    typeof cell.color === "string" &&
    cell.color !== "" &&
    cell.color !== ProbeColor.Gray
  );
}

function valueOrNull(value) {
  return value == null ? null : value;
}

function isStatusRejected(status) {
  if (status == null) {
    return false;
  }
  if (typeof status !== "number" || !Number.isInteger(status)) {
    return true;
  }
  return status < MIN_HTTP_STATUS || status > MAX_HTTP_STATUS;
}

function resolveColumnCount(columns) {
  if (Number.isInteger(columns) && columns > 0) {
    return columns;
  }
  return GRID_COLUMNS;
}

function timestampFromMs(nowMs) {
  if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) {
    return null;
  }
  return new Date(nowMs).toISOString();
}
