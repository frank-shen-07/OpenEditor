import type { SchemaObject } from "../types";

function inferType(val: unknown): string {
  if (Array.isArray(val)) return "array";
  if (val === null) return "null";
  if (typeof val === "number" && Number.isInteger(val)) return "integer";
  return typeof val;
}

function buildSchema(data: unknown): SchemaObject {
  const type = inferType(data);
  const schema: SchemaObject = { type };

  if (type === "object" && data !== null && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    schema.properties = {};
    const keys = Object.keys(obj);
    if (keys.length > 0) schema.required = keys;
    for (const key of keys) {
      schema.properties[key] = buildSchema(obj[key]);
    }
  } else if (type === "array" && Array.isArray(data)) {
    schema.items = data.length > 0 ? buildSchema(data[0]) : { type: "string" };
  }

  return schema;
}

export function generateSchemaFromExample(example: unknown): SchemaObject | null {
  if (example === undefined) return null;
  return buildSchema(example);
}

export function isEmptySchema(schema: SchemaObject | undefined): boolean {
  if (!schema) return true;
  if (schema.$ref) return false;
  if (schema.type === "object") {
    return !schema.properties || Object.keys(schema.properties).length === 0;
  }
  if (schema.type === "array") return !schema.items;
  return !schema.type;
}
