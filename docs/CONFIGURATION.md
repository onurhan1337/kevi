# Configuration Guide

This guide explains how to configure Kevi's service registry and environment variables.

## Overview

Kevi uses a two-layer configuration system:

1. **Identity Mapping Layer** (`wrangler.jsonc`): Maps tokens to service IDs
2. **Logic & Policy Layer** (`src/config.ts`): Defines operational rules for each service

## Identity Mapping Layer (`wrangler.jsonc`)

The identity mapping layer uses Cloudflare Workers environment variables to map tokens directly to service IDs.

### Token Format

Tokens are stored as environment variables with the naming convention:

```
TOKEN_<base64-encoded-token> = "<service-id>"
```

### Generating Tokens

Generate secure tokens using OpenSSL:

```bash
openssl rand -base64 32
```

This generates a 32-byte base64-encoded token suitable for production use.

### Example Configuration

```jsonc
{
  "vars": {
    // Legacy admin token (optional, for backward compatibility)
    "API_TOKEN": "TOKEN_mdK+p90/Y2YVMHgngYotAYJMUFTPpKE6/DseCZeB4os=",

    // Identity Mapping: Direct token-to-service mapping
    // Format: TOKEN_[base64-token] = "[service-id]"
    "TOKEN_mdK+p90/Y2YVMHgngYotAYJMUFTPpKE6/DseCZeB4os=": "dev-service",
    "TOKEN_xyz789abc123def456ghi789jkl012mno345pqr678=": "mobile-app",
    "TOKEN_prod123secure456token789for012production345=": "production-service"
  }
}
```

### How Token Resolution Works

1. Client sends request with `X-Kevi-Token` header
2. Middleware extracts token value (e.g., `mdK+p90/Y2YVMHgngYotAYJMUFTPpKE6/DseCZeB4os=`)
3. Middleware looks up `env[TOKEN_${token}]`
4. If found, resolves to service ID (e.g., `"dev-service"`)
5. If not found, checks `env[API_TOKEN]` for admin bypass
6. Service ID is used to lookup operational rules in `registry`

### Admin Token (`API_TOKEN`)

The `API_TOKEN` is a special token that bypasses service isolation:

- **Purpose**: Master key for maintenance, global dashboards, or emergency access
- **Behavior**: When `X-Kevi-Token` matches `API_TOKEN`, the system attempts to use an "admin" service (if defined in registry)
- **Security**: Should be rotated regularly and kept secure
- **Usage**: Useful for administrative operations that need cross-service access

**Note**: If `API_TOKEN` is used but no "admin" service exists in the registry, the request will fail with a 401 error.

## Logic & Policy Layer (`src/config.ts`)

The logic layer defines operational rules for each service ID.

### Service Registry Structure

```typescript
export const registry: ServiceRegistry = {
  "service-id": {
    storage: "KV_STORAGE_NAME",
    role: "admin" | "read-only",
    prefix?: "service-prefix",
    description?: "Service description",
    allowedOrigins?: ["https://example.com"],
    publicKeys?: ["public/*", "settings"],
  },
};
```

### Field Descriptions

#### `storage` (required)

The KV namespace binding name from `wrangler.jsonc`.

**Type**: `KVStorageName` (auto-completed from your KV bindings)

**Example**:
```typescript
storage: "KEVI_STORAGE"
```

**Note**: Only valid KV namespace bindings are shown in autocomplete. Run `bun run cf-typegen` to sync types after adding KV namespaces.

#### `role` (required)

Permission level for the service.

**Values**:
- `"admin"`: Full read/write access (GET, POST, DELETE)
- `"read-only"`: Read-only access (GET only)

**Example**:
```typescript
role: "admin"
```

#### `prefix` (optional)

Key prefix for logical isolation. When specified, all keys are stored with this prefix.

**Purpose**: Allows multiple services to share the same KV namespace while maintaining isolation.

**Example**:
```typescript
prefix: "dev"
// Keys are stored as: "dev:key-name"
```

**Behavior**:
- List operations filter by prefix
- Get/Post/Delete operations automatically apply prefix
- Response keys have prefix stripped (for list operations)

#### `description` (optional)

Human-readable description of the service's purpose.

**Example**:
```typescript
description: "Main development service with 'dev:' prefixing for key isolation."
```

#### `allowedOrigins` (optional)

List of allowed origins for CORS validation.

**Default**: `["*"]` (allows all origins)

**Example**:
```typescript
allowedOrigins: ["https://admin.kevi.com", "http://localhost:3000"]
```

**Behavior**:
- Write operations always validate origin (unless public GET)
- Public GET requests bypass origin validation
- Use `["*"]` for public APIs or development

#### `publicKeys` (optional)

List of public keys that can be accessed from any origin via GET requests.

**Format**: Supports exact matches and wildcard patterns (`*` suffix)

**Example**:
```typescript
publicKeys: ["public/settings", "public/*", "config/app"]
```

**Behavior**:
- GET requests to public keys: CORS set to `["*"]`, skip authorization
- Write operations (POST, DELETE) always require origin validation and admin role
- Wildcard patterns match keys starting with the prefix

See [PUBLIC_KEYS.md](./PUBLIC_KEYS.md) for detailed examples.

## Complete Configuration Example

### `wrangler.jsonc`

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "KEVI_STORAGE",
      "id": "e2825ef5e9f0435b89c78d206b3ab610"
    },
    {
      "binding": "TEST_STORAGE",
      "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    }
  ],
  "vars": {
    "API_TOKEN": "TOKEN_admin123secure456token789master012key345=",
    "TOKEN_dev123abc456def789ghi012jkl345mno678pqr901=": "dev-service",
    "TOKEN_mobile123app456token789for012production345=": "mobile-app",
    "TOKEN_prod123secure456token789for012production345=": "production-service"
  }
}
```

### `src/config.ts`

```typescript
export const registry: ServiceRegistry = {
  "dev-service": {
    storage: "TEST_STORAGE",
    role: "admin",
    prefix: "dev",
    description: "Development service with prefix isolation",
    allowedOrigins: ["http://localhost:8787", "http://localhost:3000"],
    publicKeys: ["public/*"],
  },
  "mobile-app": {
    storage: "KEVI_STORAGE",
    role: "read-only",
    prefix: "mobile",
    description: "Mobile app with read-only access",
    allowedOrigins: ["https://app.example.com"],
    publicKeys: ["public/settings", "public/config"],
  },
  "production-service": {
    storage: "KEVI_STORAGE",
    role: "admin",
    prefix: "prod",
    description: "Production service with strict origin control",
    allowedOrigins: ["https://admin.example.com"],
  },
};
```

## Service Generator

Kevi includes a service generator to ensure consistent token generation and configuration:

```bash
bun gen:service -s your-service-name
```

The generator:
1. Validates service name (3-30 chars, lowercase, alphanumeric, hyphens)
2. Generates secure 32-byte token
3. Provides instructions for:
   - Adding token to `wrangler.jsonc`
   - Adding service definition to `src/config.ts`
   - Using token in `X-Kevi-Token` header

## Type Safety

Kevi provides full TypeScript type safety:

- **`KVStorageName`**: Auto-completed from your KV bindings
- **`ServiceName`**: Extracted from registry keys
- **`ServiceDefinition`**: Validates all required fields

Run `bun run cf-typegen` after adding KV namespaces to sync types.

## Environment-Specific Configuration

For different environments (dev, staging, production), use Wrangler's environment feature:

```jsonc
{
  "vars": {
    "API_TOKEN": "dev-token-here"
  },
  "env": {
    "production": {
      "vars": {
        "API_TOKEN": "prod-token-here"
      }
    }
  }
}
```

## Security Best Practices

1. **Token Generation**: Always use `openssl rand -base64 32` for production tokens
2. **Token Rotation**: Rotate tokens regularly, especially `API_TOKEN`
3. **Prefix Isolation**: Use prefixes to isolate services sharing the same KV namespace
4. **Origin Validation**: Restrict `allowedOrigins` in production
5. **Role Principle**: Use `read-only` role when write access is not needed
6. **Public Keys**: Limit public keys to truly public data (e.g., app settings, feature flags)

## Troubleshooting

### Token Not Resolving

**Symptom**: 401 Unauthorized - "Invalid or missing X-Kevi-Token header"

**Check**:
1. Token exists in `wrangler.jsonc` as `TOKEN_<value>`
2. Service ID exists in `registry`
3. Token value matches exactly (no extra spaces, correct base64 encoding)

### Service Not Found

**Symptom**: 401 Unauthorized - "Token valid but no matching service definition found in config"

**Check**:
1. Service ID in `wrangler.jsonc` matches key in `registry`
2. Service definition is properly formatted
3. Run `bun run cf-typegen` to sync types

### KV Namespace Not Found

**Symptom**: Error - "KV namespace 'STORAGE_NAME' not found in environment"

**Check**:
1. KV namespace binding exists in `wrangler.jsonc`
2. Binding name matches `storage` field in service definition
3. KV namespace ID is correct

### CORS Errors

**Symptom**: 403 Forbidden - "Origin '...' is not allowed"

**Check**:
1. Origin header matches `allowedOrigins` exactly
2. Public keys bypass origin validation for GET requests only
3. Write operations always require origin validation

