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

type Json = Record<string, unknown>;

/** Normalize imported documents so the UI can read Swagger 2.0 and $ref parameters. */
export function normalizeDocument(raw: unknown): OpenAPIDocument {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Document must be a YAML/JSON mapping at the top level");
  }

  const doc = structuredClone(raw) as OpenAPIDocument & Json;

  if (doc.swagger === "2.0") {
    return normalizeSwagger2(doc);
  }

  normalizePathsInPlace(doc);
  return doc;
}

function normalizeSwagger2(doc: OpenAPIDocument & Json): OpenAPIDocument {
  const result = { ...doc } as OpenAPIDocument & Json;
  result.openapi = result.openapi ?? "3.0.3";
  delete result.swagger;

  if (!result.servers?.length) {
    result.servers = swagger2Servers(doc);
  }

  normalizePathsInPlace(result);
  return result;
}

function swagger2Servers(doc: Json): ServerObject[] {
  const schemes = Array.isArray(doc.schemes) ? (doc.schemes as string[]) : ["https"];
  const host = typeof doc.host === "string" ? doc.host : "localhost";
  const basePath = typeof doc.basePath === "string" ? doc.basePath : "";
  return schemes.map((scheme) => ({
    url: `${scheme}://${host}${basePath}`,
  }));
}

function normalizePathsInPlace(doc: OpenAPIDocument & Json) {
  const paths = doc.paths;
  if (!paths || typeof paths !== "object") return;

  for (const item of Object.values(paths)) {
    if (!item || typeof item !== "object") continue;
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (op) {
        item[method] = normalizeOperation(op, doc);
      }
    }
  }
}

function normalizeOperation(op: OperationObject, doc: Json): OperationObject {
  const next = { ...op };
  const rawParams = Array.isArray(op.parameters) ? op.parameters : [];
  const resolved = rawParams
    .map((p) => resolveParameter(p, doc))
    .filter((p): p is ParameterObject => p !== null);

  const bodyParams = resolved.filter((p) => p.in === "body");
  const otherParams = resolved
    .filter((p) => p.in !== "body")
    .map((p) => normalizeParameterFields(p));

  next.parameters = otherParams.length > 0 ? otherParams : undefined;

  if (!next.requestBody && bodyParams.length > 0) {
    next.requestBody = bodyParamToRequestBody(bodyParams[0], doc);
  }

  if (next.responses) {
    const responses: Record<string, ResponseObject> = {};
    for (const [code, resp] of Object.entries(next.responses)) {
      responses[String(code)] = normalizeResponse(resp as ResponseObject & Json);
    }
    next.responses = responses;
  }

  return next;
}

function resolveParameter(param: unknown, doc: Json): ParameterObject | null {
  if (!param || typeof param !== "object") return null;

  const p = param as ParameterObject & Json;
  if (typeof p.$ref === "string") {
    const resolved = resolveRef(p.$ref, doc);
    if (!resolved) return null;
    return resolveParameter(resolved, doc);
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

  return {
    description: param.description,
    required: param.required ?? true,
    content: {
      "application/json": { schema: resolvedSchema },
    },
  };
}

function resolveSchemaRefs(schema: SchemaObject, doc: Json): SchemaObject {
  if (typeof schema.$ref === "string") {
    const resolved = resolveRef(schema.$ref, doc);
    if (resolved && typeof resolved === "object") {
      return resolveSchemaRefs(resolved as SchemaObject, doc);
    }
  }
  return schema;
}

function normalizeResponse(resp: ResponseObject & Json): ResponseObject {
  if (resp.content) return resp;

  const legacySchema = resp.schema as SchemaObject | undefined;
  if (!legacySchema) return resp;

  const next = { ...resp };
  delete (next as Json).schema;
  next.content = {
    "application/json": { schema: legacySchema },
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
