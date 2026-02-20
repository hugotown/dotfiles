# Environment Variables Configuration

Next.js provides built-in support for environment variables with automatic loading and bundling. Configure environment variables using `.env` files and access them in your application.

## Environment Files

Next.js loads environment variables from the following files in order:

```bash
.env.local          # Local overrides (all environments)
.env.development    # Development environment
.env.production     # Production environment
.env.test           # Test environment
.env                # Default for all environments
```

### File Priority

1. `.env.$(NODE_ENV).local`
2. `.env.local` (not loaded when NODE_ENV is test)
3. `.env.$(NODE_ENV)`
4. `.env`

## Environment Variable Types

### Server-Side Only

Available only in Node.js environment (API routes, getServerSideProps, etc.):

```bash
# .env.local
DATABASE_URL=postgresql://user:pass@localhost:5432/db
API_SECRET_KEY=secret-key-here
PRIVATE_API_TOKEN=private-token
```

Usage:

```javascript
// API route or server component
const dbUrl = process.env.DATABASE_URL
const apiKey = process.env.API_SECRET_KEY
```

### Client-Side (Browser)

Expose to browser by prefixing with `NEXT_PUBLIC_`:

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_ANALYTICS_ID=UA-123456789-1
NEXT_PUBLIC_SITE_URL=https://example.com
```

Usage:

```javascript
// Client component or browser code
const apiUrl = process.env.NEXT_PUBLIC_API_URL
const analyticsId = process.env.NEXT_PUBLIC_ANALYTICS_ID
```

## Configuration in next.config.js

### Basic Environment Variables

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
    API_URL: process.env.API_URL,
  },
}

module.exports = nextConfig
```

**Note**: This embeds values at build time. Prefer `.env` files with `NEXT_PUBLIC_` prefix for client-side values.

### Referencing Environment Variables

```javascript
const nextConfig = {
  // Use environment variables in config
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.ASSET_PREFIX,

  images: {
    domains: [process.env.IMAGE_DOMAIN],
  },
}
```

## Environment Variable Patterns

### Default Values

```javascript
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.default.com'
const port = process.env.PORT || 3000
```

### Required Variables

```javascript
// Check at build time
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}
```

### Type Conversion

```javascript
// Boolean
const isProduction = process.env.NODE_ENV === 'production'
const debugMode = process.env.DEBUG === 'true'

// Number
const port = parseInt(process.env.PORT || '3000', 10)
const maxItems = Number(process.env.MAX_ITEMS || 100)

// JSON
const config = JSON.parse(process.env.APP_CONFIG || '{}')
```

## Environment-Specific Configuration

### Development Environment

```bash
# .env.development
NEXT_PUBLIC_API_URL=http://localhost:4000
DEBUG=true
LOG_LEVEL=debug
```

### Production Environment

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.example.com
DEBUG=false
LOG_LEVEL=error
```

### Test Environment

```bash
# .env.test
NEXT_PUBLIC_API_URL=http://localhost:5000
DATABASE_URL=postgresql://test:test@localhost:5432/testdb
```

## Loading Environment Variables

### Built-in Loading

Next.js automatically loads `.env*` files:

```javascript
// No configuration needed - just access variables
const dbUrl = process.env.DATABASE_URL
```

### Manual Loading with dotenv

For non-Next.js scripts:

```javascript
// scripts/setup.js
require('dotenv').config({ path: '.env.local' })

const dbUrl = process.env.DATABASE_URL
```

### Custom Environment Files

```javascript
// next.config.js
const { loadEnvConfig } = require('@next/env')

const projectDir = process.cwd()
loadEnvConfig(projectDir)

module.exports = {
  // Config using loaded env vars
  env: {
    CUSTOM_VAR: process.env.CUSTOM_VAR,
  },
}
```

## Common Patterns

### API Configuration

```bash
# .env.local
# API Configuration
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_API_VERSION=v1
API_SECRET_KEY=secret-key

# Feature Flags
NEXT_PUBLIC_FEATURE_NEW_UI=true
NEXT_PUBLIC_FEATURE_ANALYTICS=false
```

```javascript
// lib/api.js
const API_URL = process.env.NEXT_PUBLIC_API_URL
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION

export const apiClient = {
  baseURL: `${API_URL}/${API_VERSION}`,
  headers: {
    'X-API-Key': process.env.API_SECRET_KEY, // Server-side only
  },
}
```

### Database Configuration

```bash
# .env.local
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

```javascript
// lib/db.js
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
  max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
})
```

### Authentication Configuration

```bash
# .env.local
# Auth0 Configuration
AUTH0_SECRET=secret-key
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://tenant.auth0.com
AUTH0_CLIENT_ID=client-id
AUTH0_CLIENT_SECRET=client-secret

# Public keys for client-side
NEXT_PUBLIC_AUTH0_DOMAIN=tenant.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=client-id
```

### Multi-tenant Configuration

```bash
# .env.local
# Tenant A
TENANT_A_API_URL=https://tenant-a.api.com
TENANT_A_API_KEY=key-a

# Tenant B
TENANT_B_API_URL=https://tenant-b.api.com
TENANT_B_API_KEY=key-b
```

## Variable Expansion

Next.js supports variable expansion in `.env*` files:

```bash
# .env
HOSTNAME=localhost
PORT=3000
HOST=http://$HOSTNAME:$PORT
NEXT_PUBLIC_API_URL=$HOST/api

# Results in:
# HOST=http://localhost:3000
# NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### With Curly Braces

```bash
BASE_URL=https://example.com
NEXT_PUBLIC_IMAGE_URL=${BASE_URL}/images
NEXT_PUBLIC_API_URL=${BASE_URL}/api/v1
```

## Environment Variables in Different Contexts

### In Server Components (App Router)

```typescript
// app/page.tsx
export default function Page() {
  const dbUrl = process.env.DATABASE_URL // Server-side only
  const publicUrl = process.env.NEXT_PUBLIC_API_URL // Available

  return <div>...</div>
}
```

### In Client Components

```typescript
'use client'

// app/components/ClientComponent.tsx
export default function ClientComponent() {
  // Only NEXT_PUBLIC_ variables available
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  // const dbUrl = process.env.DATABASE_URL // Undefined!

  return <div>{apiUrl}</div>
}
```

### In API Routes

```typescript
// pages/api/users.ts
export default async function handler(req, res) {
  // All environment variables available
  const dbUrl = process.env.DATABASE_URL
  const apiKey = process.env.API_SECRET_KEY

  // ...
}
```

### In Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server'

export function middleware(request) {
  // Environment variables available
  const apiKey = process.env.API_KEY

  // ...
}
```

### In getServerSideProps

```typescript
// pages/profile.tsx
export async function getServerSideProps() {
  // Server-side - all variables available
  const apiUrl = process.env.API_URL
  const apiKey = process.env.API_SECRET_KEY

  return { props: {} }
}
```

## Security Best Practices

### Never Commit Secrets

```bash
# .gitignore
.env*.local
.env.development.local
.env.test.local
.env.production.local
```

### Use NEXT_PUBLIC_ Carefully

```bash
# Good: Public information
NEXT_PUBLIC_SITE_URL=https://example.com
NEXT_PUBLIC_ANALYTICS_ID=UA-123456

# Bad: Secrets exposed to browser!
# NEXT_PUBLIC_API_SECRET=secret  # DON'T DO THIS
```

### Validate Required Variables

```javascript
// lib/env.js
const requiredEnvVars = [
  'DATABASE_URL',
  'API_SECRET_KEY',
  'NEXT_PUBLIC_API_URL',
]

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`)
  }
})
```

### Type-Safe Environment Variables

```typescript
// env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string
    API_SECRET_KEY: string
    NEXT_PUBLIC_API_URL: string
    NEXT_PUBLIC_ANALYTICS_ID?: string
  }
}

// Usage with type safety
const dbUrl: string = process.env.DATABASE_URL
```

Using Zod for validation:

```typescript
// lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_SECRET_KEY: z.string().min(32),
  NEXT_PUBLIC_API_URL: z.string().url(),
  PORT: z.string().transform(Number).default('3000'),
})

export const env = envSchema.parse(process.env)
```

## Testing with Environment Variables

### In Jest Tests

```javascript
// jest.config.js
module.exports = {
  setupFiles: ['<rootDir>/jest.setup.js'],
}

// jest.setup.js
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
```

### Test-Specific Variables

```bash
# .env.test
DATABASE_URL=postgresql://test:test@localhost:5432/testdb
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Common Issues

### Variables Not Updating

Environment variables are embedded at build time. Restart the dev server:

```bash
# Kill and restart
npm run dev
```

### Client-Side Variables Undefined

Ensure `NEXT_PUBLIC_` prefix:

```bash
# Wrong - won't work in browser
API_URL=https://api.example.com

# Correct - works in browser
NEXT_PUBLIC_API_URL=https://api.example.com
```

### Build-Time vs Runtime

Variables are embedded at build time. For runtime config:

```javascript
// Use runtime config (deprecated)
// Or fetch from API at runtime
// Or use server-side rendering
```

## Complete Example

```bash
# .env.local
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
REDIS_URL=redis://localhost:6379

# API Keys (server-side only)
STRIPE_SECRET_KEY=sk_test_xxx
SENDGRID_API_KEY=SG.xxx
OPENAI_API_KEY=sk-xxx

# Public Configuration (client-side)
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_CHAT=false

# App Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
```

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Validate required variables
  webpack: (config, { isServer }) => {
    if (isServer) {
      const required = ['DATABASE_URL', 'STRIPE_SECRET_KEY']
      required.forEach((key) => {
        if (!process.env[key]) {
          throw new Error(`Missing ${key} environment variable`)
        }
      })
    }
    return config
  },
}

module.exports = nextConfig
```

## Deployment Considerations

### Vercel

Environment variables configured in dashboard are automatically loaded.

### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

# Build args for build-time variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Runtime variables from .env or docker-compose
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
services:
  web:
    build:
      context: .
      args:
        NEXT_PUBLIC_API_URL: https://api.example.com
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - API_SECRET_KEY=${API_SECRET_KEY}
    env_file:
      - .env.production
```

### Self-Hosted

```bash
# Set environment variables before starting
export DATABASE_URL="postgresql://..."
export API_SECRET_KEY="secret"
npm start
```

Or use PM2:

```json
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'my-app',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    env_file: '.env.production',
  }],
}
```
