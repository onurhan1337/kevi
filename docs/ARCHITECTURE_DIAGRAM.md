# Kevi Architecture Diagram

Simple visual diagrams explaining what Kevi is and how it works.

## What is Kevi?

Kevi is an **edge-native dynamic configuration store** built on Cloudflare Workers and KV. It provides a secure, multi-tenant API for managing key-value configurations with automatic service isolation.

```mermaid
graph LR
    subgraph "Clients"
        CLIENT1[Client App 1]
        CLIENT2[Client App 2]
        CLIENT3[Client App 3]
    end

    subgraph "Kevi API"
        WORKER[Cloudflare Worker<br/>Kevi API]

        subgraph "Token Resolution"
            TOKEN[Token<br/>X-Kevi-Token Header]
            SERVICE[Service ID<br/>dev-service, mobile-app, etc.]
        end

        subgraph "Service Config"
            CONFIG[Service Registry<br/>- Storage<br/>- Role admin/read-only<br/>- Prefix isolation<br/>- CORS origins]
        end
    end

    subgraph "Cloudflare KV"
        KV[KV Storage<br/>KEVI_STORAGE]
        KEY1[dev:settings<br/>dev:config]
        KEY2[mobile:settings<br/>mobile:config]
        KEY3[prod:settings<br/>prod:config]
    end

    CLIENT1 -->|Token 1| WORKER
    CLIENT2 -->|Token 2| WORKER
    CLIENT3 -->|Token 3| WORKER

    WORKER --> TOKEN
    TOKEN --> SERVICE
    SERVICE --> CONFIG
    CONFIG --> KV

    KV --> KEY1
    KV --> KEY2
    KV --> KEY3

    style WORKER fill:#f96,stroke:#333,stroke-width:3px
    style KV fill:#9f6,stroke:#333,stroke-width:2px
    style CONFIG fill:#9cf,stroke:#333,stroke-width:2px
```

## Request Flow

How a request flows through Kevi from client to KV storage:

```mermaid
sequenceDiagram
    participant Client
    participant Kevi as Kevi API<br/>(Cloudflare Worker)
    participant Registry as Service Registry
    participant KV as Cloudflare KV

    Client->>Kevi: GET /v1/kv/settings<br/>X-Kevi-Token: abc123...

    Kevi->>Kevi: Resolve Token<br/>TOKEN_abc123... → "dev-service"

    Kevi->>Registry: Lookup Service Config<br/>storage, role, prefix

    Registry-->>Kevi: Config:<br/>storage: TEST_STORAGE<br/>prefix: "dev"<br/>role: "admin"

    Kevi->>Kevi: Apply Prefix<br/>"settings" → "dev:settings"

    Kevi->>KV: GET dev:settings

    KV-->>Kevi: Value + Metadata

    Kevi-->>Client: 200 OK<br/>JSON Response
```

## Key Concepts

- **Token → Service**: Each token maps to a service ID via environment variables
- **Service Isolation**: Keys are prefixed per service (e.g., `dev:settings`, `prod:settings`)
- **Multi-tenant**: Multiple services can share the same KV namespace safely
- **Role-based Access**: Services have `admin` (read/write) or `read-only` roles
- **Edge-native**: Runs on Cloudflare Workers for global low-latency access
