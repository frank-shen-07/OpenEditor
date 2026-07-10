import { dump, load } from "js-yaml";
import type { OpenAPIDocument } from "../types";
import { normalizeDocument } from "./normalize";

export function parseDocument(text: string): OpenAPIDocument {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Document is empty");
  }
  let parsed: unknown;
  // js-yaml handles JSON too (YAML is a superset), but try JSON first for
  // clearer error messages on .json files.
  if (trimmed.startsWith("{")) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parsed = load(trimmed);
    }
  } else {
    parsed = load(trimmed);
  }
  return normalizeDocument(parsed);
}

export function serializeToYaml(doc: OpenAPIDocument): string {
  return dump(doc, {
    noRefs: true,
    lineWidth: 120,
  });
}

export function downloadYaml(doc: OpenAPIDocument, filename?: string) {
  const text = serializeToYaml(doc);
  const name =
    filename ??
    `${(doc.info?.title ?? "openapi").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "openapi"}.yaml`;
  const blob = new Blob([text], { type: "application/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Structured clone with plain-object semantics for immutable updates. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
