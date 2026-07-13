import type {
  MediaTypeObject,
  OpenAPIDocument,
  OperationObject,
  ResponseObject,
  SchemaObject,
} from "../types";
import { HTTP_METHODS } from "../types";

type Json = Record<string, unknown>;

/** Unwrap `{ value: ... }` envelopes from stored or imported examples. */
export function unwrapExampleValue(example: unknown): unknown {
  if (!example || typeof example !== "object" || Array.isArray(example)) return example;
  const obj = example as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 1 && keys[0] === "value") {
    return unwrapExampleValue(obj.value);
  }
  return example;
}

/** Read a Swagger 2.0 `examples.application/json` value (wrapped or raw). */
export function extractSwagger2Example(
  examples: unknown,
  mime = "application/json"
): unknown {
  if (!examples || typeof examples !== "object") return undefined;
  const raw = (examples as Record<string, unknown>)[mime];
  if (raw === undefined) return undefined;
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "value" in (raw as object)) {
    return unwrapExampleValue((raw as { value: unknown }).value);
  }
  return unwrapExampleValue(raw);
}

export function attachSchemaExample(schema: SchemaObject, example: unknown): SchemaObject {
  const unwrapped = unwrapExampleValue(example);
  if (unwrapped === undefined) return schema;
  return { ...schema, example: unwrapped };
}

/** Prefer explicit media `example`; fall back to schema-level example. */
export function ensureMediaExample(media: MediaTypeObject): MediaTypeObject {
  const example =
    media.example !== undefined
      ? unwrapExampleValue(media.example)
      : unwrapExampleValue((media.schema as SchemaObject | undefined)?.example);
  if (example === undefined) return media;
  return { ...media, example };
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

/** Attach Swagger 2.0 `schema.example` from a media example (no `examples` wrapper). */
export function attachSwagger2ResponseExample(
  resp: Json,
  example: unknown
): Json {
  const unwrapped = unwrapExampleValue(example);
  if (unwrapped === undefined) return resp;
  const next = { ...resp };
  if (next.schema && typeof next.schema === "object") {
    next.schema = attachSchemaExample(next.schema as SchemaObject, unwrapped);
  }
  delete next.examples;
  return next;
}
