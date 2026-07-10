/**
 * Loose typings for OpenAPI 3.x documents. The editor works with arbitrary
 * user-supplied documents, so everything is optional and extra keys are
 * preserved untouched.
 */

export interface OpenAPIDocument {
  openapi?: string;
  info?: InfoObject;
  servers?: ServerObject[];
  tags?: TagObject[];
  paths?: Record<string, PathItemObject>;
  components?: ComponentsObject;
  security?: Record<string, string[]>[];
  [key: string]: unknown;
}

export interface InfoObject {
  title?: string;
  version?: string;
  description?: string;
  termsOfService?: string;
  contact?: { name?: string; url?: string; email?: string; [k: string]: unknown };
  license?: { name?: string; url?: string; [k: string]: unknown };
  [key: string]: unknown;
}

export interface ServerObject {
  url?: string;
  description?: string;
  [key: string]: unknown;
}

export interface TagObject {
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export interface PathItemObject {
  summary?: string;
  description?: string;
  get?: OperationObject;
  put?: OperationObject;
  post?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  patch?: OperationObject;
  trace?: OperationObject;
  parameters?: ParameterObject[];
  [key: string]: unknown;
}

export interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  deprecated?: boolean;
  security?: Record<string, string[]>[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
  [key: string]: unknown;
}

export interface ParameterObject {
  name?: string;
  in?: string;
  description?: string;
  required?: boolean;
  type?: string;
  schema?: SchemaObject;
  [key: string]: unknown;
}

export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content?: Record<string, MediaTypeObject>;
  [key: string]: unknown;
}

export interface MediaTypeObject {
  schema?: SchemaObject;
  example?: unknown;
  [key: string]: unknown;
}

export interface ResponseObject {
  description?: string;
  content?: Record<string, MediaTypeObject>;
  [key: string]: unknown;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  enum?: unknown[];
  $ref?: string;
  [key: string]: unknown;
}

export interface ComponentsObject {
  schemas?: Record<string, SchemaObject>;
  [key: string]: unknown;
}

export const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];
