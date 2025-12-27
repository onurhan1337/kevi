# Kevi Architecture Diagram

This document provides comprehensive Mermaid diagrams visualizing the project structure, request flow, and Cloudflare Workers integration.

## Complete System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        CLIENT[Client Application]
        ADMIN[Admin Dashboard]
    end

    subgraph "Cloudflare Edge Network"
        CF_WORKER[Cloudflare Worker<br/>Runtime]

        subgraph "Identity Mapping Layer"
            ENV_VARS[Environment Variables<br/>wrangler.jsonc]
            TOKEN_MAP[Token Mapping<br/>TOKEN_* → Service ID]
            API_TOKEN[API_TOKEN<br/>Admin Bypass]
        end

        subgraph "Application Layer"
            APP[Main App<br/>src/index.ts]

            subgraph "Middleware Stack"
                INIT[initApp Middleware<br/>src/middleware/init.ts]
                AUTH[authorize Middleware<br/>src/middleware/auth.ts]
            end

            subgraph "Route Handlers"
                KV_ROUTE[KV Routes<br/>src/routes/kv.ts]
            end
        end

        subgraph "Logic & Policy Layer"
            REGISTRY[Service Registry<br/>src/config.ts]
            SERVICE_DEF[Service Definition<br/>storage, role, prefix,<br/>allowedOrigins, publicKeys]
        end

        subgraph "Utility Layer"
            PUBLIC_KEY[Public Key Utility<br/>src/utils/public-key.ts]
            OPENAPI[OpenAPI Generator<br/>src/utils/openapi.ts]
        end

        subgraph "Storage Layer"
            KV_STORAGE1[KEVI_STORAGE<br/>KV Namespace]
            KV_STORAGE2[TEST_STORAGE<br/>KV Namespace]
        end
    end

    CLIENT -->|X-Kevi-Token Header| CF_WORKER
    ADMIN -->|X-Kevi-Token Header| CF_WORKER

    CF_WORKER --> APP
    APP --> INIT
    INIT --> ENV_VARS
    ENV_VARS --> TOKEN_MAP
    ENV_VARS --> API_TOKEN
    TOKEN_MAP --> REGISTRY
    API_TOKEN --> REGISTRY
    REGISTRY --> SERVICE_DEF
    INIT --> PUBLIC_KEY
    INIT --> AUTH
    AUTH --> KV_ROUTE
    KV_ROUTE --> SERVICE_DEF
    KV_ROUTE --> KV_STORAGE1
    KV_ROUTE --> KV_STORAGE2

    APP --> OPENAPI

    style CF_WORKER fill:#f96,stroke:#333,stroke-width:3px
    style REGISTRY fill:#9cf,stroke:#333,stroke-width:2px
    style KV_STORAGE1 fill:#9f6,stroke:#333,stroke-width:2px
    style KV_STORAGE2 fill:#9f6,stroke:#333,stroke-width:2px
```

## Request Flow Diagram

```mermaid
sequenceDiagram
    participant Client
    participant Worker as Cloudflare Worker
    participant Init as initApp Middleware
    participant Env as Environment Variables
    participant Registry as Service Registry
    participant Auth as authorize Middleware
    participant PublicKey as Public Key Utility
    participant KVRoute as KV Route Handler
    participant KV as KV Namespace

    Client->>Worker: HTTP Request<br/>(X-Kevi-Token, Origin)
    Worker->>Init: Route: /v1/kv/*

    Init->>Init: Extract X-Kevi-Token header
    Init->>Env: Lookup TOKEN_${token}

    alt Token Found
        Env-->>Init: Service ID (e.g., "dev-service")
    else Token Not Found
        Init->>Env: Check API_TOKEN
        alt API_TOKEN Match
            Env-->>Init: Admin Service ID
        else No Match
            Init-->>Client: 401 Unauthorized
        end
    end

    Init->>Registry: Lookup Service Definition
    Registry-->>Init: Service Config<br/>(storage, role, prefix, etc.)

    Init->>PublicKey: Check if Public Key<br/>(GET + publicKeys pattern)

    alt Public GET Request
        PublicKey-->>Init: true
        Init->>Init: Set CORS: origins: ["*"]
    else Regular Request
        PublicKey-->>Init: false
        Init->>Init: Set CORS: service.allowedOrigins
    end

    Init->>Init: Set Context Variables<br/>(service, serviceId)
    Init->>Auth: Continue to Route Handler

    alt Write Operation (POST/DELETE)
        Auth->>Auth: Check if Public GET
        alt Not Public GET
            Auth->>Auth: Validate Origin
            Auth->>Auth: Check Role (must be admin)
            alt Origin Valid & Admin Role
                Auth->>KVRoute: Continue
            else Invalid
                Auth-->>Client: 403 Forbidden
            end
        end
    else Read Operation (GET)
        alt Public Key
            Auth->>KVRoute: Skip checks, continue
        else Private Key
            Auth->>Auth: Validate Origin
            Auth->>KVRoute: Continue
        end
    end

    KVRoute->>KVRoute: getResolvedKV()<br/>Apply prefix isolation
    KVRoute->>KV: Execute Operation<br/>(GET/POST/DELETE)
    KV-->>KVRoute: Result
    KVRoute-->>Client: JSON Response<br/>(with CORS headers)
```

## Project Structure Diagram

```mermaid
graph TD
    subgraph "Root Directory"
        ROOT[kevi/]

        subgraph "Documentation"
            DOCS[docs/]
            ARCH[ARCHITECTURE.md]
            CONFIG[CONFIGURATION.md]
            PUBLIC[PUBLIC_KEYS.md]
            README[README.md]
        end

        subgraph "Source Code"
            SRC[src/]

            subgraph "Entry Point"
                INDEX[index.ts<br/>Main Application]
            end

            subgraph "Configuration"
                CONFIG_FILE[config.ts<br/>Service Registry]
            end

            subgraph "Middleware"
                MIDDLEWARE[middleware/]
                INIT_FILE[init.ts<br/>Token Resolution<br/>CORS Setup]
                AUTH_FILE[auth.ts<br/>RBAC & Origin Validation]
            end

            subgraph "Routes"
                ROUTES[routes/]
                KV_FILE[kv.ts<br/>CRUD Operations]
            end

            subgraph "Utilities"
                UTILS[utils/]
                PUBLIC_KEY_FILE[public-key.ts<br/>Memoized Pattern Matching]
                OPENAPI_FILE[openapi.ts<br/>OpenAPI Spec Generator]
            end

            subgraph "Types"
                TYPES[types/]
                CONFIG_TYPE[config.ts<br/>Service Types]
                ENV_TYPE[env.ts<br/>Environment Types]
                HTTP_TYPE[http.ts<br/>HTTP Method Types]
            end

            subgraph "Schemas"
                SCHEMAS[schemas/]
                SCHEMA_FILE[index.ts<br/>Zod Validators]
            end

            subgraph "Scripts"
                SCRIPTS[scripts/]
                GENERATOR[service-generator.ts<br/>Service Token Generator]
            end

            subgraph "Tests"
                TEST[test/]
                TEST_FILE[index.test.ts]
                MOCK[mock.ts]
            end
        end

        subgraph "Configuration Files"
            PKG[package.json<br/>Dependencies & Scripts]
            TS_CONFIG[tsconfig.json<br/>TypeScript Config]
            WRANGLER[wrangler.jsonc<br/>Cloudflare Config<br/>KV Namespaces<br/>Environment Variables]
            VERCEL[vercel.json<br/>Vercel Deployment]
        end

        subgraph "Public Assets"
            PUBLIC_DIR[public/]
            HTML[index.html]
            OPENAPI_JSON[openapi.json]
        end
    end

    ROOT --> DOCS
    ROOT --> SRC
    ROOT --> PKG
    ROOT --> TS_CONFIG
    ROOT --> WRANGLER
    ROOT --> VERCEL
    ROOT --> PUBLIC_DIR

    DOCS --> ARCH
    DOCS --> CONFIG
    DOCS --> PUBLIC

    SRC --> INDEX
    SRC --> CONFIG_FILE
    SRC --> MIDDLEWARE
    SRC --> ROUTES
    SRC --> UTILS
    SRC --> TYPES
    SRC --> SCHEMAS
    SRC --> SCRIPTS
    SRC --> TEST

    MIDDLEWARE --> INIT_FILE
    MIDDLEWARE --> AUTH_FILE
    ROUTES --> KV_FILE
    UTILS --> PUBLIC_KEY_FILE
    UTILS --> OPENAPI_FILE
    TYPES --> CONFIG_TYPE
    TYPES --> ENV_TYPE
    TYPES --> HTTP_TYPE
    SCHEMAS --> SCHEMA_FILE
    SCRIPTS --> GENERATOR
    TEST --> TEST_FILE
    TEST --> MOCK

    PUBLIC_DIR --> HTML
    PUBLIC_DIR --> OPENAPI_JSON

    INDEX --> CONFIG_FILE
    INDEX --> INIT_FILE
    INDEX --> KV_FILE
    INDEX --> OPENAPI_FILE

    INIT_FILE --> CONFIG_FILE
    INIT_FILE --> PUBLIC_KEY_FILE
    AUTH_FILE --> CONFIG_FILE
    AUTH_FILE --> PUBLIC_KEY_FILE
    KV_FILE --> CONFIG_FILE
    KV_FILE --> SCHEMA_FILE

    style INDEX fill:#f96,stroke:#333,stroke-width:3px
    style CONFIG_FILE fill:#9cf,stroke:#333,stroke-width:2px
    style WRANGLER fill:#fc9,stroke:#333,stroke-width:2px
```

## Security & Authorization Flow

```mermaid
graph TB
    subgraph "Request Arrives"
        REQ[HTTP Request<br/>X-Kevi-Token<br/>Origin Header]
    end

    subgraph "Identity Resolution"
        TOKEN_CHECK{Token in<br/>env.TOKEN_*?}
        ADMIN_CHECK{Matches<br/>API_TOKEN?}
        SERVICE_ID[Service ID Resolved]
    end

    subgraph "Service Lookup"
        REGISTRY_LOOKUP[Lookup in Registry]
        SERVICE_CONFIG[Service Definition<br/>- storage<br/>- role: admin/read-only<br/>- prefix<br/>- allowedOrigins<br/>- publicKeys]
    end

    subgraph "CORS Policy Determination"
        PUBLIC_CHECK{GET Request<br/>&<br/>Public Key?}
        CORS_PUBLIC[CORS: origins: ['*']]
        CORS_SERVICE[CORS: service.allowedOrigins]
    end

    subgraph "Authorization Checks"
        METHOD_CHECK{Request Method?}
        PUBLIC_GET{Public GET?}
        ORIGIN_CHECK{Origin Valid?}
        ROLE_CHECK{Role Check}
    end

    subgraph "KV Operation"
        PREFIX_APPLY[Apply Prefix<br/>prefix:key]
        KV_OP[KV Operation<br/>GET/POST/DELETE]
        RESPONSE[JSON Response]
    end

    REQ --> TOKEN_CHECK
    TOKEN_CHECK -->|Yes| SERVICE_ID
    TOKEN_CHECK -->|No| ADMIN_CHECK
    ADMIN_CHECK -->|Yes| SERVICE_ID
    ADMIN_CHECK -->|No| ERROR_401[401 Unauthorized]

    SERVICE_ID --> REGISTRY_LOOKUP
    REGISTRY_LOOKUP --> SERVICE_CONFIG

    SERVICE_CONFIG --> PUBLIC_CHECK
    PUBLIC_CHECK -->|Yes| CORS_PUBLIC
    PUBLIC_CHECK -->|No| CORS_SERVICE

    CORS_PUBLIC --> METHOD_CHECK
    CORS_SERVICE --> METHOD_CHECK

    METHOD_CHECK -->|GET| PUBLIC_GET
    METHOD_CHECK -->|POST/DELETE| ORIGIN_CHECK

    PUBLIC_GET -->|Yes| PREFIX_APPLY
    PUBLIC_GET -->|No| ORIGIN_CHECK

    ORIGIN_CHECK -->|Valid| ROLE_CHECK
    ORIGIN_CHECK -->|Invalid| ERROR_403_ORIGIN[403 Forbidden<br/>Origin not allowed]

    ROLE_CHECK -->|Admin for Write| PREFIX_APPLY
    ROLE_CHECK -->|Read-only for Write| ERROR_403_ROLE[403 Forbidden<br/>Insufficient permissions]
    ROLE_CHECK -->|Read-only for Read| PREFIX_APPLY

    PREFIX_APPLY --> KV_OP
    KV_OP --> RESPONSE

    style ERROR_401 fill:#f66,stroke:#333,stroke-width:2px
    style ERROR_403_ORIGIN fill:#f66,stroke:#333,stroke-width:2px
    style ERROR_403_ROLE fill:#f66,stroke:#333,stroke-width:2px
    style SERVICE_CONFIG fill:#9cf,stroke:#333,stroke-width:2px
    style KV_OP fill:#9f6,stroke:#333,stroke-width:2px
```

## Cloudflare Workers Integration

```mermaid
graph LR
    subgraph "Cloudflare Platform"
        CF_ACCOUNT[Cloudflare Account]

        subgraph "Workers"
            WORKER[Kevi Worker<br/>Runtime: Edge]
            BINDINGS[Bindings]
        end

        subgraph "KV Storage"
            KV1[KEVI_STORAGE<br/>Namespace ID]
            KV2[TEST_STORAGE<br/>Namespace ID]
        end

        subgraph "Environment Variables"
            ENV_VARS[Secrets & Vars<br/>- API_TOKEN<br/>- TOKEN_* mappings]
        end
    end

    subgraph "Deployment"
        WRANGLER[wrangler.jsonc<br/>Configuration]
        DEPLOY[wrangler deploy]
    end

    subgraph "Local Development"
        DEV[wrangler dev<br/>Local Testing]
        MINIFLARE[Miniflare<br/>KV Simulation]
    end

    WRANGLER --> DEPLOY
    DEPLOY --> CF_ACCOUNT
    CF_ACCOUNT --> WORKER
    CF_ACCOUNT --> KV1
    CF_ACCOUNT --> KV2
    CF_ACCOUNT --> ENV_VARS

    WORKER --> BINDINGS
    BINDINGS --> KV1
    BINDINGS --> KV2
    BINDINGS --> ENV_VARS

    WRANGLER --> DEV
    DEV --> MINIFLARE
    MINIFLARE --> KV1
    MINIFLARE --> KV2

    style WORKER fill:#f96,stroke:#333,stroke-width:3px
    style KV1 fill:#9f6,stroke:#333,stroke-width:2px
    style KV2 fill:#9f6,stroke:#333,stroke-width:2px
    style WRANGLER fill:#fc9,stroke:#333,stroke-width:2px
```

## Data Flow: Prefix Isolation

```mermaid
graph TB
    subgraph "Client Request"
        CLIENT_REQ[GET /v1/kv/settings<br/>X-Kevi-Token: abc123...]
    end

    subgraph "Service Resolution"
        TOKEN[Token: abc123...]
        SERVICE_ID[Service ID: dev-service]
        SERVICE_CONFIG[Config:<br/>prefix: 'dev'<br/>storage: 'TEST_STORAGE']
    end

    subgraph "Key Resolution"
        RAW_KEY[Raw Key: 'settings']
        PREFIX_APPLY[Apply Prefix]
        FINAL_KEY[Final Key: 'dev:settings']
    end

    subgraph "KV Storage"
        KV_NAMESPACE[TEST_STORAGE<br/>KV Namespace]
        KV_KEY1[dev:settings<br/>Value: {...}]
        KV_KEY2[dev:config<br/>Value: {...}]
        KV_KEY3[prod:settings<br/>Value: {...}]
    end

    subgraph "Response"
        RESPONSE[JSON Response<br/>data: {...}<br/>metadata: {...}]
    end

    CLIENT_REQ --> TOKEN
    TOKEN --> SERVICE_ID
    SERVICE_ID --> SERVICE_CONFIG
    SERVICE_CONFIG --> RAW_KEY
    RAW_KEY --> PREFIX_APPLY
    PREFIX_APPLY --> FINAL_KEY
    FINAL_KEY --> KV_NAMESPACE
    KV_NAMESPACE --> KV_KEY1
    KV_KEY1 --> RESPONSE

    style FINAL_KEY fill:#9cf,stroke:#333,stroke-width:2px
    style KV_KEY1 fill:#9f6,stroke:#333,stroke-width:2px
    style KV_KEY2 fill:#ccc,stroke:#333,stroke-width:1px,stroke-dasharray: 5 5
    style KV_KEY3 fill:#ccc,stroke:#333,stroke-width:1px,stroke-dasharray: 5 5
```

## Component Interaction Diagram

```mermaid
graph TB
    subgraph "Core Components"
        APP[index.ts<br/>Hono Application]
        CONFIG[config.ts<br/>Service Registry]
    end

    subgraph "Middleware Components"
        INIT[init.ts<br/>- Token Resolution<br/>- CORS Setup<br/>- Context Setting]
        AUTH[auth.ts<br/>- Origin Validation<br/>- Role Checking<br/>- Public Key Bypass]
    end

    subgraph "Route Components"
        KV[kv.ts<br/>- getResolvedKV<br/>- GET /v1/kv<br/>- GET /v1/kv/:key<br/>- POST /v1/kv/:key<br/>- DELETE /v1/kv/:key]
    end

    subgraph "Utility Components"
        PUBLIC_KEY[public-key.ts<br/>- isPublicKey<br/>- Pattern Cache]
        OPENAPI[openapi.ts<br/>- generateOpenAPISpec]
        SCHEMAS[schemas/index.ts<br/>- keySchema<br/>- kvBodySchema]
    end

    subgraph "Type System"
        TYPES_CONFIG[types/config.ts<br/>- ServiceDefinition<br/>- ServiceRegistry<br/>- AccessRole]
        TYPES_ENV[types/env.ts<br/>- Env Interface]
        TYPES_HTTP[types/http.ts<br/>- HTTP Method Types]
    end

    APP --> INIT
    APP --> KV
    APP --> OPENAPI

    INIT --> CONFIG
    INIT --> PUBLIC_KEY
    INIT --> TYPES_CONFIG
    INIT --> TYPES_ENV

    AUTH --> CONFIG
    AUTH --> PUBLIC_KEY
    AUTH --> TYPES_CONFIG
    AUTH --> TYPES_HTTP

    KV --> CONFIG
    KV --> AUTH
    KV --> SCHEMAS
    KV --> TYPES_CONFIG
    KV --> TYPES_ENV

    PUBLIC_KEY --> TYPES_CONFIG

    CONFIG --> TYPES_CONFIG

    style APP fill:#f96,stroke:#333,stroke-width:3px
    style CONFIG fill:#9cf,stroke:#333,stroke-width:2px
    style KV fill:#9f6,stroke:#333,stroke-width:2px
```

## Public Key Pattern Matching Flow

```mermaid
graph TB
    subgraph "Configuration"
        CONFIG[Service Config<br/>publicKeys: ['public/*', 'settings']]
    end

    subgraph "Pattern Cache"
        CACHE[Pattern Cache<br/>Key: serviceId]
        EXACT_SET[Exact Matches Set<br/>Set: 'settings']
        WILDCARD_ARRAY[Wildcard Prefixes<br/>Array: ['public/']]
    end

    subgraph "Matching Logic"
        KEY[Input Key: 'public/settings']
        CHECK_EXACT{In Exact Set?}
        CHECK_WILDCARD{Starts with<br/>Wildcard Prefix?}
        RESULT[Match Result]
    end

    CONFIG --> CACHE
    CACHE --> EXACT_SET
    CACHE --> WILDCARD_ARRAY

    KEY --> CHECK_EXACT
    CHECK_EXACT -->|Yes| RESULT
    CHECK_EXACT -->|No| CHECK_WILDCARD
    CHECK_WILDCARD -->|Yes| RESULT
    CHECK_WILDCARD -->|No| RESULT

    RESULT -->|true| PUBLIC_ACCESS[Public Access<br/>CORS: ['*']<br/>Skip Auth]
    RESULT -->|false| PRIVATE_ACCESS[Private Access<br/>CORS: allowedOrigins<br/>Full Auth]

    style CACHE fill:#9cf,stroke:#333,stroke-width:2px
    style RESULT fill:#fc9,stroke:#333,stroke-width:2px
```

These diagrams provide a comprehensive visualization of:

- **System Architecture**: Overall structure and component relationships
- **Request Flow**: Step-by-step request processing
- **Project Structure**: File organization and dependencies
- **Security Flow**: Authentication and authorization logic
- **Cloudflare Integration**: Workers and KV setup
- **Data Flow**: Prefix isolation mechanism
- **Component Interactions**: How modules work together
- **Public Key Matching**: Pattern matching optimization
