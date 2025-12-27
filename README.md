# Kevi 🫆

**Multi-tenant edge-native key-value API with identity-first architecture**

Kevi is a high-performance, multi-tenant key-value store built on Cloudflare Workers and KV. It provides a secure, identity-first API layer for managing dynamic configurations with built-in service isolation, role-based access control (RBAC), origin validation, and automatic key prefixing.

## Table of Contents

- [Quick Start](#quick-start)
- [Documentation](#documentation)
  - [Architecture Guide](./docs/ARCHITECTURE.md) - Complete request flow and component breakdown
  - [Configuration Guide](./docs/CONFIGURATION.md) - Service registry and environment variables
  - [Public Keys Guide](./docs/PUBLIC_KEYS.md) - Public key patterns and examples
- [API Documentation](#api-documentation)
- [Infrastructure Setup](#infrastructure-setup)
- [Getting Started](#getting-started)
- [API Usage](#api-usage)

## Quick Start

1. **Install dependencies**:

   ```bash
   bun install
   ```

2. **Set up KV namespaces** (see [Infrastructure Setup](#infrastructure-setup))

3. **Generate a service token**:

   ```bash
   bun gen:service -s your-service-name
   ```

4. **Start development server**:

   ```bash
   bun run dev
   ```

5. **Access API documentation**:
   - OpenAPI Spec: https://kevi.onurhandtr.workers.dev/openapi.json
   - Scalar UI: https://kevi.onurhandtr.workers.dev/

## Documentation

Kevi includes comprehensive documentation covering architecture, configuration, and usage:

- **[Architecture Guide](./docs/ARCHITECTURE.md)**: Complete architecture documentation with visual diagrams, request flow, middleware layers, security model, and performance optimizations
- **[Configuration Guide](./docs/CONFIGURATION.md)**: Complete guide to service registry, token mapping, and environment variables
- **[Public Keys Guide](./docs/PUBLIC_KEYS.md)**: Understanding public key patterns, exact matches, wildcards, and security considerations

## API Documentation

Kevi provides interactive API documentation powered by [Scalar](https://scalar.com):

- **Local Development**: http://localhost:8787/
- **Production**: https://kevi.onurhandtr.workers.dev/

The Scalar UI includes:

- Interactive API testing with authentication
- Complete endpoint documentation with examples
- Security scheme configuration for `X-Kevi-Token`
- Request/response schemas
- Guide sections explaining identity-first architecture and security

### Health Check

Check API health status:

```bash
curl http://localhost:8787/health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## Project Structure

The project follows a modular middleware-based architecture:

- **src/middleware/**: Custom auth and initialization logic
  - `init.ts`: Token resolution, service mapping, CORS policy
  - `auth.ts`: Role-based access control and origin validation
- **src/routes/kv.ts**: Core CRUD logic for Key-Value operations
- **src/config.ts**: Service registry - operational rules for each service
- **src/utils/**: Utility functions
  - `public-key.ts`: Memoized pattern matching for public keys
  - `openapi.ts`: OpenAPI specification generator
- **src/test/**: Pre-configured integration tests

## Tech Stack

- **Hono**: Ultrafast web framework for the Edge.
- **Cloudflare Workers**: Serverless compute runtime.
- **Cloudflare KV**: Low-latency distributed key-value storage.
- **Vitest**: Native test runner with Cloudflare Workers pool support.
- **TypeScript**: End-to-end type safety.

## Workflow

See **[Architecture Guide](./docs/ARCHITECTURE.md)** for comprehensive visual documentation including request flow, system architecture, and component interactions.

## Infrastructure Setup

Kevi is designed to be a stand-alone tool that you can host on your own Cloudflare account. Following the [official Cloudflare Workers KV guide](https://hono.dev/docs/getting-started/cloudflare-workers#cloudflare-workers), follow these steps to set up your environment:

### 1. Login to Cloudflare

If you haven't logged in yet, authenticate your terminal with Wrangler:

```bash
bunx wrangler login
```

### 2. Create KV Namespaces

Create your storage buckets using the command below. Wrangler will ask if you want to add the ID to your configuration file automatically; you can simply say "Yes":

```bash
# Create production storage
bunx wrangler kv namespace create KEVI_STORAGE
```

> Note: If you skip the automatic setup, you must manually copy the IDs into your wrangler.jsonc file.

### 3. Global Security Token

Generate a secure global `API_TOKEN` to protect your endpoint. Use the service generator script:

```bash
bun gen:service -s admin
```

This will generate a token that you can use as your `API_TOKEN`. Alternatively, you can generate one manually:

```bash
openssl rand -base64 32
```

### Creating a New Service

Kevi uses a service-based authentication model. To maintain consistency and security, use the built-in generator to create a new service.

### Run the Generator

The generator validates the service name using Zod to ensure it is URL-friendly and generates a secure 32-byte token.

```bash
# Using Bun
bun gen:service -s your-service-name

# Using NPM
npm run gen:service -s your-service-name
```

### Service Name Rules

To pass the validation, your service name must:

- Be between 3 and 30 characters long.
- Contain only lowercase letters, numbers, and hyphens (-).
- Not contain special characters or spaces.

### Manual Integration

After running the command, follow the instructions in your terminal:

- Environment: Add the TOKEN\_... line to your wrangler.jsonc file under vars.
- Configuration: Copy the service definition into src/config.ts.
- Authentication: Use the provided raw token in your application's X-Kevi-Token header.

### Global Admin Token (Master Key)

The `API_TOKEN` acts as a master key. It bypasses service isolation and provides full access to the underlying KV storage (useful for maintenance or global dashboards).

Setup:

- Generate a secure token:

```bash
openssl rand -base64 32
```

- Add it to your `wrangler.jsonc`:

```bash
"vars": {
  "API_TOKEN": "your-master-admin-token"
}
```

### How to use in Requests

All requests must include the token in the `X-Kevi-Token` header:

```bash
curl http://localhost:8787/v1/kv/my-key \
  -H "X-Kevi-Token: <SERVICE_OR_ADMIN_TOKEN>"
```

### 4. Sync Types

After your KV namespaces are bound, run the type generator to enable smart autocomplete for your storage names in src/config.ts:

```bash
bun run cf-typegen
```

## Configuration

Service permissions are managed in `src/config.ts` and environment variables in `wrangler.jsonc`. See the [Configuration Guide](./docs/CONFIGURATION.md) for detailed information.

**Quick Example**:

```typescript
// src/config.ts
export const registry: ServiceRegistry = {
  "dev-service": {
    storage: "TEST_STORAGE",
    role: "admin",
    prefix: "dev",
    description: "Development service with prefix isolation",
    allowedOrigins: ["http://localhost:8787", "http://localhost:3000"],
    publicKeys: ["public/*"],
  },
};
```

```jsonc
// wrangler.jsonc
{
  "vars": {
    "TOKEN_abc123...": "dev-service"
  }
}
```

For complete configuration details, see [CONFIGURATION.md](./docs/CONFIGURATION.md).

## Getting Started

### Installation

```bash
bun install
```

### Development

```bash
bun run dev
```

### Running Tests

```bash
bun run test
```

### Deploy

```bash
bun run deploy
```

## API Usage

### Set a Configuration

```bash
curl -X POST https://kevi.onurhandtr.workers.dev/v1/kv/settings \
  -H "X-Kevi-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{"value": {"maintenance": false, "version": "1.0.4"}}'
```

### Get a Configuration

```bash
curl https://kevi.onurhandtr.workers.dev/v1/kv/settings \
  -H "X-Kevi-Token: your-token"
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Donate

[Support me](https://buymeacoffee.com/onurhan)
