import { dump } from "js-yaml";
import type { OperationObject, ResponseObject } from "../types";

/** Internal suffix for duplicate HTTP status codes (not written to export YAML). */
export const RESPONSE_KEY_DUP = "__";

const YAML_DUMP_OPTS = {
  noRefs: true,
  lineWidth: 120,
  sortKeys: false,
};

export function responseDisplayCode(storageKey: string): string {
  const idx = storageKey.indexOf(RESPONSE_KEY_DUP);
  return idx < 0 ? storageKey : storageKey.slice(0, idx);
}

/** Unique storage key — allows multiple responses with the same display status code. */
export function uniqueResponseKey(
  displayCode: string,
  existingKeys: Iterable<string>
): string {
  const base = displayCode.trim() || "default";
  const used = new Set(existingKeys);
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}${RESPONSE_KEY_DUP}${i}`)) i++;
  return `${base}${RESPONSE_KEY_DUP}${i}`;
}

export function listResponseEntries(
  responses: Record<string, ResponseObject> | undefined
): { key: string; code: string; response: ResponseObject }[] {
  if (!responses) return [];
  return Object.entries(responses).map(([key, response]) => ({
    key,
    code: responseDisplayCode(key),
    response,
  }));
}

function formatStatusCodeForYaml(code: string): string {
  if (/^\d+$/.test(code)) return `'${code}'`;
  return code;
}

/** Expand internal keys like 200__2 back to duplicate status codes in dumped YAML. */
export function expandDuplicateResponseKeysInYaml(yaml: string): string {
  return yaml
    .replace(/^(\s*)['"]([^'"]+)__\d+['"]:/gm, (_m, sp, code) => `${sp}${formatStatusCodeForYaml(code)}:`)
    .replace(/^(\s*)([A-Za-z0-9._-]+)__\d+:/gm, (_m, sp, code) => `${sp}${formatStatusCodeForYaml(code)}:`);
}

export function dumpResponsesYaml(
  responses: Record<string, ResponseObject>,
  indent: string,
  formatResponse: (resp: ResponseObject) => ResponseObject
): string {
  const lines: string[] = [`${indent}responses:`];
  for (const { code, response } of listResponseEntries(responses)) {
    lines.push(`${indent}  ${formatStatusCodeForYaml(code)}:`);
    const body = dump(formatResponse(response), YAML_DUMP_OPTS).trimEnd();
    for (const line of body.split("\n")) {
      lines.push(line ? `${indent}    ${line}` : "");
    }
  }
  return lines.join("\n");
}

/** Dump an operation, allowing duplicate HTTP status codes under responses. */
export function dumpOperationYaml(
  op: OperationObject,
  indent: string,
  formatResponse: (resp: ResponseObject) => ResponseObject,
  formatOperation: (op: OperationObject) => OperationObject
): string {
  const formatted = formatOperation(op);
  const { responses, ...rest } = formatted;
  const lines: string[] = [];

  const restYaml = dump(rest, YAML_DUMP_OPTS).trimEnd();
  if (restYaml) {
    for (const line of restYaml.split("\n")) {
      lines.push(line ? `${indent}${line}` : "");
    }
  }

  if (responses && Object.keys(responses).length > 0) {
    lines.push(dumpResponsesYaml(responses, indent, formatResponse));
  }

  return lines.join("\n");
}
