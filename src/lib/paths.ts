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

export function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function parseOpKey(key: string): { path: string; method: HttpMethod } | null {
  const idx = key.lastIndexOf(":");
  if (idx <= 0) return null;
  const method = key.slice(idx + 1) as HttpMethod;
  if (!HTTP_METHODS.includes(method)) return null;
  return { path: key.slice(0, idx), method };
}

/** Top-level doc.tags first, then tags used on operations (excludes implicit "default"). */
export function getAllTagNames(doc: OpenAPIDocument): string[] {
  const definedOrder = (doc.tags ?? []).map((t) => t.name ?? "").filter(Boolean);
  const seen = new Set(definedOrder);
  const extra: string[] = [];

  for (const item of Object.values(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (!op?.tags?.length) continue;
      for (const tag of op.tags) {
        if (!tag || tag === "default" || seen.has(tag)) continue;
        seen.add(tag);
        extra.push(tag);
      }
    }
  }

  return [...definedOrder, ...extra];
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

  const allTags = getAllTagNames(doc);
  if (groups.has("default")) {
    allTags.push("default");
  }

  return allTags.map((name) => ({
    name,
    description: tagDefs.get(name),
    operations: groups.get(name) ?? [],
  }));
}
