import type { OperationObject, ResponseObject } from "../types";

export const OP_OPENEDITOR_KEY = "x-openeditor";

export interface OperationEditorMeta {
  responseOrder?: string[];
}

/** Response order for display/export. Object keys like "200" sort numerically in JS. */
export function getResponseOrder(op: OperationObject): string[] {
  const responses = op.responses ?? {};
  const codes = Object.keys(responses);
  if (codes.length === 0) return [];

  const meta = op[OP_OPENEDITOR_KEY] as OperationEditorMeta | undefined;
  const saved = meta?.responseOrder?.filter((code) => code in responses) ?? [];
  const missing = codes.filter((code) => !saved.includes(code));
  return [...saved, ...missing];
}

export function withResponseOrder(
  op: OperationObject,
  order: string[]
): OperationObject {
  const responses = op.responses ?? {};
  const valid = order.filter((code) => code in responses);
  for (const code of Object.keys(responses)) {
    if (!valid.includes(code)) valid.push(code);
  }

  const prev = op[OP_OPENEDITOR_KEY] as OperationEditorMeta | undefined;
  return {
    ...op,
    [OP_OPENEDITOR_KEY]: {
      ...prev,
      responseOrder: valid,
    },
  };
}

export function reorderResponses(
  op: OperationObject,
  from: number,
  to: number
): OperationObject {
  const order = getResponseOrder(op);
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) {
    return op;
  }
  const nextOrder = [...order];
  const [moved] = nextOrder.splice(from, 1);
  nextOrder.splice(to, 0, moved);
  return withResponseOrder(op, nextOrder);
}

export function appendResponseOrder(op: OperationObject, code: string): OperationObject {
  return withResponseOrder(op, [...getResponseOrder(op), code]);
}

export function renameInResponseOrder(
  op: OperationObject,
  oldCode: string,
  newCode: string
): OperationObject {
  const order = getResponseOrder(op).map((code) => (code === oldCode ? newCode : code));
  return withResponseOrder(op, order);
}

export function removeFromResponseOrder(op: OperationObject, code: string): OperationObject {
  return withResponseOrder(
    op,
    getResponseOrder(op).filter((c) => c !== code)
  );
}

/** Prefix keys so js-yaml preserves insertion order (numeric codes sort otherwise). */
export function encodeResponsesForYamlDump(
  op: OperationObject
): OperationObject {
  const responses = op.responses;
  if (!responses || Object.keys(responses).length === 0) return op;

  const order = getResponseOrder(op);
  const encoded: Record<string, ResponseObject> = {};
  order.forEach((code, index) => {
    if (responses[code]) encoded[`${index}__${code}`] = responses[code];
  });

  const next = { ...op, responses: encoded } as OperationObject;
  const meta = next[OP_OPENEDITOR_KEY] as OperationEditorMeta | undefined;
  if (meta) {
    const { responseOrder: _ignored, ...rest } = meta;
    if (Object.keys(rest).length > 0) next[OP_OPENEDITOR_KEY] = rest;
    else delete next[OP_OPENEDITOR_KEY];
  }
  return next;
}

export function expandOrderedResponseKeysInYaml(yaml: string): string {
  return yaml.replace(
    /^(\s*)'?(\d+)__(\d{3}|default)'?:/gm,
    (_match, indent, _index, code) => `${indent}'${code}':`
  );
}

export function encodeOperationResponsesInDocument<T extends { paths?: Record<string, unknown> }>(
  doc: T
): T {
  const paths = doc.paths;
  if (!paths) return doc;

  const nextPaths: Record<string, unknown> = {};
  for (const [path, item] of Object.entries(paths)) {
    if (!item || typeof item !== "object") {
      nextPaths[path] = item;
      continue;
    }
    const pathItem = { ...(item as Record<string, unknown>) };
    for (const [key, value] of Object.entries(pathItem)) {
      if (!value || typeof value !== "object") continue;
      if (
        ["get", "post", "put", "patch", "delete", "options", "head", "trace"].includes(key)
      ) {
        pathItem[key] = encodeResponsesForYamlDump(value as OperationObject);
      }
    }
    nextPaths[path] = pathItem;
  }

  return { ...doc, paths: nextPaths };
}
