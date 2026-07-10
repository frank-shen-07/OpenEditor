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

export function isImportedPath(doc: OpenAPIDocument, path: string): boolean {
  const snapshot = getImportSnapshot(doc);
  return snapshot ? snapshot.pathKeys.includes(path) : false;
}

export function isImportedSchema(doc: OpenAPIDocument, name: string): boolean {
  const snapshot = getImportSnapshot(doc);
  return snapshot ? snapshot.schemaKeys.includes(name) : false;
}

function emptyAdditions(additions: DocumentAdditions): boolean {
  const pathCount = Object.keys(additions.paths ?? {}).length;
  const schemaCount = Object.keys(additions.components?.schemas ?? {}).length;
  const tagCount = (additions.tags ?? []).length;
  return pathCount === 0 && schemaCount === 0 && tagCount === 0;
}

/** Apply a visual-editor update while keeping imported content untouched. */
export function applyPreserveImportChange(
  prev: OpenAPIDocument,
  next: OpenAPIDocument
): OpenAPIDocument {
  const snapshot = getImportSnapshot(prev);
  if (!snapshot) return next;

  const importedPaths: Record<string, PathItemObject> = {};
  for (const key of snapshot.pathKeys) {
    if (prev.paths?.[key]) importedPaths[key] = prev.paths[key];
  }

  const importedSchemas: Record<string, SchemaObject> = {};
  for (const key of snapshot.schemaKeys) {
    const schema = prev.components?.schemas?.[key];
    if (schema) importedSchemas[key] = schema;
  }

  const importedTags = (prev.tags ?? []).filter(
    (t) => t.name && snapshot.tagNames.includes(t.name)
  );

  const additionPaths: Record<string, PathItemObject> = {};
  for (const [key, value] of Object.entries(next.paths ?? {})) {
    if (!snapshot.pathKeys.includes(key)) additionPaths[key] = value;
  }

  const additionSchemas: Record<string, SchemaObject> = {};
  for (const [key, value] of Object.entries(next.components?.schemas ?? {})) {
    if (!snapshot.schemaKeys.includes(key)) additionSchemas[key] = value;
  }

  const additionTags = (next.tags ?? []).filter(
    (t) => t.name && !snapshot.tagNames.includes(t.name)
  );

  const additions: DocumentAdditions = {
    paths: Object.keys(additionPaths).length > 0 ? additionPaths : undefined,
    tags: additionTags.length > 0 ? additionTags : undefined,
    components:
      Object.keys(additionSchemas).length > 0 ? { schemas: additionSchemas } : undefined,
  };

  return tagPreserveImport(
    {
      ...prev,
      info: prev.info,
      servers: prev.servers,
      schemes: prev.schemes,
      host: prev.host,
      basePath: prev.basePath,
      swagger: prev.swagger,
      openapi: prev.openapi,
      security: prev.security,
      securityDefinitions: prev.securityDefinitions,
      definitions: prev.definitions,
      "x-components": prev["x-components"],
      paths: { ...importedPaths, ...additionPaths },
      tags: [...importedTags, ...additionTags],
      components: {
        ...(prev.components ?? {}),
        schemas: { ...importedSchemas, ...additionSchemas },
      },
    },
    snapshot,
    additions
  );
}

/** Build export text: original import plus any additive changes. */
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
