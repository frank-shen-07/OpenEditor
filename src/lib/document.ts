import { load } from "js-yaml";
import type { OpenAPIDocument } from "../types";
import { normalizeDocument } from "./normalize";
import { serializeDocument } from "./exportDocument";
import { buildExportYaml, getImportSnapshot, isPreserveImport } from "./preserveImport";

export function parseDocument(text: string): OpenAPIDocument {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Document is empty");
  }
  let parsed: unknown;
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

/** Export/display YAML — anchored imports never re-serialize to OpenAPI 3. */
export function getYamlForDisplay(
  doc: OpenAPIDocument,
  sourceYaml: string | null,
  _useCanonicalYaml?: boolean
): string {
  if (sourceYaml && getImportSnapshot(doc)) {
    return buildExportYaml(sourceYaml, doc);
  }
  if (sourceYaml && isPreserveImport(doc)) {
    return buildExportYaml(sourceYaml, doc);
  }
  if (sourceYaml) return sourceYaml;
  return serializeToYaml(doc);
}

export function downloadYaml(
  doc: OpenAPIDocument,
  filename?: string,
  options?: {
    sourceYaml?: string | null;
    useCanonicalYaml?: boolean;
    preserveImport?: boolean;
  }
) {
  const text = getYamlForDisplay(
    doc,
    options?.sourceYaml ?? null,
    options?.useCanonicalYaml
  );
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
