import { dump, load } from "js-yaml";
import type { OpenAPIDocument } from "../types";

export function parseDocument(text: string): OpenAPIDocument {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Document is empty");
  }
  // js-yaml handles JSON too (YAML is a superset), but try JSON first for
  // clearer error messages on .json files.
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as OpenAPIDocument;
    } catch {
      /* fall through to YAML */
    }
  }
  const parsed = load(trimmed);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Document must be a YAML/JSON mapping at the top level");
  }
  return parsed as OpenAPIDocument;
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
