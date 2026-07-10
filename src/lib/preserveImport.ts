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

const PATHS_DESIGNED_MARKERS = [
  "\n  # Copy your group-designed routes",
  "\n  # ==================== DESIGNED ROUTES",
  "\n  # === DESIGNED ROUTES ===",
  "\n  # DESIGNED ROUTES",
];

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

function emptyAdditions(additions: DocumentAdditions): boolean {
  return (
    Object.keys(additions.paths ?? {}).length === 0 &&
    Object.keys(additions.components?.schemas ?? {}).length === 0 &&
    (additions.tags ?? []).length === 0
  );
}

/** Resolve additions from live doc state (not stale cached metadata). */
export function resolveAdditions(doc: OpenAPIDocument): DocumentAdditions {
  const snapshot = getImportSnapshot(doc);
  if (!snapshot) return getAdditions(doc);
  return computeAdditions(doc, snapshot);
}

/** Recompute additions after an edit, keeping import metadata from the anchor. */
export function syncImportAdditions(
  doc: OpenAPIDocument,
  snapshot?: ImportSnapshot
): OpenAPIDocument {
  const snap = snapshot ?? getImportSnapshot(doc);
  if (!snap) return doc;
  const additions = computeAdditions(doc, snap);
  return tagPreserveImport(doc, snap, additions);
}

/** Carry import anchor metadata forward when child editors spread a stale doc object. */
export function mergeImportAnchor(prev: OpenAPIDocument, next: OpenAPIDocument): OpenAPIDocument {
  if (!isPreserveImport(prev)) return next;
  const snapshot = getImportSnapshot(prev);
  if (!snapshot) return next;
  return syncImportAdditions(
    {
      ...next,
      [OPENEDITOR_KEY]: prev[OPENEDITOR_KEY],
    },
    snapshot
  );
}

/** Build export text: original import plus new routes/schemas inserted in the right place. */
export function buildExportYaml(sourceYaml: string, doc: OpenAPIDocument): string {
  const additions = resolveAdditions(doc);
  if (emptyAdditions(additions)) return sourceYaml;

  let result = sourceYaml.replace(/\r\n/g, "\n");

  if (additions.paths && Object.keys(additions.paths).length > 0) {
    result = insertPathsIntoSourceYaml(result, formatPathsInsertion(additions.paths));
  }

  if (additions.tags && additions.tags.length > 0) {
    const tagsYaml = dump({ tags: additions.tags }, { lineWidth: 120, sortKeys: false, noRefs: true }).trimEnd();
    result = insertTopLevelBlock(result, "tags:", tagsYaml);
  }

  const addedSchemas = additions.components?.schemas;
  if (addedSchemas && Object.keys(addedSchemas).length > 0) {
    const schemaYaml = dump(
      { components: { schemas: addedSchemas } },
      { lineWidth: 120, sortKeys: false, noRefs: true }
    ).trimEnd();
    result = insertTopLevelBlock(result, "components:", schemaYaml);
  }

  return result;
}

/** Insert new path entries inside the existing `paths:` block. */
export function insertPathsIntoSourceYaml(sourceYaml: string, pathsBlock: string): string {
  for (const marker of PATHS_DESIGNED_MARKERS) {
    if (sourceYaml.includes(marker)) {
      return sourceYaml.replace(marker, `\n${pathsBlock}${marker}`);
    }
  }

  const lines = sourceYaml.split("\n");
  const pathsIdx = lines.findIndex((line) => /^paths:\s*$/.test(line));
  if (pathsIdx < 0) {
    return `${sourceYaml.trimEnd()}\npaths:\n${pathsBlock}\n`;
  }

  let insertAt = lines.length;
  for (let i = pathsIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    if (!/^\s/.test(line) && /^[A-Za-z0-9_"'-]+:/.test(line)) {
      insertAt = i;
      break;
    }
  }

  const blockLines = pathsBlock.split("\n");
  lines.splice(insertAt, 0, ...blockLines);
  return lines.join("\n");
}

function insertTopLevelBlock(sourceYaml: string, keyPrefix: string, blockYaml: string): string {
  const lines = sourceYaml.split("\n");
  const insertAt = lines.findIndex((line) => line.startsWith(keyPrefix));
  if (insertAt >= 0) {
    lines.splice(insertAt, 0, blockYaml, "");
    return lines.join("\n");
  }
  return `${sourceYaml.trimEnd()}\n\n${blockYaml}\n`;
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
  const { doc: anchored, snapshot } = parseImport(sourceYaml);
  const merged: OpenAPIDocument = {
    ...anchored,
    info: content.info ?? anchored.info,
    paths: content.paths ?? anchored.paths,
    tags: content.tags ?? anchored.tags,
    components: content.components ?? anchored.components,
    servers: content.servers ?? anchored.servers,
  };
  return syncImportAdditions(merged, snapshot);
}

/** Drop import anchoring and allow full re-serialized export. */
export function releaseImportAnchor(doc: OpenAPIDocument): OpenAPIDocument {
  const next = { ...doc } as OpenAPIDocument;
  const meta = getPreserveMeta(next);
  delete (next as Record<string, unknown>)[OPENEDITOR_KEY];
  if (meta.specVersion) return tagSpecVersion(next, meta.specVersion);
  return next;
}
