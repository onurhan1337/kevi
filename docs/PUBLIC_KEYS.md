# Public Keys Guide

Public keys allow certain keys to be accessed from any origin via GET requests, bypassing CORS and origin validation. This is useful for public-facing data like app settings, feature flags, or configuration that needs to be accessible from any domain.

## Overview

Public keys are configured per service in the `publicKeys` array of the service definition. They support two pattern types:

1. **Exact Match**: `"public/settings"` - Matches exactly this key
2. **Wildcard Pattern**: `"public/*"` - Matches any key starting with `public/`

## How Public Keys Work

### Request Flow

When a GET request is made to a public key:

1. **CORS Policy**: Automatically set to `["*"]` (allows all origins)
2. **Authorization**: Skips origin validation and role checks
3. **KV Access**: Normal prefix isolation still applies
4. **Response**: Returns value with permissive CORS headers

### Important Restrictions

- **GET Requests Only**: Public key access only applies to GET requests
- **Write Operations**: POST and DELETE always require:
  - Origin validation (against `allowedOrigins`)
  - Admin role
- **Prefix Isolation**: Public keys still respect service prefix isolation

## Pattern Matching

### Exact Match

Matches the exact key name.

**Configuration**:
```typescript
publicKeys: ["public/settings", "config/app"]
```

**Matches**:
- ✅ `GET /v1/kv/public/settings`
- ✅ `GET /v1/kv/config/app`
- ❌ `GET /v1/kv/public/settings/v2` (not exact match)
- ❌ `GET /v1/kv/public/feature-flags` (not in list)

**Use Case**: Specific keys that should be publicly accessible.

### Wildcard Pattern

Matches any key starting with the prefix (before the `*`).

**Configuration**:
```typescript
publicKeys: ["public/*"]
```

**Matches**:
- ✅ `GET /v1/kv/public/settings`
- ✅ `GET /v1/kv/public/feature-flags`
- ✅ `GET /v1/kv/public/config/app`
- ✅ `GET /v1/kv/public/anything/here`
- ❌ `GET /v1/kv/private/settings` (doesn't start with `public/`)

**Use Case**: All keys under a specific namespace should be public.

### Multiple Patterns

You can combine exact matches and wildcards:

**Configuration**:
```typescript
publicKeys: [
  "public/*",           // All keys under public/
  "config/app",         // Exact match
  "feature-flags/*"     // All keys under feature-flags/
]
```

**Matches**:
- ✅ `GET /v1/kv/public/settings`
- ✅ `GET /v1/kv/public/anything`
- ✅ `GET /v1/kv/config/app`
- ✅ `GET /v1/kv/feature-flags/enable-new-ui`
- ❌ `GET /v1/kv/config/user` (not exact match, not wildcard)

## Performance Optimization

Public key pattern matching is **memoized** for performance:

- Patterns are parsed once per service
- Exact matches stored in a `Set<string>` for O(1) lookup
- Wildcard prefixes stored in an array for iteration
- Cache key: `serviceId`

This means pattern matching is extremely fast, even with many patterns.

## Examples

### Example 1: Public App Settings

**Service Configuration**:
```typescript
{
  "mobile-app": {
    storage: "KEVI_STORAGE",
    role: "read-only",
    prefix: "mobile",
    allowedOrigins: ["https://app.example.com"],
    publicKeys: ["public/settings", "public/config"],
  }
}
```

**Public Keys**:
- `mobile:public/settings` → Accessible from any origin
- `mobile:public/config` → Accessible from any origin

**Request Examples**:
```bash
# ✅ Public GET - No CORS restrictions
curl https://api.example.com/v1/kv/public/settings \
  -H "X-Kevi-Token: mobile-token" \
  -H "Origin: https://any-domain.com"

# ✅ Public GET - Works from any origin
curl https://api.example.com/v1/kv/public/config \
  -H "X-Kevi-Token: mobile-token" \
  -H "Origin: https://another-domain.com"

# ❌ Write operation - Still requires origin validation
curl -X POST https://api.example.com/v1/kv/public/settings \
  -H "X-Kevi-Token: mobile-token" \
  -H "Origin: https://any-domain.com"
  # Returns 403 - Origin not allowed (write operations always validate)
```

### Example 2: Wildcard Public Namespace

**Service Configuration**:
```typescript
{
  "public-api": {
    storage: "KEVI_STORAGE",
    role: "read-only",
    prefix: "public",
    allowedOrigins: ["https://admin.example.com"],
    publicKeys: ["public/*"],
  }
}
```

**Public Keys**: All keys under `public:` prefix

**Request Examples**:
```bash
# ✅ All these are publicly accessible via GET
curl https://api.example.com/v1/kv/public/settings \
  -H "X-Kevi-Token: public-api-token"

curl https://api.example.com/v1/kv/public/feature-flags \
  -H "X-Kevi-Token: public-api-token"

curl https://api.example.com/v1/kv/public/config/app \
  -H "X-Kevi-Token: public-api-token"

# ❌ Private keys still require origin validation
curl https://api.example.com/v1/kv/private/data \
  -H "X-Kevi-Token: public-api-token" \
  -H "Origin: https://unauthorized.com"
  # Returns 403 - Origin not allowed
```

### Example 3: Mixed Public and Private

**Service Configuration**:
```typescript
{
  "web-app": {
    storage: "KEVI_STORAGE",
    role: "admin",
    prefix: "web",
    allowedOrigins: ["https://app.example.com"],
    publicKeys: ["public/*", "config/app"],
  }
}
```

**Public Keys**:
- All keys under `public:` prefix
- Exact key `config/app`

**Request Examples**:
```bash
# ✅ Public GET - Any origin
curl https://api.example.com/v1/kv/public/settings \
  -H "X-Kevi-Token: web-app-token" \
  -H "Origin: https://any-domain.com"

# ✅ Public GET - Exact match
curl https://api.example.com/v1/kv/config/app \
  -H "X-Kevi-Token: web-app-token" \
  -H "Origin: https://any-domain.com"

# ❌ Private GET - Requires origin validation
curl https://api.example.com/v1/kv/private/data \
  -H "X-Kevi-Token: web-app-token" \
  -H "Origin: https://unauthorized.com"
  # Returns 403 - Origin not allowed

# ✅ Admin write - Requires origin validation (even for public keys)
curl -X POST https://api.example.com/v1/kv/public/settings \
  -H "X-Kevi-Token: web-app-token" \
  -H "Origin: https://app.example.com" \
  -d '{"value": {...}}'
  # Works - Origin matches allowedOrigins, role is admin
```

## Prefix Isolation with Public Keys

Public keys still respect service prefix isolation. If a service has `prefix: "dev"`, public keys are stored as `dev:public/settings`, not `public/settings`.

**Service Configuration**:
```typescript
{
  "dev-service": {
    storage: "TEST_STORAGE",
    role: "admin",
    prefix: "dev",
    publicKeys: ["public/*"],
  }
}
```

**Storage**:
- Key: `dev:public/settings` (with prefix)
- Public pattern: `public/*` (matches against raw key, not final key)

**Request**:
```bash
# Client requests: /v1/kv/public/settings
# System checks: Does "public/settings" match "public/*"? ✅
# System retrieves: dev:public/settings (with prefix)
# System returns: Value from dev:public/settings
```

This ensures that even public keys are isolated per service when using prefixes.

## Security Considerations

### When to Use Public Keys

✅ **Good Use Cases**:
- App configuration (version, maintenance mode)
- Feature flags (public feature toggles)
- Public API documentation
- CDN configuration
- Public settings that don't contain sensitive data

❌ **Avoid Public Keys For**:
- User data
- Authentication tokens
- API keys
- Sensitive configuration
- Personal information

### Best Practices

1. **Limit Scope**: Use exact matches when possible, wildcards only when necessary
2. **Separate Services**: Consider a dedicated "public-api" service for public data
3. **Read-Only Role**: Use `read-only` role for services that only expose public keys
4. **Monitor Access**: Log public key access for security auditing
5. **Regular Review**: Periodically review public key patterns to ensure they're still needed

## Troubleshooting

### Public Key Not Working

**Symptom**: GET request returns 403 Forbidden

**Check**:
1. Key matches pattern exactly (case-sensitive)
2. Pattern is correctly formatted (wildcard uses `*` suffix)
3. Service has `publicKeys` array configured
4. Request is GET (POST/DELETE always require origin validation)

### Pattern Not Matching

**Symptom**: Key should match pattern but doesn't

**Check**:
1. Exact match: Key must match exactly (no extra characters)
2. Wildcard: Key must start with prefix (before `*`)
3. Case sensitivity: Patterns are case-sensitive
4. Prefix isolation: Raw key is checked, not final key with prefix

### CORS Still Blocking

**Symptom**: Public key request blocked by CORS

**Check**:
1. Request is GET (only GET requests bypass CORS)
2. Key matches public key pattern
3. Service definition has `publicKeys` configured
4. Browser is sending proper CORS headers

