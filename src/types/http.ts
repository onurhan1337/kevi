export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "OPTIONS"
  | "PATCH"
  | "HEAD";

export type WriteMethod = "POST" | "PUT" | "DELETE" | "PATCH";

export type ReadMethod = "GET" | "HEAD" | "OPTIONS";

const WRITE_METHODS = new Set<WriteMethod>(["POST", "PUT", "DELETE", "PATCH"]);

const READ_METHODS = new Set<ReadMethod>(["GET", "HEAD", "OPTIONS"]);

export function isWriteMethod(method: string): method is WriteMethod {
  return WRITE_METHODS.has(method as WriteMethod);
}

export function isReadMethod(method: string): method is ReadMethod {
  return READ_METHODS.has(method as ReadMethod);
}

export function isGetMethod(method: string): method is "GET" {
  return method === "GET";
}
