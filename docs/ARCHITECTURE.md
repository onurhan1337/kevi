# Kevi Architecture

This document explains the architectural flow of Kevi, from request initialization through authentication, authorization, and key-value operations.

## Overview

Kevi follows an **identity-first architecture** where tokens are directly mapped to services through environment variables. This eliminates JSON parsing and uses native Cloudflare environment mapping for optimal performance.

## Request Flow

The following diagram illustrates the complete request lifecycle:

```
[Client Request]
    │
    ├─ Headers: X-Kevi-Token, Origin
    │
    ▼
[initApp Middleware]
    │
    ├─ Extract X-Kevi-Token header
    │
    ├─ Resolve Token → Service ID
    │   ├─ Check: env[TOKEN_${token}]
    │   ├─ Fallback: env[API_TOKEN] (admin bypass)
    │   └─ Lookup: registry[serviceId]
    │
    ├─ Set Context Variables:
    │   ├─ service: ServiceDefinition
    │   └─ serviceId: ServiceName
    │
    ├─ Determine CORS Policy:
    │   ├─ If GET + Public Key → origins: ["*"]
    │   └─ Else → origins: service.allowedOrigins
    │
    └─ Apply CORS Middleware
        │
        ▼
[Route Handler (/v1/kv/*)]
    │
    ├─ authorize() Middleware (if write operation)
    │   ├─ Check Origin (if not public GET)
    │   ├─ Check Role (admin required for writes)
    │   └─ Allow/Deny
    │
    └─ KV Operation
        ├─ getResolvedKV()
        │   ├─ Extract KV namespace from service.storage
        │   ├─ Apply prefix: `${service.prefix}:${rawKey}`
        │   └─ Return typed KV context
        │
        └─ Execute Operation
            ├─ GET: Retrieve value
            ├─ POST: Store value + metadata
            └─ DELETE: Remove key
```

## Component Breakdown

### 1. Identity Mapping Layer (`initApp`)

**Location**: `src/middleware/init.ts`

**Purpose**: Maps tokens to service identities and sets up CORS policies.

**Key Functions**:

- **`resolveTokenToServiceId()`**: Resolves a token to a service ID

  - Checks `env[TOKEN_${token}]` for service mapping
  - Falls back to `env[API_TOKEN]` for admin access
  - Returns `ServiceName` or `undefined`

- **Token Resolution Flow**:

  1. Extract `X-Kevi-Token` header
  2. Lookup `env[TOKEN_${token}]` → Service ID
  3. If not found and `API_TOKEN` matches → Admin access
  4. Validate Service ID exists in `registry`
  5. Set `service` and `serviceId` in context

- **CORS Policy Determination**:
  - **Public GET Requests**: If key matches `publicKeys` pattern → `origins: ["*"]`
  - **All Other Requests**: Use `service.allowedOrigins` (defaults to `["*"]` if not specified)

**Environment Variables**:

- `TOKEN_<base64-token>`: Maps token to service ID (e.g., `TOKEN_abc123... = "dev-service"`)
- `API_TOKEN`: Master admin token (bypasses service isolation)

### 2. Authorization Layer (`authorize`)

**Location**: `src/middleware/auth.ts`

**Purpose**: Enforces role-based access control and origin validation.

**Authorization Checks**:

1. **Public Key Bypass**: GET requests to public keys skip all checks

   - Uses `isPublicKey()` utility with memoized pattern matching
   - Allows access from any origin

2. **Origin Validation**: For non-public requests

   - Checks `Origin` header against `service.allowedOrigins`
   - Wildcard `["*"]` allows all origins
   - Returns 403 if origin not allowed

3. **Role-Based Access Control**:
   - **Write Operations** (POST, DELETE): Require `admin` role
   - **Read Operations** (GET): Allow `read-only` or `admin` roles
   - Returns 403 with detailed error message if role insufficient

**Roles**:

- `admin`: Full read/write access
- `read-only`: Read-only access (GET operations only)

### 3. KV Operations Layer (`kv.ts`)

**Location**: `src/routes/kv.ts`

**Purpose**: Handles key-value operations with prefix isolation.

**Key Functions**:

- **`getResolvedKV()`**: Resolves KV namespace and applies prefix
  - Extracts KV namespace from `service.storage`
  - Applies prefix: `${service.prefix}:${rawKey}` (if prefix exists)
  - Returns typed context with `kv`, `finalKey`, `rawKey`, `service`, `serviceId`

**Operations**:

1. **GET `/v1/kv`**: List all keys

   - Filters by prefix: `kv.list({ prefix: "dev:" })`
   - Strips prefix from response keys
   - Supports pagination via `limit` and `cursor` query params

2. **GET `/v1/kv/:key`**: Get specific key

   - Retrieves value and metadata
   - Returns 404 if key not found
   - Prefix isolation ensures cross-service access is impossible

3. **POST `/v1/kv/:key`**: Create/update key

   - Requires `admin` role (enforced by `authorize("admin")`)
   - Auto-injects metadata: `updated_by`, `updated_at`
   - Merges with user-provided metadata
   - Supports optional TTL

4. **DELETE `/v1/kv/:key`**: Delete key
   - Requires `admin` role
   - Prefix isolation ensures only service's own keys can be deleted

### 4. Public Key Utility (`public-key.ts`)

**Location**: `src/utils/public-key.ts`

**Purpose**: Efficient pattern matching for public key access.

**Optimization**: Memoized pattern cache per service

- Separates exact matches (`Set<string>`) from wildcards (`string[]`)
- Cache key: `serviceId`
- Pattern format: `"public/*"` (wildcard) or `"public/settings"` (exact)

**Matching Logic**:

1. Check exact match set
2. If not found, check wildcard prefixes
3. Returns `true` if key matches any pattern

## Security Model

### Token Security

- Tokens are stored as environment variables in `wrangler.jsonc`
- Format: `TOKEN_<base64-encoded-token> = "<service-id>"`
- Tokens never appear in code or logs
- Each token maps to exactly one service

### Prefix Isolation

- Multiple services can share the same KV namespace
- Keys are prefixed: `${service.prefix}:${rawKey}`
- List operations filter by prefix
- Cross-service key access is architecturally impossible

### CORS Security

- Public keys: `origins: ["*"]` for GET requests only
- Service-specific: Uses `allowedOrigins` from service definition
- Write operations always require origin validation (unless public GET)

### Role-Based Access

- **Admin**: Full access to all operations
- **Read-Only**: GET operations only
- Write operations (POST, DELETE) always require admin role

## Performance Optimizations

1. **Memoized Public Key Matching**: Pattern cache per service avoids repeated parsing
2. **Direct Environment Lookup**: No JSON parsing for token resolution
3. **Type-Safe KV Access**: Compile-time validation of storage names
4. **Prefix Filtering**: KV list operations use prefix filtering (server-side)

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable error message"
}
```

**Error Types**:

- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Origin not allowed or insufficient permissions
- `404 Not Found`: Key does not exist

## Example Flow: Public Key Access

```
Request: GET /v1/kv/public/settings
Headers: X-Kevi-Token: abc123..., Origin: https://example.com

1. initApp extracts token → resolves to "dev-service"
2. initApp checks: isPublicKey("public/settings", "dev-service", ["public/*"])
   → Returns true (matches wildcard pattern)
3. initApp sets CORS: origins: ["*"]
4. authorize() checks: isPublicKey() → true → Skip all checks
5. KV operation: getResolvedKV() → prefix: "dev:" → finalKey: "dev:public/settings"
6. Return value with CORS: Access-Control-Allow-Origin: *
```

## Example Flow: Admin Write Operation

```
Request: POST /v1/kv/config
Headers: X-Kevi-Token: admin-token-xyz, Origin: https://admin.kevi.com
Body: { "value": {...}, "metadata": {...} }

1. initApp extracts token → resolves to "dev-service" (or admin via API_TOKEN)
2. initApp sets CORS: origins: ["https://admin.kevi.com"]
3. authorize("admin") checks:
   - Origin: "https://admin.kevi.com" ✓ (in allowedOrigins)
   - Role: "admin" ✓ (required for POST)
4. KV operation: getResolvedKV() → prefix: "dev:" → finalKey: "dev:config"
5. Store value with auto-injected metadata
6. Return success
```
