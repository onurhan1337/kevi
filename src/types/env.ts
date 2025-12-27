export interface Env {
  KEVI_STORAGE: KVNamespace;
  TEST_STORAGE: KVNamespace;
  API_TOKEN?: string;
  [key: `TOKEN_${string}`]: string | undefined;
}
