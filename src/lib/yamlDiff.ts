import { diffLines } from "diff";

export type DiffLineType = "same" | "added" | "removed";

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

export interface YamlDiffResult {
  lines: DiffLine[];
  added: number;
  removed: number;
  hasChanges: boolean;
}

export function buildYamlDiff(oldText: string, newText: string): YamlDiffResult {
  const changes = diffLines(oldText, newText);
  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;

  for (const part of changes) {
    const type: DiffLineType = part.added ? "added" : part.removed ? "removed" : "same";
    const partLines = part.value.split("\n");
    if (partLines[partLines.length - 1] === "") partLines.pop();

    for (const text of partLines) {
      lines.push({ type, text });
      if (type === "added") added++;
      else if (type === "removed") removed++;
    }
  }

  return { lines, added, removed, hasChanges: added > 0 || removed > 0 };
}
