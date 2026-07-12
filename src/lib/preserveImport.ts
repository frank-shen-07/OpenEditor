import { dump, load } from "js-yaml";
import type { OpenAPIDocument, PathItemObject, SchemaObject, TagObject } from "../types";
import { HTTP_METHODS, type HttpMethod } from "../types";
import {
  detectSpecVersion,
  OPENEDITOR_KEY,
  tagSpecVersion,
  type OpenEditorMeta,
} from "./specVersion";
import { dumpPathItemYaml } from "./yamlExportFormat";
import { getSpecVersion } from "./specVersion";

export interface ImportSnapshot {
  pathKeys: string[];
  operationKeys: string[];
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
  const operationKeys: string[] = [];
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (!item || typeof item !== "object") continue;
    for (const method of HTTP_METHODS) {
      if (item[method]) operationKeys.push(`${path}:${method}`);
    }
  }
  return {
    pathKeys: Object.keys(doc.paths ?? {}),
    operationKeys,
    schemaKeys: Object.keys(doc.components?.schemas ?? {}),
    tagNames: (doc.tags ?? []).map((t) => t.name).filter((n): n is string => !!n),
  };
}

/** Baseline document for diff/export — the parsed import before user additions. */
export function getImportBaselineDoc(sourceYaml: string): OpenAPIDocument {
  return parseImport(sourceYaml).doc;
}

function snapshotOperationKeys(snapshot: ImportSnapshot): Set<string> {
  const keys = snapshot.operationKeys;
  if (keys && keys.length > 0) {
    return new Set(keys);
  }
  return new Set();
}

/** Rebuild operation-level snapshot from source YAML (legacy saves only tracked path keys). */
export function hydrateImportSnapshot(
  doc: OpenAPIDocument,
  sourceYaml: string | null
): OpenAPIDocument {
  if (!isPreserveImport(doc) || !sourceYaml) return doc;
  const existing = getImportSnapshot(doc);
  if (existing?.operationKeys?.length) return doc;
  const { snapshot } = parseImport(sourceYaml);
  return syncImportAdditions(
    {
      ...doc,
      [OPENEDITOR_KEY]: {
        ...getPreserveMeta(doc),
        importSnapshot: snapshot,
      },
    },
    snapshot
  );
}

function importedMethodsOnPath(snapshot: ImportSnapshot, path: string): string[] {
  return snapshot.operationKeys
    .filter((key) => key.startsWith(`${path}:`))
    .map((key) => key.slice(path.length + 1).toUpperCase());
}

function splitOperationKey(key: string): { path: string; method: HttpMethod } {
  const colon = key.indexOf(":");
  return {
    path: key.slice(0, colon),
    method: key.slice(colon + 1) as HttpMethod,
  };
}

/** Explain why export diff is empty despite visual edits (preserve-import mode). */
export function getPreserveImportDiffHint(
  doc: OpenAPIDocument,
  baselineDoc: OpenAPIDocument
): string | null {
  const snapshot = getImportSnapshot(doc);
  if (!snapshot) return null;
  if (!emptyAdditions(computeAdditions(doc, snapshot))) return null;

  const importedOps =
    snapshot.operationKeys.length > 0
      ? snapshot.operationKeys
      : snapshot.pathKeys.flatMap((path) =>
          HTTP_METHODS.filter((m) => baselineDoc.paths?.[path]?.[m]).map((m) => `${path}:${m}`)
        );

  const edited: string[] = [];
  for (const key of importedOps) {
    const { path, method } = splitOperationKey(key);
    const before = baselineDoc.paths?.[path]?.[method];
    const after = doc.paths?.[path]?.[method];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      edited.push(`${method.toUpperCase()} ${path}`);
    }
  }

  if (edited.length > 0) {
    const pathNotes = [...new Set(edited.map((e) => e.replace(/^[A-Z]+ /, "")))]
      .map((path) => {
        const methods = importedMethodsOnPath(snapshot, path);
        return methods.length > 1
          ? `${path} (imported: ${methods.join(", ")})`
          : path;
      })
      .join("; ");
    return `You edited route(s) already in your import: ${edited.join(", ")}. Different HTTP methods on the same path are tracked separately — adding GET /simulations would only appear in this diff if GET was not in the original file. Imported on shared path(s): ${pathNotes}. Edits to existing methods are not written to the YAML export; use a new path for designed routes (e.g. /wellbeing/tips).`;
  }
  return null;
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
  const importedOps = snapshotOperationKeys(snapshot);
  const additionPaths: Record<string, PathItemObject> = {};

  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (!item || typeof item !== "object") continue;

    if (!snapshot.pathKeys.includes(path)) {
      additionPaths[path] = item;
      continue;
    }

    const newMethods: PathItemObject = {};
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (op && !importedOps.has(`${path}:${method}`)) {
        newMethods[method] = op;
      }
    }
    if (Object.keys(newMethods).length > 0) {
      additionPaths[path] = newMethods;
    }
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
    result = insertPathAdditions(result, additions.paths, doc);
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

function pathExistsInSourceYaml(sourceYaml: string, path: string): boolean {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^  ${escaped}:\\s*$`, "m").test(sourceYaml);
}

function insertPathAdditions(
  sourceYaml: string,
  additions: Record<string, PathItemObject>,
  doc: OpenAPIDocument
): string {
  let result = sourceYaml;
  for (const [path, item] of Object.entries(additions)) {
    if (pathExistsInSourceYaml(result, path)) {
      result = mergeOperationsIntoExistingPath(result, path, item, doc);
    } else {
      result = insertPathsIntoSourceYaml(result, formatPathsInsertion({ [path]: item }, doc));
    }
  }
  return result;
}

/** Append new HTTP methods under an existing path entry in source YAML. */
export function mergeOperationsIntoExistingPath(
  sourceYaml: string,
  path: string,
  methods: PathItemObject,
  doc: OpenAPIDocument
): string {
  const lines = sourceYaml.split("\n");
  const pathLine = `  ${path}:`;
  const pathIdx = lines.findIndex((line) => line === pathLine);
  if (pathIdx < 0) {
    return insertPathsIntoSourceYaml(sourceYaml, formatPathsInsertion({ [path]: methods }, doc));
  }

  let insertAt = lines.length;
  for (let i = pathIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^  \/\S/.test(line)) {
      insertAt = i;
      break;
    }
    if (line.trim() !== "" && !/^\s/.test(line) && /^[A-Za-z0-9_"'-]+:/.test(line)) {
      insertAt = i;
      break;
    }
  }

  const blockLines = formatPathMethodsInsertion(methods, doc).split("\n");
  lines.splice(insertAt, 0, ...blockLines);
  return lines.join("\n");
}

function formatPathMethodsInsertion(item: PathItemObject, doc: OpenAPIDocument): string {
  const version = getSpecVersion(doc);
  return dumpPathItemYaml(item, version)
    .split("\n")
    .map((line) => (line ? `    ${line}` : ""))
    .join("\n");
}

function formatPathsInsertion(
  paths: Record<string, PathItemObject>,
  doc: OpenAPIDocument
): string {
  const version = getSpecVersion(doc);
  const lines: string[] = [];
  for (const [path, item] of Object.entries(paths)) {
    const indented = dumpPathItemYaml(item, version)
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
