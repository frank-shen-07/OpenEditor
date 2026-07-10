import {
  HTTP_METHODS,
  type HttpMethod,
  type OpenAPIDocument,
  type OperationObject,
} from "../types";

export interface OperationRef {
  path: string;
  method: HttpMethod;
  operation: OperationObject;
}

export interface TagGroup {
  name: string;
  description?: string;
  operations: OperationRef[];
}

/** Group path operations by their first tag, matching Swagger UI layout. */
export function groupOperationsByTag(doc: OpenAPIDocument): TagGroup[] {
  const paths = doc.paths ?? {};
  const tagDefs = new Map(
    (doc.tags ?? []).map((t) => [t.name ?? "", t.description as string | undefined])
  );
  const groups = new Map<string, OperationRef[]>();

  for (const [path, item] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (!op) continue;
      const tags = op.tags?.length ? op.tags : ["default"];
      for (const tag of tags) {
        const list = groups.get(tag) ?? [];
        list.push({ path, method, operation: op });
        groups.set(tag, list);
      }
    }
  }

  const definedOrder = (doc.tags ?? []).map((t) => t.name ?? "").filter(Boolean);
  const allTags = [...new Set([...definedOrder, ...groups.keys()])];

  return allTags.map((name) => ({
    name,
    description: tagDefs.get(name),
    operations: groups.get(name) ?? [],
  }));
}
