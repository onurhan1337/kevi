export const ADMIN_TOKEN = "mdK+p90/Y2YVMHgngYotAYJMUFTPpKE6/DseCZeB4os="; // mock generated token
export const ALLOWED_ORIGIN = "http://localhost:3000";

const mockKV: KVNamespace = {
  get: async (
    _key: string,
    _type?: "text" | "json" | "arrayBuffer" | "stream"
  ) => {
    if (_type === "json") {
      return { name: "Kevi" };
    }
    return JSON.stringify({ name: "Kevi" });
  },
  getWithMetadata: async (
    _key: string,
    _type?: "text" | "json" | "arrayBuffer" | "stream"
  ) => {
    const value =
      _type === "json" ? { name: "Kevi" } : JSON.stringify({ name: "Kevi" });
    return {
      value,
      metadata: { version: "1.0" },
      cacheStatus: null,
    };
  },
  put: async () => {},
  delete: async () => {},
  list: async () => ({
    keys: [{ name: "dev:test-key", metadata: {} }],
    list_complete: true,
    cacheStatus: null,
  }),
} as unknown as KVNamespace;

export const mockEnv: Env & {
  API_TOKEN?: string;
  [key: `TOKEN_${string}`]: string | undefined;
} = {
  KEVI_STORAGE: mockKV,
  TEST_STORAGE: mockKV,
  [`TOKEN_${ADMIN_TOKEN}`]: "dev-service",
  API_TOKEN: ADMIN_TOKEN,
};
