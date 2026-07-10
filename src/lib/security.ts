import type { OpenAPIDocument, OperationObject } from "../types";

/** Whether an operation requires auth (OpenAPI security inheritance rules). */
export function isOperationSecured(doc: OpenAPIDocument, operation: OperationObject): boolean {
  if (operation.security !== undefined) {
    return operation.security.length > 0;
  }
  if (doc.security !== undefined) {
    return doc.security.length > 0;
  }
  return false;
}
