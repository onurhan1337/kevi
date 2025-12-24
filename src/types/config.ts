/**
 * Utility: Forces TypeScript to expand complex types in IDE tooltips.
 */
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

/**
 * Filtered Storage Names:
 * This logic iterates through 'Env' and only picks keys that are actual KVNamespaces.
 * It automatically filters out strings like 'API_TOKEN'.
 */
export type KVStorageName = {
  [K in keyof Env]: Env[K] extends KVNamespace ? K : never;
}[keyof Env];

export type AccessRole = "admin" | "read-only";

/**
 * Service configuration details with full JSDoc support.
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
   * Optional key prefix for logical isolation (e.g., "v1").
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
}

/**
 * KeviRegistry: Map of API Keys to their Service Definitions.
 */
export type KeviRegistry = Expand<{
  readonly [apiKey: string]: Expand<ServiceDefinition>;
}>;
