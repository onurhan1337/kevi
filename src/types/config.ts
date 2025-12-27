import { Env } from "./env";

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export type KVStorageName = {
  [K in keyof Env]: Env[K] extends KVNamespace ? K : never;
}[keyof Env];

export type AccessRole = "admin" | "read-only";

/**
 * Service configuration details with full JSDoc support.
 * This represents the Logic & Policy Layer - operational rules for each service.
 */
export interface ServiceDefinition {
  /**
   * Target KV binding name from wrangler.jsonc.
   * Only valid KVNamespaces are shown in the autocomplete list.
   * @example "KEVI_STORAGE"
   */
  readonly storage: KVStorageName;
  /**
   * Permission level for this service.
   */
  readonly role: AccessRole;
  /**
   * Optional key prefix for logical isolation (e.g., "service_a").
   * Used to ensure multiple services can share the same KV namespace
   * through strict prefix isolation.
   * @example "service_a" -> keys stored as "service_a:key_1"
   */
  readonly prefix?: string;
  /**
   * Description of the service usage for internal documentation.
   */
  readonly description?: string;
  /**
   * List of allowed origins for CORS.
   * Use ["*"] for public access.
   * @example ["https://admin.kevi.com", "http://localhost:3000"]
   */
  readonly allowedOrigins?: readonly string[];
  /**
   * List of public keys that can be accessed from any origin via GET requests.
   * Supports wildcard patterns using * suffix (e.g., "public/*").
   * Write operations (POST, PUT, DELETE) always require strict origin and role checks.
   * @example ["public/settings", "public/*"]
   */
  readonly publicKeys?: readonly string[];
}

/**
 * ServiceRegistry: Map of Service Names to their Service Definitions.
 * This is the Logic & Policy Layer where each service-name maps to operational rules.
 *
 * The Service Name is resolved from the Identity Mapping Layer (vars.SERVICE_TOKENS)
 * and must be a valid key in this registry for type safety.
 *
 * @example
 * {
 *   "service-a": { storage: "KEVI_STORAGE", role: "admin", prefix: "service_a" },
 *   "service-b": { storage: "KEVI_STORAGE", role: "read-only", prefix: "service_b" }
 * }
 */
export type ServiceRegistry = Expand<{
  readonly [serviceName: string]: Expand<ServiceDefinition>;
}>;

/**
 * Service Name type extracted from ServiceRegistry keys.
 * Used to ensure type safety when resolving tokens to service names.
 */
export type ServiceName<T extends ServiceRegistry> = keyof T & string;
