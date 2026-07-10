import { dump, load } from "js-yaml";
import type { OpenAPIDocument, PathItemObject, SchemaObject, TagObject } from "../types";
import {
  detectSpecVersion,
  OPENEDITOR_KEY,
  tagSpecVersion,
  type OpenEditorMeta,
} from "./specVersion";

export interface ImportSnapshot {
  pathKeys: string[];
  schemaKeys: string[];
  tagNames: string[];
}

export interface DocumentAdditions {
  paths?: Record<string, PathItemObject>;
  tags?: TagObject[];
  components?: { schemas?: Record<string, SchemaObject> };
}

export interface PreserveImportMeta extends OpenEditorMeta {
  preserveImport?: boolean;
  importSnapshot?: ImportSnapshot;
  additions?: DocumentAdditions;
}

function loadParsed(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Document is empty");
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return load(trimmed);
    }
  }
  return load(trimmed);
}

/** Parse an import without normalizing or rewriting the spec structure. */
export function parseImport(text: string): {
  doc: OpenAPIDocument;
  sourceYaml: string;
  snapshot: ImportSnapshot;
} {
  const sourceYaml = text.replace(/\r\n/g, "\n");
  const parsed = loadParsed(sourceYaml);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Document must be a YAML/JSON mapping at the top level");
  }

  const doc = structuredClone(parsed) as OpenAPIDocument;
  const version = detectSpecVersion(doc);
  const snapshot = captureSnapshot(doc);

  const tagged = tagPreserveImport(tagSpecVersion(doc, version), snapshot, {});
  return { doc: tagged, sourceYaml, snapshot };
}

export function captureSnapshot(doc: OpenAPIDocument): ImportSnapshot {
  return {
    pathKeys: Object.keys(doc.paths ?? {}),
    schemaKeys: Object.keys(doc.components?.schemas ?? {}),
    tagNames: (doc.tags ?? []).map((t) => t.name).filter((n): n is string => !!n),
  };
}

export function getPreserveMeta(doc: OpenAPIDocument): PreserveImportMeta {
  return (doc[OPENEDITOR_KEY] as PreserveImportMeta | undefined) ?? {};
}

export function isPreserveImport(doc: OpenAPIDocument): boolean {
  return getPreserveMeta(doc).preserveImport === true;
}

export function tagPreserveImport(
  doc: OpenAPIDocument,
  snapshot: ImportSnapshot,
  additions: DocumentAdditions
): OpenAPIDocument {
  const prev = getPreserveMeta(doc);
  return {
    ...doc,
    [OPENEDITOR_KEY]: {
      ...prev,
      preserveImport: true,
      importSnapshot: snapshot,
      additions,
    },
  };
}

export function getAdditions(doc: OpenAPIDocument): DocumentAdditions {
  return getPreserveMeta(doc).additions ?? {};
}

export function getImportSnapshot(doc: OpenAPIDocument): ImportSnapshot | null {
  return getPreserveMeta(doc).importSnapshot ?? null;
}

function emptyAdditions(additions: DocumentAdditions): boolean {
  const pathCount = Object.keys(additions.paths ?? {}).length;
  const schemaCount = Object.keys(additions.components?.schemas ?? {}).length;
  const tagCount = (additions.tags ?? []).length;
  return pathCount === 0 && schemaCount === 0 && tagCount === 0;
}

export function computeAdditions(
  doc: OpenAPIDocument,
  snapshot: ImportSnapshot
): DocumentAdditions {
  const additionPaths: Record<string, PathItemObject> = {};
  for (const [key, value] of Object.entries(doc.paths ?? {})) {
    if (!snapshot.pathKeys.includes(key)) additionPaths[key] = value;
  }

  const additionSchemas: Record<string, SchemaObject> = {};
  for (const [key, value] of Object.entries(doc.components?.schemas ?? {})) {
    if (!snapshot.schemaKeys.includes(key)) additionSchemas[key] = value;
  }

  const additionTags = (doc.tags ?? []).filter(
    (t) => t.name && !snapshot.tagNames.includes(t.name)
  );

  return {
    paths: Object.keys(additionPaths).length > 0 ? additionPaths : undefined,
    tags: additionTags.length > 0 ? additionTags : undefined,
    components:
      Object.keys(additionSchemas).length > 0 ? { schemas: additionSchemas } : undefined,
  };
}

/** Recompute which paths/schemas/tags are additions after an edit. */
export function syncImportAdditions(doc: OpenAPIDocument): OpenAPIDocument {
  const snapshot = getImportSnapshot(doc);
  if (!snapshot) return doc;
  return tagPreserveImport(doc, snapshot, computeAdditions(doc, snapshot));
}

/** Build export text: original import plus any new routes/schemas only. */
export function buildExportYaml(sourceYaml: string, doc: OpenAPIDocument): string {
  const additions = getAdditions(doc);
  if (emptyAdditions(additions)) return sourceYaml;

  let result = sourceYaml.replace(/\r\n/g, "\n").trimEnd();
  const blocks: string[] = [];

  if (additions.paths && Object.keys(additions.paths).length > 0) {
    blocks.push(formatPathsInsertion(additions.paths));
  }

  if (additions.tags && additions.tags.length > 0) {
    blocks.push(
      dump({ tags: additions.tags }, { lineWidth: 120, sortKeys: false, noRefs: true }).trimEnd()
    );
  }

  const addedSchemas = additions.components?.schemas;
  if (addedSchemas && Object.keys(addedSchemas).length > 0) {
    blocks.push(
      dump(
        { components: { schemas: addedSchemas } },
        { lineWidth: 120, sortKeys: false, noRefs: true }
      ).trimEnd()
    );
  }

  if (blocks.length === 0) return sourceYaml;

  const designedMarker = "\n  # Copy your group-designed routes";
  const designedMarkerAlt = "\n  # ==================== DESIGNED ROUTES";
  if (result.includes(designedMarker)) {
    result = result.replace(designedMarker, `\n${blocks.join("\n\n")}${designedMarker}`);
  } else if (result.includes(designedMarkerAlt)) {
    result = result.replace(designedMarkerAlt, `\n${blocks.join("\n\n")}${designedMarkerAlt}`);
  } else {
    result = `${result}\n\n# --- Added in OpenEditor ---\n${blocks.join("\n\n")}\n`;
  }

  return result;
}

function formatPathsInsertion(paths: Record<string, PathItemObject>): string {
  const lines: string[] = [];
  for (const [path, item] of Object.entries(paths)) {
    const itemYaml = dump(item, { lineWidth: 120, sortKeys: false, noRefs: true }).trimEnd();
    const indented = itemYaml
      .split("\n")
      .map((line) => (line ? `    ${line}` : ""))
      .join("\n");
    lines.push(`  ${path}:\n${indented}`);
  }
  return lines.join("\n");
}

/** Re-anchor from source text after cloud load (content JSON may have been normalized). */
export function reanchorLoadedDocument(
  content: OpenAPIDocument,
  sourceYaml: string
): OpenAPIDocument {
  const { doc: anchored } = parseImport(sourceYaml);
  const merged: OpenAPIDocument = {
    ...anchored,
    info: content.info ?? anchored.info,
    paths: content.paths ?? anchored.paths,
    tags: content.tags ?? anchored.tags,
    components: content.components ?? anchored.components,
    servers: content.servers ?? anchored.servers,
  };
  return syncImportAdditions(merged);
}

/** Drop import anchoring and allow full re-serialized export. */
export function releaseImportAnchor(doc: OpenAPIDocument): OpenAPIDocument {
  const next = { ...doc } as OpenAPIDocument;
  const meta = getPreserveMeta(next);
  delete (next as Record<string, unknown>)[OPENEDITOR_KEY];
  if (meta.specVersion) return tagSpecVersion(next, meta.specVersion);
  return next;
}
