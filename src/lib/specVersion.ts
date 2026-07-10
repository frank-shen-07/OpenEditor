import type { OpenAPIDocument } from "../types";

export type SpecVersion = "2.0" | "3.0" | "3.1";

export const OPENEDITOR_KEY = "x-openeditor";

export interface OpenEditorMeta {
  specVersion?: SpecVersion;
  preserveImport?: boolean;
  importSnapshot?: {
    pathKeys: string[];
    operationKeys?: string[];
    schemaKeys: string[];
    tagNames: string[];
  };
  additions?: {
    paths?: Record<string, unknown>;
    tags?: unknown[];
    components?: { schemas?: Record<string, unknown> };
  };
}

type Json = Record<string, unknown>;

export function detectSpecVersion(raw: unknown): SpecVersion {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "3.0";
  const doc = raw as Json;

  const meta = doc[OPENEDITOR_KEY] as OpenEditorMeta | undefined;
  if (meta?.specVersion) return meta.specVersion;

  if (doc.swagger === "2.0") return "2.0";

  const openapi = doc.openapi;
  if (typeof openapi === "string") {
    if (openapi.startsWith("3.1")) return "3.1";
    return "3.0";
  }

  if (doc.securityDefinitions || doc.definitions) return "2.0";
  return "3.0";
}

export function getSpecVersion(doc: OpenAPIDocument): SpecVersion {
  const meta = doc[OPENEDITOR_KEY] as OpenEditorMeta | undefined;
  if (meta?.specVersion) return meta.specVersion;
  if (doc.swagger === "2.0") return "2.0";
  if (typeof doc.openapi === "string" && doc.openapi.startsWith("3.1")) return "3.1";
  if (doc.openapi) return "3.0";
  return "3.0";
}

export function tagSpecVersion(doc: OpenAPIDocument, version: SpecVersion): OpenAPIDocument {
  const prev = (doc[OPENEDITOR_KEY] as OpenEditorMeta | undefined) ?? {};
  return {
    ...doc,
    [OPENEDITOR_KEY]: { ...prev, specVersion: version },
  };
}

export function specVersionLabel(version: SpecVersion): string {
  if (version === "2.0") return "Swagger 2.0";
  if (version === "3.1") return "OpenAPI 3.1";
  return "OpenAPI 3.0";
}

export function isSwagger2(doc: OpenAPIDocument): boolean {
  return getSpecVersion(doc) === "2.0";
}
