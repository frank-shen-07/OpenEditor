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
import { styleSwagger2OperationWithXComponents } from "./xComponents";
import { OP_OPENEDITOR_KEY } from "./responseOrder";

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

function formatSwagger2Response(resp: ResponseObject): ResponseObject {
  const next = { ...resp };
  if (next.schema) next.schema = formatSchema(next.schema as SchemaObject);
  delete next.content;
  return reorderKeys(next as Record<string, unknown>, [
    "description",
    "schema",
    "headers",
    "examples",
  ]) as ResponseObject;
}

/** Match key order used in imported OpenAPI YAML (tags/summary first, description last on responses). */
export function formatOperationForYamlExport(
  op: OperationObject,
  options: { swagger2?: boolean } = {}
): OperationObject {
  const next = { ...op };
  delete (next as Record<string, unknown>)[OP_OPENEDITOR_KEY];

  if (next.responses) {
    const responses: Record<string, ResponseObject> = {};
    for (const [code, resp] of Object.entries(next.responses)) {
      responses[code] = options.swagger2 ? formatSwagger2Response(resp) : formatResponse(resp);
    }
    next.responses = responses;
  }

  if (options.swagger2) {
    delete next.requestBody;
    if (next.parameters) {
      next.parameters = next.parameters.map((param) => {
        if (param.$ref) return param;
        const formatted = formatParameter(param);
        if (formatted.in === "body" && formatted.schema) {
          formatted.schema = formatSchema(formatted.schema as SchemaObject);
        }
        return formatted;
      });
    }
  } else {
    if (next.requestBody) next.requestBody = formatRequestBody(next.requestBody);
    if (next.parameters) next.parameters = next.parameters.map(formatParameter);
  }

  const leading = reorderKeys(next as Record<string, unknown>, [
    "tags",
    "summary",
    "security",
    "operationId",
    "description",
    "parameters",
    "responses",
  ]) as OperationObject;

  const result: Record<string, unknown> = { ...leading };
  if (next.responses && !("responses" in result)) result.responses = next.responses;
  if (next.parameters && !("parameters" in result)) result.parameters = next.parameters;

  for (const key of Object.keys(next)) {
    if (key in result) continue;
    result[key] = next[key as keyof OperationObject];
  }

  return result as OperationObject;
}

export function formatPathItemForYamlExport(
  item: PathItemObject,
  version: SpecVersion,
  doc?: OpenAPIDocument
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
    if (!op) continue;
    let formatted = formatOperationForYamlExport(op, { swagger2: version === "2.0" });
    if (version === "2.0" && doc) {
      formatted = styleSwagger2OperationWithXComponents(formatted, doc);
    }
    result[method] = formatted;
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
    formatted[path] = formatPathItemForYamlExport(item, version, doc);
  }
  return formatted;
}
