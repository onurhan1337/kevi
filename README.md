# Kevi 🫆

**Edge-native dynamic configuration store**

Kevi is a high-performance, multi-tenant configuration and metadata store built on Cloudflare Workers and KV. It provides a secure API layer to manage dynamic configurations with built-in role-based access control (RBAC), origin validation, and automatic key prefixing.

## Project Structure

The project follows a modular middleware-based architecture:

- **src/middleware/**: Custom auth and initialization logic.
- **src/routes/kv.ts**: Core CRUD logic for Key-Value operations.
- **src/config.ts**: The "Brain" of the project where you define your services.
- **src/test/**: Pre-configured integration tests to ensure your changes don't break the API.

## Tech Stack

- **Hono**: Ultrafast web framework for the Edge.
- **Cloudflare Workers**: Serverless compute runtime.
- **Cloudflare KV**: Low-latency distributed key-value storage.
- **Vitest**: Native test runner with Cloudflare Workers pool support.
- **TypeScript**: End-to-end type safety.

## Workflow

The following diagram illustrates the request lifecycle, from token validation to KV interaction:

![Kevi Workflow](mermaid.png)

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

Generate a secure global `API_TOKEN` to protect your endpoint. You can generate one using the following command:

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

Service permissions are managed in `src/config.ts.` This allows granular control over which token can access which KV namespace and with what prefix.

```typescript
export const registry: KeviRegistry = {
  "dev-master-admin-321": {
    storage: "TEST_STORAGE",
    role: "admin",
    prefix: "dev",
    description: "Main development key with 'dev:' prefixing.",
    allowedOrigins: ["http://localhost:8787", "http://localhost:3000"],
  },
  "mobile-public-read-999": {
    storage: "KEVI_STORAGE",
    role: "read-only",
    description: "Public read-only access for mobile app.",
  },
};
```

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
curl -X POST [https://kevi.your-subdomain.workers.dev/v1/kv/settings](https://kevi.your-subdomain.workers.dev/v1/kv/settings) \
  -H "X-Kevi-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{"value": {"maintenance": false, "version": "1.0.4"}}'
```

### Get a Configuration

```bash
curl [https://kevi.your-subdomain.workers.dev/v1/kv/settings](https://kevi.your-subdomain.workers.dev/v1/kv/settings) \
  -H "X-Kevi-Token: your-token"
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Donate

[Support me](https://buymeacoffee.com/onurhan)
