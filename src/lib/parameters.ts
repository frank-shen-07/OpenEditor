import type { ParameterObject } from "../types";

/** Reorder visible (non-body) parameters while keeping body params in place. */
export function reorderDisplayParameters(
  all: ParameterObject[],
  from: number,
  to: number,
): ParameterObject[] {
  const displayIndices: number[] = [];
  const display: ParameterObject[] = [];
  for (let i = 0; i < all.length; i++) {
    if (all[i].in !== "body") {
      displayIndices.push(i);
      display.push(all[i]);
    }
  }

  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= display.length ||
    to >= display.length
  ) {
    return all;
  }

  const nextDisplay = [...display];
  const [moved] = nextDisplay.splice(from, 1);
  nextDisplay.splice(to, 0, moved);

  const result = [...all];
  displayIndices.forEach((allIdx, i) => {
    result[allIdx] = nextDisplay[i];
  });
  return result;
}
