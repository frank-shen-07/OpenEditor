import type {
  MediaTypeObject,
  OpenAPIDocument,
  OperationObject,
  ParameterObject,
  PathItemObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from "../types";
import { HTTP_METHODS } from "../types";
import { exportSwagger2 } from "./exportDocument";
import type { SpecVersion } from "./specVersion";
import { getSpecVersion } from "./specVersion";
import { ensureMediaExample } from "./mediaExamples";

function reorderKeys<T extends Record<string, unknown>>(
  obj: T,
  preferred: string[]
): T {
  const result: Record<string, unknown> = {};
  for (const key of preferred) {
    if (key in obj) result[key] = obj[key];
  }
  for (const [key, value] of Object.entries(obj)) {
    if (!(key in result)) result[key] = value;
  }
  return result as T;
}

function formatSchema(schema: SchemaObject): SchemaObject {
  const next = { ...schema };
  if (next.properties) {
    const properties: Record<string, SchemaObject> = {};
    for (const [key, value] of Object.entries(next.properties)) {
      properties[key] = formatSchema(value as SchemaObject);
    }
    next.properties = properties;
  }
  if (next.items && typeof next.items === "object" && !Array.isArray(next.items)) {
    next.items = formatSchema(next.items as SchemaObject);
  }
  return reorderKeys(next as Record<string, unknown>, [
    "type",
    "format",
    "properties",
    "required",
    "items",
    "enum",
    "example",
    "description",
    "$ref",
  ]) as SchemaObject;
}

function formatMediaType(media: MediaTypeObject): MediaTypeObject {
  const next = ensureMediaExample({ ...media });
  if (next.schema) next.schema = formatSchema(next.schema as SchemaObject);
  return reorderKeys(next as Record<string, unknown>, [
    "schema",
    "example",
    "examples",
    "encoding",
  ]) as MediaTypeObject;
}

function formatResponse(resp: ResponseObject): ResponseObject {
  const next = { ...resp };
  if (next.content) {
    const content: Record<string, MediaTypeObject> = {};
    for (const [mime, media] of Object.entries(next.content)) {
      content[mime] = formatMediaType(media);
    }
    next.content = content;
  }
  return reorderKeys(next as Record<string, unknown>, [
    "headers",
    "content",
    "links",
    "description",
  ]) as ResponseObject;
}

function formatRequestBody(body: RequestBodyObject): RequestBodyObject {
  const next = { ...body };
  if (next.content) {
    const content: Record<string, MediaTypeObject> = {};
    for (const [mime, media] of Object.entries(next.content)) {
      content[mime] = formatMediaType(media);
    }
    next.content = content;
  }
  return reorderKeys(next as Record<string, unknown>, [
    "description",
    "required",
    "content",
  ]) as RequestBodyObject;
}

function formatParameter(param: ParameterObject): ParameterObject {
  const next = { ...param };
  if (next.schema) next.schema = formatSchema(next.schema as SchemaObject);
  return next;
}

/** Match key order used in imported OpenAPI YAML (tags/summary first, description last on responses). */
export function formatOperationForYamlExport(op: OperationObject): OperationObject {
  const next = { ...op };
  if (next.responses) {
    const responses: Record<string, ResponseObject> = {};
    for (const [code, resp] of Object.entries(next.responses)) {
      responses[code] = formatResponse(resp);
    }
    next.responses = responses;
  }
  if (next.requestBody) next.requestBody = formatRequestBody(next.requestBody);
  if (next.parameters) next.parameters = next.parameters.map(formatParameter);

  const leading = reorderKeys(next as Record<string, unknown>, [
    "tags",
    "summary",
    "security",
    "operationId",
  ]) as OperationObject;

  const result: Record<string, unknown> = { ...leading };
  if (next.responses) result.responses = next.responses;

  for (const key of Object.keys(next)) {
    if (key in result) continue;
    result[key] = next[key as keyof OperationObject];
  }

  return result as OperationObject;
}

export function formatPathItemForYamlExport(
  item: PathItemObject,
  version: SpecVersion
): PathItemObject {
  if (version === "2.0") {
    const exported = exportSwagger2({
      swagger: "2.0",
      paths: { _: item },
    } as OpenAPIDocument);
    const paths = exported.paths as Record<string, PathItemObject> | undefined;
    item = paths?._ ?? item;
  }

  const result: PathItemObject = { ...item };
  for (const method of HTTP_METHODS) {
    const op = result[method];
    if (op) result[method] = formatOperationForYamlExport(op);
  }
  return result;
}

export function formatPathsForYamlExport(
  paths: Record<string, PathItemObject>,
  doc: OpenAPIDocument
): Record<string, PathItemObject> {
  const version = getSpecVersion(doc);
  const formatted: Record<string, PathItemObject> = {};
  for (const [path, item] of Object.entries(paths)) {
    formatted[path] = formatPathItemForYamlExport(item, version);
  }
  return formatted;
}
