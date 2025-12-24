import { KeviRegistry } from "./types/config";

/**
 * KEVI SERVICE REGISTRY
 * [Client] -> (API Key) -> [Registry] -> (KV Binding)
 * --------------------------------------------------
 * Role Check | Prefix Logic | Description
 */
export const registry: KeviRegistry = {
  // Admin key with 'dev' prefix
  "dev-master-admin-321": {
    storage: "TEST_STORAGE",
    role: "admin",
    prefix: "dev",
    description: "Main development key with 'dev:' prefixing.",
  },

  // Read-only key with no prefix
  "mobile-public-read-999": {
    storage: "KEVI_STORAGE",
    role: "read-only",
    description: "Public read-only access for mobile app.",
  },
};
