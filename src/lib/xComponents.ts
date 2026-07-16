import type {
  OpenAPIDocument,
  OperationObject,
  ParameterObject,
  ResponseObject,
  SchemaObject,
} from "../types";
import { OP_OPENEDITOR_KEY } from "./responseOrder";

type Json = Record<string, unknown>;

const X_COMPONENT_PARAM_CATEGORIES = new Set(["path", "header", "body", "query"]);

export interface XComponentCatalog {
  parameters: Map<string, string>;
  errorResponseRef: string | null;
  emptyResponseRef: string | null;
}

function paramType(param: ParameterObject): string | undefined {
  if (typeof param.type === "string") return param.type;
  const schema = param.schema as SchemaObject | undefined;
  return typeof schema?.type === "string" ? schema.type : undefined;
}

function paramMatchKey(param: ParameterObject): string {
  const type = paramType(param);
  const normalizedType =
    type === "number" && param.in === "path" ? "integer" : type ?? "";
  return `${param.in ?? ""}|${param.name ?? ""}|${normalizedType}|${param.required === true}`;
}

function buildParameterMatchers(doc: OpenAPIDocument): Map<string, string> {
  const matchers = new Map<string, string>();
  const xComponents = doc["x-components"] as Json | undefined;
  if (!xComponents || typeof xComponents !== "object") return matchers;

  for (const [category, items] of Object.entries(xComponents)) {
    if (!X_COMPONENT_PARAM_CATEGORIES.has(category)) continue;
    if (!items || typeof items !== "object") continue;
    for (const [name, def] of Object.entries(items as Json)) {
      if (!def || typeof def !== "object") continue;
      const param = def as ParameterObject;
      const ref = `#/x-components/${category}/${name}`;
      matchers.set(paramMatchKey(param), ref);
    }
  }

  return matchers;
}

function findReturnComponentRef(doc: OpenAPIDocument, names: string[]): string | null {
  const returns = (doc["x-components"] as Json | undefined)?.return as Json | undefined;
  if (!returns || typeof returns !== "object") return null;
  for (const name of names) {
    if (name in returns) return `#/x-components/return/${name}`;
  }
  return null;
}

export function buildXComponentCatalog(doc: OpenAPIDocument): XComponentCatalog {
  const errorFromReturn = findReturnComponentRef(doc, ["Error"]);
  const group = (doc["x-components"] as Json | undefined)?.group as Json | undefined;
  const errorFromGroup =
    group && typeof group === "object" && "ErrorResponse" in group
      ? "#/x-components/group/ErrorResponse"
      : null;

  return {
    parameters: buildParameterMatchers(doc),
    errorResponseRef: errorFromReturn ?? errorFromGroup,
    emptyResponseRef: findReturnComponentRef(doc, ["Empty"]),
  };
}

function matchParameterRef(
  param: ParameterObject,
  catalog: XComponentCatalog
): ParameterObject {
  if (typeof param.$ref === "string") return { $ref: param.$ref };
  const ref = catalog.parameters.get(paramMatchKey(param));
  return ref ? { $ref: ref } : param;
}

function schemaPropertyNames(schema: SchemaObject): string[] {
  const props = schema.properties;
  if (!props || typeof props !== "object") return [];
  return Object.keys(props).sort();
}

function isErrorSchema(schema: SchemaObject): boolean {
  const names = schemaPropertyNames(schema);
  return names.length === 2 && names[0] === "error" && names[1] === "message";
}

function isEmptyObjectSchema(schema: SchemaObject): boolean {
  if (schema.type !== "object") return false;
  const props = schema.properties;
  if (!props || typeof props !== "object") return true;
  return Object.keys(props).length === 0;
}

function matchResponseSchema(
  resp: ResponseObject,
  code: string,
  catalog: XComponentCatalog
): ResponseObject {
  const schema = resp.schema as SchemaObject | undefined;
  if (!schema) return resp;

  if (catalog.errorResponseRef && isErrorSchema(schema) && /^[45]\d\d$/.test(code)) {
    const next = { ...resp };
    next.schema = { $ref: catalog.errorResponseRef };
    delete next.example;
    return next;
  }

  if (catalog.emptyResponseRef && isEmptyObjectSchema(schema)) {
    const next = { ...resp };
    next.schema = { $ref: catalog.emptyResponseRef };
    delete next.example;
    return next;
  }

  return resp;
}

function reorderOperationKeys(op: OperationObject): OperationObject {
  const preferred = [
    "tags",
    "summary",
    "operationId",
    "security",
    "description",
    "parameters",
    "responses",
  ];
  const result: Json = {};
  for (const key of preferred) {
    if (key in op) result[key] = op[key as keyof OperationObject];
  }
  for (const [key, value] of Object.entries(op)) {
    if (key === OP_OPENEDITOR_KEY) continue;
    if (!(key in result)) result[key] = value;
  }
  return result as OperationObject;
}

/** Rewrite inline Swagger 2.0 parameters/responses to x-component $refs when they match the import catalog. */
export function styleSwagger2OperationWithXComponents(
  op: OperationObject,
  doc: OpenAPIDocument
): OperationObject {
  const catalog = buildXComponentCatalog(doc);
  const next = { ...op };

  if (next.parameters?.length) {
    next.parameters = next.parameters.map((param) => matchParameterRef(param, catalog));
  }

  if (next.responses) {
    const responses: Record<string, ResponseObject> = {};
    for (const [code, resp] of Object.entries(next.responses)) {
      responses[code] = matchResponseSchema(resp, code, catalog);
    }
    next.responses = responses;
  }

  return reorderOperationKeys(next);
}
