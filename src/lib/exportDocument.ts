import { dump } from "js-yaml";
import type {
  OpenAPIDocument,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
  ServerObject,
} from "../types";
import { HTTP_METHODS, type HttpMethod } from "../types";
import {
  dedupeParameters,
  METHODS_WITHOUT_BODY,
  normalizePathsInPlace,
  swagger2Servers,
} from "./normalize";
import {
  getSpecVersion,
  OPENEDITOR_KEY,
  tagSpecVersion,
  type SpecVersion,
} from "./specVersion";
import {
  encodeOperationResponsesInDocument,
  expandOrderedResponseKeysInYaml,
} from "./responseOrder";
import {
  attachSchemaExample,
  attachSwagger2ResponseExample,
  ensureDocumentExamples,
  ensureMediaExample,
  unwrapExampleValue,
} from "./mediaExamples";

type Json = Record<string, unknown>;

const YAML_DUMP_OPTS = {
  noRefs: true,
  lineWidth: 120,
  sortKeys: false,
};

export function serializeDocument(doc: OpenAPIDocument): string {
  const version = getSpecVersion(doc);
  const withExamples = ensureDocumentExamples(doc);
  const payload =
    version === "2.0"
      ? encodeOperationResponsesInDocument(exportSwagger2(withExamples))
      : encodeOperationResponsesInDocument(exportOpenApi3(withExamples, version));
  return expandOrderedResponseKeysInYaml(dump(payload, YAML_DUMP_OPTS));
}

export function exportSwagger2(doc: OpenAPIDocument): Json {
  const result = structuredClone(doc) as Json;

  delete result.openapi;
  delete result[OPENEDITOR_KEY];
  result.swagger = "2.0";

  if (!result.schemes && Array.isArray(result.servers) && result.servers.length > 0) {
    const derived = serversToSwagger2Fields(result.servers as ServerObject[]);
    if (derived.schemes) result.schemes = derived.schemes;
    if (derived.host) result.host = derived.host;
    if (derived.basePath !== undefined) result.basePath = derived.basePath;
  }
  delete result.servers;

  const paths = result.paths;
  if (paths && typeof paths === "object") {
    for (const item of Object.values(paths)) {
      if (!item || typeof item !== "object") continue;
      const pathItem = item as Json;
      for (const method of HTTP_METHODS) {
        const op = pathItem[method];
        if (op && typeof op === "object") {
          pathItem[method] = operationToSwagger2(op as OperationObject, method as HttpMethod);
        }
      }
    }
  }

  const components = result.components as Json | undefined;
  if (components?.schemas && !result.definitions) {
    result.definitions = components.schemas;
  }
  delete result.components;

  const securitySchemes = components?.securitySchemes as Json | undefined;
  if (securitySchemes && !result.securityDefinitions) {
    result.securityDefinitions = securitySchemes;
  }

  return result;
}

export function exportOpenApi3(doc: OpenAPIDocument, version: SpecVersion = getSpecVersion(doc)): Json {
  const result = structuredClone(doc) as Json;

  const legacySchemes = Array.isArray(result.schemes) ? (result.schemes as string[]) : null;
  const legacyHost = typeof result.host === "string" ? result.host : null;
  const legacyBasePath = typeof result.basePath === "string" ? result.basePath : "";

  delete result[OPENEDITOR_KEY];
  delete result.swagger;
  delete result.schemes;
  delete result.host;
  delete result.basePath;
  delete result.definitions;
  delete result.securityDefinitions;

  if (!result.openapi) {
    result.openapi = version === "3.1" ? "3.1.0" : "3.0.3";
  }

  if (!Array.isArray(result.servers) || result.servers.length === 0) {
    const schemes = legacySchemes ?? ["https"];
    const host = legacyHost ?? "localhost";
    result.servers = schemes.map((scheme) => ({
      url: `${scheme}://${host}${legacyBasePath}`,
    }));
  }

  return result;
}

/** Explicitly convert a Swagger 2 document to OpenAPI 3 for editing and export. */
export function upgradeToOpenApi3(doc: OpenAPIDocument): OpenAPIDocument {
  const result = structuredClone(doc) as OpenAPIDocument & Json;

  delete result.swagger;
  result.openapi = typeof result.openapi === "string" ? result.openapi : "3.0.3";

  if (!result.servers?.length) {
    result.servers = swagger2Servers(result);
  }

  const components = { ...(result.components as Json | undefined) } as Json;
  if (result.definitions && !components.schemas) {
    components.schemas = result.definitions;
  }
  if (result.securityDefinitions && !components.securitySchemes) {
    components.securitySchemes = result.securityDefinitions;
  }
  if (Object.keys(components).length > 0) {
    result.components = components;
  }

  normalizePathsInPlace(result, { preserveXComponentRefs: false, swagger2: false });

  delete result.definitions;
  delete result.securityDefinitions;
  delete result.schemes;
  delete result.host;
  delete result.basePath;

  const version: SpecVersion =
    typeof result.openapi === "string" && result.openapi.startsWith("3.1") ? "3.1" : "3.0";
  return tagSpecVersion(result, version);
}

function serversToSwagger2Fields(servers: ServerObject[]): {
  schemes?: string[];
  host?: string;
  basePath?: string;
} {
  const first = servers[0]?.url?.trim();
  if (!first) return {};

  try {
    const url = new URL(first);
    return {
      schemes: [url.protocol.replace(":", "")],
      host: url.host,
      basePath: url.pathname === "/" ? "" : url.pathname,
    };
  } catch {
    return {};
  }
}

function operationToSwagger2(op: OperationObject, method: HttpMethod): OperationObject {
  const next = { ...op };
  const params = [...(op.parameters ?? [])];

  if (
    op.requestBody &&
    !METHODS_WITHOUT_BODY.has(method) &&
    !params.some((p) => p.in === "body" || isBodyRef(p))
  ) {
    params.push(requestBodyToBodyParam(op.requestBody));
  }

  delete next.requestBody;
  next.parameters =
    params.length > 0
      ? dedupeParameters(params.map((p) => paramToSwagger2(p)))
      : undefined;

  if (next.responses) {
    const responses: Record<string, ResponseObject> = {};
    for (const [code, resp] of Object.entries(next.responses)) {
      responses[code] = responseToSwagger2(resp);
    }
    next.responses = responses;
  }

  return next;
}

function isBodyRef(param: ParameterObject): boolean {
  return typeof param.$ref === "string" && param.$ref.includes("/body/");
}

function requestBodyToBodyParam(body: RequestBodyObject): ParameterObject {
  const media = ensureMediaExample(body.content?.["application/json"] ?? {});
  let schema: SchemaObject = media.schema
    ? schemaToSwagger2(media.schema as SchemaObject)
    : { type: "object" };
  if (media.example !== undefined) {
    schema = attachSchemaExample(schema, unwrapExampleValue(media.example));
  }
  return {
    in: "body",
    name: "body",
    required: body.required ?? true,
    description: body.description,
    schema,
  };
}

function paramToSwagger2(param: ParameterObject): ParameterObject {
  if (param.$ref) return { $ref: param.$ref };

  const next = { ...param } as ParameterObject & Json;
  if (next.in === "body") {
    if (next.schema) {
      next.schema = schemaToSwagger2(next.schema as SchemaObject);
    }
    return next;
  }

  const schema = next.schema as SchemaObject | undefined;
  if (schema && !schema.$ref && typeof schema.type === "string" && !schema.properties && !schema.items) {
    next.type = schema.type;
    if (schema.format) next.format = schema.format;
    if (schema.enum) next.enum = schema.enum;
    delete next.schema;
  }

  return next;
}

function responseToSwagger2(resp: ResponseObject): ResponseObject {
  const media = ensureMediaExample(resp.content?.["application/json"] ?? {});
  if (!media.schema && media.example === undefined) return resp;

  const next = { ...resp } as ResponseObject & Json;
  if (media.schema) {
    next.schema = schemaToSwagger2(media.schema as SchemaObject);
  }
  if (media.example !== undefined) {
    const withExample = attachSwagger2ResponseExample(next, media.example) as ResponseObject & Json;
    delete withExample.content;
    return withExample;
  }

  delete next.content;
  return next;
}

function schemaToSwagger2(schema: SchemaObject): SchemaObject {
  const next = { ...schema } as SchemaObject;
  if (next.properties) {
    const properties: Record<string, SchemaObject> = {};
    for (const [key, value] of Object.entries(next.properties)) {
      properties[key] = schemaToSwagger2(value as SchemaObject);
    }
    next.properties = properties;
  }
  if (next.items && typeof next.items === "object") {
    next.items = schemaToSwagger2(next.items as SchemaObject);
  }
  return next;
}
