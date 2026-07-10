import type {
  OpenAPIDocument,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
  ServerObject,
} from "../types";
import { HTTP_METHODS } from "../types";
import { detectSpecVersion, tagSpecVersion } from "./specVersion";

type Json = Record<string, unknown>;

/** Normalize imported documents so the UI can read Swagger 2.0 and $ref parameters. */
export function normalizeDocument(raw: unknown): OpenAPIDocument {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Document must be a YAML/JSON mapping at the top level");
  }

  const doc = structuredClone(raw) as OpenAPIDocument & Json;
  const version = detectSpecVersion(doc);

  if (version === "2.0") {
    return tagSpecVersion(normalizeSwagger2(doc), "2.0");
  }

  normalizePathsInPlace(doc, { preserveXComponentRefs: true });
  return tagSpecVersion(doc, version);
}

function normalizeSwagger2(doc: OpenAPIDocument & Json): OpenAPIDocument {
  const result = { ...doc } as OpenAPIDocument & Json;
  delete result.openapi;

  if (!result.servers?.length) {
    result.servers = swagger2Servers(doc);
  }

  normalizePathsInPlace(result, { preserveXComponentRefs: true, swagger2: true });
  return result;
}

export function swagger2Servers(doc: Json): ServerObject[] {
  const schemes = Array.isArray(doc.schemes) ? (doc.schemes as string[]) : ["https"];
  const host = typeof doc.host === "string" ? doc.host : "localhost";
  const basePath = typeof doc.basePath === "string" ? doc.basePath : "";
  return schemes.map((scheme) => ({
    url: `${scheme}://${host}${basePath}`,
  }));
}

export function normalizePathsInPlace(
  doc: OpenAPIDocument & Json,
  options: { preserveXComponentRefs?: boolean; swagger2?: boolean } = {}
) {
  const paths = doc.paths;
  if (!paths || typeof paths !== "object") return;

  for (const item of Object.values(paths)) {
    if (!item || typeof item !== "object") continue;
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (op) {
        item[method] = normalizeOperation(op, doc, options);
      }
    }
  }
}

function normalizeOperation(
  op: OperationObject,
  doc: Json,
  options: { preserveXComponentRefs?: boolean; swagger2?: boolean } = {}
): OperationObject {
  const next = { ...op };
  const rawParams = Array.isArray(op.parameters) ? op.parameters : [];
  const resolved = rawParams
    .map((p) => resolveParameter(p, doc, options.preserveXComponentRefs))
    .filter((p): p is ParameterObject => p !== null);

  const xComponentBodyRefs = resolved.filter((p) => isXComponentRef(p));
  const bodyParams = resolved.filter((p) => p.in === "body" && !isXComponentRef(p));
  const otherParams = resolved
    .filter((p) => p.in !== "body" && !isXComponentRef(p))
    .map((p) => normalizeParameterFields(p));

  const refParams = resolved.filter((p) => isXComponentRef(p) && p.in !== "body");

  next.parameters =
    [...otherParams, ...refParams, ...xComponentBodyRefs].length > 0
      ? [...otherParams, ...refParams, ...xComponentBodyRefs]
      : undefined;

  if (!options.swagger2 && !next.requestBody && bodyParams.length > 0) {
    next.requestBody = bodyParamToRequestBody(bodyParams[0], doc);
  } else if (options.swagger2 && bodyParams.length > 0) {
    const bodyOnly = bodyParams.map((p) => normalizeParameterFields(p));
    next.parameters = [...(next.parameters ?? []), ...bodyOnly];
    if (!next.requestBody) {
      next.requestBody = bodyParamToRequestBody(bodyOnly[0], doc);
    }
  }

  if (options.swagger2 && xComponentBodyRefs.length > 0 && !next.requestBody) {
    const ref = xComponentBodyRefs[0].$ref;
    if (typeof ref === "string") {
      const resolved = resolveRef(ref, doc);
      if (resolved && typeof resolved === "object") {
        next.requestBody = bodyParamToRequestBody(resolved as ParameterObject & Json, doc);
      }
    }
  }

  if (next.responses) {
    const responses: Record<string, ResponseObject> = {};
    for (const [code, resp] of Object.entries(next.responses)) {
      responses[String(code)] = normalizeResponse(resp as ResponseObject & Json, doc);
    }
    next.responses = responses;
  }

  return next;
}

function isXComponentRef(param: ParameterObject): boolean {
  return typeof param.$ref === "string" && param.$ref.startsWith("#/x-components/");
}

function resolveParameter(
  param: unknown,
  doc: Json,
  preserveXComponentRefs = false
): ParameterObject | null {
  if (!param || typeof param !== "object") return null;

  const p = param as ParameterObject & Json;
  if (typeof p.$ref === "string") {
    if (preserveXComponentRefs && p.$ref.startsWith("#/x-components/")) {
      return p;
    }
    const resolved = resolveRef(p.$ref, doc);
    if (!resolved) return null;
    return resolveParameter(resolved, doc, preserveXComponentRefs);
  }

  if (!p.name && !p.in) return null;
  return p;
}

function resolveRef(ref: string, doc: Json): unknown {
  if (!ref.startsWith("#/")) return null;
  const parts = ref.slice(2).split("/");
  let current: unknown = doc;
  for (const part of parts) {
    if (!current || typeof current !== "object") return null;
    current = (current as Json)[part];
  }
  return current ?? null;
}

function normalizeParameterFields(param: ParameterObject & Json): ParameterObject {
  const next: ParameterObject & Json = { ...param };

  const legacyType = typeof next.type === "string" ? next.type : undefined;
  if (legacyType && !next.schema) {
    next.schema = { type: legacyType };
  }
  delete next.type;

  if (next.in === "body") return next;
  return next;
}

function bodyParamToRequestBody(param: ParameterObject & Json, doc: Json): RequestBodyObject {
  const schema =
    (param.schema as SchemaObject | undefined) ??
    (typeof param.type === "string" ? { type: param.type } : { type: "object" });

  const resolvedSchema = resolveSchemaRefs(schema, doc);
  const example = buildExampleFromSchema(resolvedSchema);

  return {
    description: param.description,
    required: param.required ?? true,
    content: {
      "application/json": {
        schema: resolvedSchema,
        ...(example ? { example } : {}),
      },
    },
  };
}

function resolveSchemaRefs(schema: SchemaObject, doc: Json, seen = new Set<string>()): SchemaObject {
  if (typeof schema.$ref === "string") {
    if (seen.has(schema.$ref)) return { type: "object" };
    seen.add(schema.$ref);
    const resolved = resolveRef(schema.$ref, doc);
    if (resolved && typeof resolved === "object") {
      return resolveSchemaRefs(resolved as SchemaObject, doc, seen);
    }
    return schema;
  }

  const next: SchemaObject = { ...schema };

  if (next.properties && typeof next.properties === "object") {
    const properties: Record<string, SchemaObject> = {};
    for (const [key, value] of Object.entries(next.properties)) {
      properties[key] = resolveSchemaRefs(value as SchemaObject, doc, new Set(seen));
    }
    next.properties = properties;
  }

  if (next.items && typeof next.items === "object") {
    next.items = resolveSchemaRefs(next.items as SchemaObject, doc, new Set(seen));
  }

  if (Array.isArray(next.allOf)) {
    next.allOf = next.allOf.map((s) => resolveSchemaRefs(s as SchemaObject, doc, new Set(seen)));
  }

  return next;
}

/** Build a plain example object from schema `example` fields (Swagger 2.0 style). */
export function buildExampleFromSchema(schema: SchemaObject): Record<string, unknown> | undefined {
  if (schema.example !== undefined && typeof schema.example === "object" && !Array.isArray(schema.example)) {
    return schema.example as Record<string, unknown>;
  }

  if (schema.type === "object" && schema.properties) {
    const example: Record<string, unknown> = {};
    let hasValue = false;
    for (const [key, prop] of Object.entries(schema.properties)) {
      const p = prop as SchemaObject;
      if (p.example !== undefined) {
        example[key] = p.example;
        hasValue = true;
      }
    }
    return hasValue ? example : undefined;
  }

  return undefined;
}

function normalizeResponse(resp: ResponseObject & Json, doc?: Json): ResponseObject {
  if (resp.content) {
    const content = { ...resp.content };
    for (const [mediaType, media] of Object.entries(content)) {
      if (!media?.schema || !doc) continue;
      const resolved = resolveSchemaRefs(media.schema as SchemaObject, doc);
      const example = buildExampleFromSchema(resolved);
      content[mediaType] = {
        ...media,
        schema: resolved,
        ...(example && !media.example ? { example } : {}),
      };
    }
    return { ...resp, content };
  }

  const legacySchema = resp.schema as SchemaObject | undefined;
  if (!legacySchema) return resp;

  const resolved = doc ? resolveSchemaRefs(legacySchema, doc) : legacySchema;
  const example = buildExampleFromSchema(resolved);

  const next = { ...resp };
  delete (next as Json).schema;
  next.content = {
    "application/json": {
      schema: resolved,
      ...(example ? { example } : {}),
    },
  };
  return next;
}

/** HTTP methods that should not offer a request body in the editor. */
export const METHODS_WITHOUT_BODY = new Set(["get", "head", "options"]);

export function getParameterType(param: ParameterObject): string {
  const legacy = param.type;
  if (typeof legacy === "string") return legacy;
  return param.schema?.type ?? "";
}

export function getDisplayParameters(parameters: ParameterObject[] | undefined): ParameterObject[] {
  return (parameters ?? []).filter((p) => p.in !== "body");
}
