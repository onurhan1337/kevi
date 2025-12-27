import { ServiceRegistry } from "./types/config";

/**
 * KEVI SERVICE REGISTRY - Logic & Policy Layer
 *
 * This registry maps Service IDs to their operational rules.
 * Service IDs are resolved from the Identity Mapping Layer (vars.TOKEN_*).
 *
 * Architecture Flow:
 * [Client] -> X-Kevi-Token header -> [Identity Layer: vars.TOKEN_${token}]
 *   -> Service ID -> [Logic Layer: ServiceRegistry] -> Service Definition
 *   -> KV Binding + Role + Prefix + Allowed Origins
 *
 * Key Principles:
 * - Service IDs are logical identifiers (e.g., "dev-service", "mobile-app")
 * - Tokens are mapped directly in wrangler.jsonc as TOKEN_[SECRET_VALUE] = "[SERVICE_ID]"
 * - Multiple services can share the same KV namespace through prefix isolation
 * - All authorization logic uses the resolved Service ID, never plain-text tokens
 *
 * @example
 * wrangler.jsonc vars:
 *   "TOKEN_abc123...": "dev-service"
 *   "TOKEN_xyz789...": "mobile-app"
 *
 * Then this registry provides the operational rules for each service ID.
 */
export const registry: ServiceRegistry = {
  /**
   * Development service with admin access and prefix isolation
   */
  "dev-service": {
    storage: "TEST_STORAGE",
    role: "read-only",
    prefix: "dev",
    description:
      "Main development service with 'dev:' prefixing for key isolation.",
    allowedOrigins: ["http://localhost:8787", "http://localhost:3000"],
  },
} as const;
