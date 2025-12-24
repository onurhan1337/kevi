export const mockEnv = {
  TEST_STORAGE: {
    get: async () => JSON.stringify({ name: "Kevi" }),
    getWithMetadata: async () => ({
      value: JSON.stringify({ name: "Kevi" }),
      metadata: { version: "1.0" },
    }),
    put: async () => {},
    delete: async () => {},
    list: async () => ({
      keys: [{ name: "dev:test-key", metadata: {} }],
      list_complete: true,
    }),
  },
};

export const ADMIN_TOKEN = "dev-master-admin-321";
export const ALLOWED_ORIGIN = "http://localhost:3000";
