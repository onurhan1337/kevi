export function generateOpenAPISpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Kevi API",
      version: "1.0.0",
      description: `# Kevi API Documentation

Edge-native dynamic configuration store with identity-first architecture, role-based access control, and automatic key prefixing.

## Identity-First Architecture

Kevi uses an identity-first architecture where tokens are directly mapped to services through environment variables. This eliminates JSON parsing and uses native Cloudflare environment mapping for optimal performance.

### How Token Mapping Works

1. **Token Storage**: Tokens are stored as environment variables in \`wrangler.jsonc\` using the format \`TOKEN_<base64-token> = "<service-id>"\`
2. **Token Resolution**: When a request includes the \`X-Kevi-Token\` header, the middleware looks up \`env[TOKEN_\${token}]\` to resolve the service ID
3. **Service Lookup**: The resolved service ID is used to look up operational rules in the service registry (\`src/config.ts\`)
4. **Service Definition**: Each service defines its KV namespace, role, prefix, allowed origins, and public keys

### Example Flow

\`\`\`
Client Request → X-Kevi-Token: abc123...
  ↓
Middleware resolves: env[TOKEN_abc123...] → "dev-service"
  ↓
Registry lookup: registry["dev-service"] → ServiceDefinition
  ↓
KV Operation: Uses service.storage, service.prefix, service.role
\`\`\`

## Configuration Guide

To configure a new service in Kevi, you need to define a \`ServiceDefinition\` in the service registry (\`src/config.ts\`). Each service definition specifies operational rules including storage binding, access role, key prefixing, CORS origins, and public key patterns.

### ServiceDefinition Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| \`storage\` | \`KVStorageName\` | Yes | Cloudflare KV namespace binding name from \`wrangler.jsonc\`. Must match a KV namespace binding defined in your Cloudflare Workers configuration. |
| \`role\` | \`"admin" \| "read-only"\` | Yes | Access control level. \`"admin"\` grants full read/write/delete permissions. \`"read-only"\` restricts to GET operations only. Write operations (POST, DELETE) always require admin role. |
| \`prefix\` | \`string\` | No | Namespace isolation string. When provided, all keys are stored with this prefix (e.g., \`prefix: "dev"\` stores \`settings\` as \`dev:settings\`). Enables multiple services to share the same KV namespace while maintaining isolation. List operations automatically filter by prefix. |
| \`allowedOrigins\` | \`string[]\` | No | CORS whitelist for origin validation. Use \`["*"]\` to allow all origins (default). Public keys bypass origin validation for GET requests. Write operations always validate origin unless it's a public GET request. |
| \`publicKeys\` | \`string[]\` | No | Array of key patterns that allow global GET access from any origin. Supports exact matches (\`"public/settings"\`) and wildcard patterns (\`"public/*"\`). Wildcards match keys starting with the prefix before \`*\`. Write operations (POST, DELETE) always require origin validation and admin role, even for public keys. |
| \`description\` | \`string\` | No | Human-readable description of the service's purpose and usage. |

### Public Keys Pattern Matching

Public keys support two pattern types for flexible access control:

- **Exact Match**: \`"public/settings"\` matches exactly this key name
- **Wildcard Pattern**: \`"public/*"\` matches any key starting with \`public/\` (e.g., \`public/settings\`, \`public/config/app\`, \`public/feature-flags\`)

Patterns are case-sensitive and checked against the raw key (before prefix application). The system uses memoized pattern matching for optimal performance.

**Example Configuration**:
\`\`\`typescript
{
  storage: "KEVI_STORAGE",
  role: "admin",
  prefix: "dev",
  allowedOrigins: ["https://app.example.com"],
  publicKeys: ["public/*", "config/app", "settings"],
  description: "Development service with public config access"
}
\`\`\`

### Environment Setup

Kevi uses two types of tokens for authentication, each serving a different purpose:

#### Service Tokens (\`TOKEN_<hash>\`)

Service tokens map directly to a specific service ID through environment variables.

**Format**: \`TOKEN_<base64-encoded-token> = "<service-id>"\`

**Generation**:
\`\`\`bash
openssl rand -base64 32
\`\`\`

**Configuration** (in \`wrangler.jsonc\`):
\`\`\`jsonc
{
  "vars": {
    "TOKEN_mdK+p90/Y2YVMHgngYotAYJMUFTPpKE6/DseCZeB4os=": "dev-service",
    "TOKEN_xyz789abc123def456ghi789jkl012mno345pqr678=": "mobile-app"
  }
}
\`\`\`

**Usage**: Client sends token in \`X-Kevi-Token\` header. Middleware resolves \`env[TOKEN_\${token}]\` to get service ID, then looks up service definition in registry.

**Isolation**: Each service token is isolated to its own service definition (prefix, storage, role, origins).

#### Master Admin Token (\`API_TOKEN\`)

The master admin token provides cross-service access and bypasses service isolation.

**Format**: \`API_TOKEN = "<base64-encoded-token>"\`

**Configuration** (in \`wrangler.jsonc\`):
\`\`\`jsonc
{
  "vars": {
    "API_TOKEN": "TOKEN_mdK+p90/Y2YVMHgngYotAYJMUFTPpKE6/DseCZeB4os="
  }
}
\`\`\`

**Usage**: When \`X-Kevi-Token\` matches \`API_TOKEN\`, the system attempts to use an "admin" service (if defined in registry). If no "admin" service exists, request fails with 401.

**Purpose**: Maintenance operations, global dashboards, emergency access, cross-service administrative tasks.

**Security**: Should be rotated regularly and kept highly secure. Consider using separate admin tokens for different environments.

### Complete Service Setup Example

**Step 1**: Generate a service token
\`\`\`bash
openssl rand -base64 32
# Output: mdK+p90/Y2YVMHgngYotAYJMUFTPpKE6/DseCZeB4os=
\`\`\`

**Step 2**: Add token mapping to \`wrangler.jsonc\`
\`\`\`jsonc
{
  "vars": {
    "TOKEN_mdK+p90/Y2YVMHgngYotAYJMUFTPpKE6/DseCZeB4os=": "my-service"
  }
}
\`\`\`

**Step 3**: Add service definition to \`src/config.ts\`
\`\`\`typescript
export const registry: ServiceRegistry = {
  "my-service": {
    storage: "KEVI_STORAGE",
    role: "admin",
    prefix: "my-service",
    allowedOrigins: ["https://app.example.com"],
    publicKeys: ["public/*"],
    description: "My application service"
  }
};
\`\`\`

**Step 4**: Use token in API requests
\`\`\`bash
curl https://api.example.com/v1/kv/settings \\
  -H "X-Kevi-Token: mdK+p90/Y2YVMHgngYotAYJMUFTPpKE6/DseCZeB4os="
\`\`\`

## Security

### X-Kevi-Token Header

All API requests require the \`X-Kevi-Token\` header containing either:
- **Service Token**: Maps to a specific service via \`TOKEN_<value>\` environment variable
- **Admin Token**: Master key stored as \`API_TOKEN\` environment variable (bypasses service isolation)

### Allowed Origins

Each service can define \`allowedOrigins\` to restrict CORS access:
- **Public Keys**: GET requests to public keys bypass origin validation (CORS set to \`["*"]\`)
- **Service-Specific**: Other requests validate origin against \`service.allowedOrigins\`
- **Wildcard**: Use \`["*"]\` to allow all origins

### Public Keys

Public keys allow certain keys to be accessed from any origin via GET requests:
- **Exact Match**: \`"public/settings"\` matches exactly this key
- **Wildcard Pattern**: \`"public/*"\` matches any key starting with \`public/\`
- **Write Operations**: POST and DELETE always require origin validation and admin role, even for public keys

See [Public Keys Guide](../docs/PUBLIC_KEYS.md) for detailed examples.

## Admin Access

The \`API_TOKEN\` provides master admin access that bypasses service isolation:

- **Purpose**: Maintenance, global dashboards, emergency access
- **Behavior**: When \`X-Kevi-Token\` matches \`API_TOKEN\`, the system attempts to use an "admin" service (if defined in registry)
- **Security**: Should be rotated regularly and kept secure
- **Usage**: Useful for administrative operations that need cross-service access

**Note**: If \`API_TOKEN\` is used but no "admin" service exists in the registry, the request will fail with a 401 error.

## Prefix Isolation

Multiple services can share the same KV namespace through prefix isolation:

- **Prefix Application**: Keys are stored as \`\${service.prefix}:\${rawKey}\`
- **List Filtering**: List operations automatically filter by prefix
- **Cross-Service Protection**: Keys from other services are architecturally inaccessible

Example: Service with \`prefix: "dev"\` stores key \`settings\` as \`dev:settings\`.

## Role-Based Access Control

Services have two role levels:

- **admin**: Full read/write access (GET, POST, DELETE)
- **read-only**: Read-only access (GET operations only)

Write operations (POST, DELETE) always require the admin role, regardless of public key status.`,
      contact: {
        name: "Kevi Support",
      },
    },
    servers: [
      {
        url: "https://kevi.onurhandtr.workers.dev",
        description: "Production server",
      },
      {
        url: "http://localhost:8787",
        description: "Local development server",
      },
    ],
    tags: [
      {
        name: "KV Operations",
        description:
          "Key-value store operations with prefix isolation and role-based access control",
      },
      {
        name: "Health",
        description: "Health check and system status endpoints",
      },
    ],
    components: {
      securitySchemes: {
        KeviToken: {
          type: "apiKey",
          in: "header",
          name: "X-Kevi-Token",
          description:
            "Service token or admin token for authentication. Tokens are mapped to services via TOKEN_<value> environment variables.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              example: "Unauthorized",
            },
            message: {
              type: "string",
              example: "X-Kevi-Token header is missing",
            },
          },
          required: ["error", "message"],
        },
        KeyValue: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "ok",
            },
            data: {
              type: "object",
              description:
                "The stored value (can be any JSON-serializable object)",
            },
            metadata: {
              type: "object",
              description:
                "Key metadata object. Automatically includes system-generated fields: `updated_by` (service ID), `updated_at` (ISO timestamp). User-provided metadata is merged with system metadata.",
              properties: {
                updated_by: {
                  type: "string",
                  description:
                    "Service ID that last updated this key (automatically injected)",
                  example: "dev-service",
                },
                updated_at: {
                  type: "string",
                  format: "date-time",
                  description:
                    "ISO timestamp of last update (automatically injected)",
                  example: "2024-01-01T00:00:00.000Z",
                },
              },
              additionalProperties: true,
            },
          },
          required: ["status", "data"],
        },
        KeyList: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "ok",
            },
            keys: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    example: "settings",
                  },
                  metadata: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
            cursor: {
              type: "string",
              description: "Pagination cursor for next page",
            },
            list_complete: {
              type: "boolean",
              description: "Whether all keys have been returned",
            },
          },
          required: ["status", "keys", "list_complete"],
        },
        CreateKeyRequest: {
          type: "object",
          properties: {
            value: {
              description: "The value to store (any JSON-serializable object)",
              example: { maintenance: false, version: "1.0.4" },
            },
            metadata: {
              type: "object",
              description:
                "Optional custom metadata. System automatically injects `updated_by` (service ID) and `updated_at` (ISO timestamp). User-provided metadata is merged with system metadata. Custom fields can be added for application-specific tracking.",
              additionalProperties: true,
              example: {
                version: "1.0.0",
                environment: "production",
              },
            },
            ttl: {
              type: "number",
              description:
                "Optional time-to-live in seconds. Key will expire after this duration.",
              example: 3600,
            },
          },
          required: ["value"],
        },
        CreateKeyResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "ok",
            },
            message: {
              type: "string",
              example: "Key created/updated successfully",
            },
          },
          required: ["status", "message"],
        },
        DeleteKeyResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "ok",
            },
            message: {
              type: "string",
              example: "Key deleted successfully",
            },
          },
          required: ["status", "message"],
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "ok",
            },
            timestamp: {
              type: "string",
              format: "date-time",
            },
            version: {
              type: "string",
              example: "1.0.0",
            },
          },
          required: ["status", "timestamp"],
        },
        ServiceDefinition: {
          type: "object",
          description:
            "Service configuration defining operational rules for a service. Each service maps to a token via TOKEN_<hash> environment variables.",
          properties: {
            storage: {
              type: "string",
              description:
                "Cloudflare KV namespace binding name from wrangler.jsonc. Must match a KV namespace binding defined in your Cloudflare Workers configuration.",
              example: "KEVI_STORAGE",
            },
            role: {
              type: "string",
              enum: ["admin", "read-only"],
              description:
                "Access control level. 'admin' grants full read/write/delete permissions. 'read-only' restricts to GET operations only. Write operations (POST, DELETE) always require admin role.",
              example: "admin",
            },
            prefix: {
              type: "string",
              description:
                "Namespace isolation string. When provided, all keys are stored with this prefix (e.g., prefix: 'dev' stores 'settings' as 'dev:settings'). Enables multiple services to share the same KV namespace while maintaining isolation. List operations automatically filter by prefix.",
              example: "dev",
            },
            allowedOrigins: {
              type: "array",
              items: {
                type: "string",
              },
              description:
                "CORS whitelist for origin validation. Use ['*'] to allow all origins (default). Public keys bypass origin validation for GET requests. Write operations always validate origin unless it's a public GET request.",
              example: ["https://app.example.com", "http://localhost:3000"],
            },
            publicKeys: {
              type: "array",
              items: {
                type: "string",
              },
              description:
                "Array of key patterns that allow global GET access from any origin. Supports exact matches ('public/settings') and wildcard patterns ('public/*'). Wildcards match keys starting with the prefix before '*'. Pattern matching is case-sensitive and checked against raw key (before prefix application). Write operations (POST, DELETE) always require origin validation and admin role, even for public keys.",
              example: ["public/*", "config/app", "settings"],
            },
            description: {
              type: "string",
              description:
                "Human-readable description of the service's purpose and usage.",
              example: "Development service with public config access",
            },
          },
          required: ["storage", "role"],
        },
        RegistryConfig: {
          type: "object",
          description:
            "Service registry configuration. Maps service IDs to their ServiceDefinition objects. Service IDs are resolved from TOKEN_<hash> environment variables.",
          additionalProperties: {
            $ref: "#/components/schemas/ServiceDefinition",
          },
          example: {
            "dev-service": {
              storage: "TEST_STORAGE",
              role: "admin",
              prefix: "dev",
              allowedOrigins: ["http://localhost:8787"],
              publicKeys: ["public/*"],
              description: "Development service",
            },
            "mobile-app": {
              storage: "KEVI_STORAGE",
              role: "read-only",
              prefix: "mobile",
              allowedOrigins: ["https://app.example.com"],
              publicKeys: ["public/settings"],
              description: "Mobile app service",
            },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          description:
            "Returns the health status of the API. This endpoint is public and does not require authentication.",
          operationId: "healthCheck",
          responses: {
            "200": {
              description: "Service is healthy",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/HealthResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/v1/kv": {
        get: {
          tags: ["KV Operations"],
          summary: "List all keys",
          description:
            "List all keys for the current service with prefix isolation. Only returns keys that belong to this service's prefix. Public keys can be accessed from any origin via GET requests.",
          operationId: "listKeys",
          security: [{ KeviToken: [] }],
          parameters: [
            {
              name: "limit",
              in: "query",
              description: "Maximum number of keys to return",
              required: false,
              schema: {
                type: "integer",
                default: 100,
                minimum: 1,
                maximum: 1000,
              },
            },
            {
              name: "cursor",
              in: "query",
              description: "Pagination cursor from previous response",
              required: false,
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "List of keys",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/KeyList",
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized - Missing or invalid token",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "403": {
              description: "Forbidden - Origin not allowed",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/v1/kv/{key}": {
        get: {
          tags: ["KV Operations"],
          summary: "Get a key value",
          description:
            "Get a specific key value for the current service. Prefix isolation ensures keys from other services are not accessible. Public keys can be accessed from any origin via GET requests.",
          operationId: "getKey",
          security: [{ KeviToken: [] }],
          parameters: [
            {
              name: "key",
              in: "path",
              required: true,
              description:
                "The key name (3-512 characters, alphanumeric, dots, underscores, hyphens)",
              schema: {
                type: "string",
                minLength: 3,
                maxLength: 512,
                pattern: "^[a-zA-Z0-9._-]+$",
              },
            },
          ],
          responses: {
            "200": {
              description: "Key value retrieved successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/KeyValue",
                  },
                },
              },
            },
            "404": {
              description: "Key not found",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: {
                        type: "string",
                        example: "Not Found",
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized - Missing or invalid token",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "403": {
              description:
                "Forbidden - Origin not allowed or insufficient permissions",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["KV Operations"],
          summary: "Create or update a key",
          description:
            "Create or update a key-value pair for the current service. Requires admin role. Prefix isolation ensures keys are stored under service namespace. Automatically injects metadata (updated_by, updated_at).",
          operationId: "createOrUpdateKey",
          security: [{ KeviToken: [] }],
          parameters: [
            {
              name: "key",
              in: "path",
              required: true,
              description:
                "The key name (3-512 characters, alphanumeric, dots, underscores, hyphens)",
              schema: {
                type: "string",
                minLength: 3,
                maxLength: 512,
                pattern: "^[a-zA-Z0-9._-]+$",
              },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateKeyRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Key created/updated successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/CreateKeyResponse",
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized - Missing or invalid token",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "403": {
              description:
                "Forbidden - Admin role required for write operations",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ["KV Operations"],
          summary: "Delete a key",
          description:
            "Delete a key-value pair for the current service. Requires admin role. Prefix isolation ensures only service's own keys can be deleted.",
          operationId: "deleteKey",
          security: [{ KeviToken: [] }],
          parameters: [
            {
              name: "key",
              in: "path",
              required: true,
              description:
                "The key name (3-512 characters, alphanumeric, dots, underscores, hyphens)",
              schema: {
                type: "string",
                minLength: 3,
                maxLength: 512,
                pattern: "^[a-zA-Z0-9._-]+$",
              },
            },
          ],
          responses: {
            "200": {
              description: "Key deleted successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/DeleteKeyResponse",
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized - Missing or invalid token",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "403": {
              description:
                "Forbidden - Admin role required for delete operations",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
