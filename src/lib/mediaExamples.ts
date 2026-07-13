import type {
  MediaTypeObject,
  OpenAPIDocument,
  OperationObject,
  ResponseObject,
  SchemaObject,
} from "../types";
import { HTTP_METHODS } from "../types";

type Json = Record<string, unknown>;

/** Read a Swagger 2.0 `examples.application/json` value (wrapped or raw). */
export function extractSwagger2Example(
  examples: unknown,
  mime = "application/json"
): unknown {
  if (!examples || typeof examples !== "object") return undefined;
  const raw = (examples as Record<string, unknown>)[mime];
  if (raw === undefined) return undefined;
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "value" in (raw as object)) {
    return (raw as { value: unknown }).value;
  }
  return raw;
}

export function attachSchemaExample(schema: SchemaObject, example: unknown): SchemaObject {
  if (example === undefined) return schema;
  return { ...schema, example };
}

/** Prefer explicit media `example`; fall back to schema-level example. */
export function ensureMediaExample(media: MediaTypeObject): MediaTypeObject {
  if (media.example !== undefined) return media;
  const schema = media.schema as SchemaObject | undefined;
  if (schema?.example !== undefined) {
    return { ...media, example: schema.example };
  }
  return media;
}

function ensureContentExamples(content: Record<string, MediaTypeObject> | undefined) {
  if (!content) return content;
  const next: Record<string, MediaTypeObject> = {};
  for (const [mime, media] of Object.entries(content)) {
    next[mime] = ensureMediaExample(media);
  }
  return next;
}

function ensureOperationExamples(op: OperationObject): OperationObject {
  const next = { ...op };
  if (next.requestBody?.content) {
    next.requestBody = {
      ...next.requestBody,
      content: ensureContentExamples(next.requestBody.content)!,
    };
  }
  if (next.responses) {
    const responses: Record<string, ResponseObject> = {};
    for (const [code, resp] of Object.entries(next.responses)) {
      const content = ensureContentExamples(resp.content);
      responses[code] = content ? { ...resp, content } : resp;
    }
    next.responses = responses;
  }
  return next;
}

/** Ensure OpenAPI 3 media objects expose `example` for Swagger UI. */
export function ensureDocumentExamples(doc: OpenAPIDocument): OpenAPIDocument {
  const result = structuredClone(doc) as OpenAPIDocument;
  const paths = result.paths;
  if (!paths) return result;

  for (const item of Object.values(paths)) {
    if (!item || typeof item !== "object") continue;
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (op) item[method] = ensureOperationExamples(op);
    }
  }
  return result;
}

/** Attach Swagger 2.0 response `examples` + `schema.example` from a media example. */
export function attachSwagger2ResponseExample(
  resp: Json,
  example: unknown
): Json {
  if (example === undefined) return resp;
  const next = { ...resp };
  if (next.schema && typeof next.schema === "object") {
    next.schema = attachSchemaExample(next.schema as SchemaObject, example);
  }
  next.examples = {
    "application/json": { value: example },
  };
  return next;
}
