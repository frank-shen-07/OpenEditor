import { load } from "js-yaml";
import type { OpenAPIDocument } from "../types";
import { normalizeDocument } from "./normalize";
import { serializeDocument } from "./exportDocument";

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
  return serializeDocument(doc);
}

/** Prefer preserved import text; fall back to serializing the document object. */
export function getYamlForDisplay(
  doc: OpenAPIDocument,
  sourceYaml: string | null,
  useCanonicalYaml: boolean
): string {
  if (!useCanonicalYaml && sourceYaml) return sourceYaml;
  return serializeToYaml(doc);
}

export function downloadYaml(
  doc: OpenAPIDocument,
  filename?: string,
  options?: { sourceYaml?: string | null; useCanonicalYaml?: boolean }
) {
  const useCanonical = options?.useCanonicalYaml ?? true;
  const text = getYamlForDisplay(doc, options?.sourceYaml ?? null, useCanonical);
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
