# Environment Variables in Next.js

Complete guide to managing environment variables in Next.js applications, including runtime vs build-time variables, security best practices, and validation.

## Table of Contents

1. [Environment Variable Basics](#environment-variable-basics)
2. [Build-Time vs Runtime Variables](#build-time-vs-runtime-variables)
3. [NEXT_PUBLIC_ Prefix](#next_public_-prefix)
4. [Loading Environment Variables](#loading-environment-variables)
5. [Environment-Specific Configuration](#environment-specific-configuration)
6. [Validation and Type Safety](#validation-and-type-safety)
7. [Security Best Practices](#security-best-practices)
8. [Common Patterns](#common-patterns)

## Environment Variable Basics

### File Priority

Next.js loads environment variables in this order (higher priority first):

1. `process.env`
2. `.env.$(NODE_ENV).local`
3. `.env.local` (not loaded for test environment)
4. `.env.$(NODE_ENV)`
5. `.env`

### File Structure

```
.env                # Default values for all environments
.env.local          # Local overrides (gitignored)
.env.development    # Development environment
.env.production     # Production environment
.env.test           # Test environment
```

### .gitignore Configuration

```
# .gitignore
.env*.local
.env.production
```

## Build-Time vs Runtime Variables

### Build-Time Variables

Available during build process and inlined into JavaScript bundle:

```bash
# .env
DATABASE_URL=postgresql://localhost:5432/mydb
API_SECRET=my-secret-key
```

```typescript
// This is replaced at build time
const dbUrl = process.env.DATABASE_URL

// This value is inlined in the bundle
console.log(process.env.DATABASE_URL)
```

### Runtime Variables (Server-Side Only)

Available at runtime but only on the server:

```typescript
// app/api/users/route.ts
export async function GET() {
  // Available at runtime on the server
  const apiKey = process.env.API_SECRET

  const response = await fetch('https://api.example.com/users', {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })

  return Response.json(await response.json())
}
```

### Client-Side Variables

Exposed to the browser using `NEXT_PUBLIC_` prefix:

```bash
# .env
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_ANALYTICS_ID=GA-123456
```

```typescript
// Available in client components
'use client'

export default function Component() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  return <div>API URL: {apiUrl}</div>
}
```

## NEXT_PUBLIC_ Prefix

### When to Use NEXT_PUBLIC_

Use `NEXT_PUBLIC_` for variables that need to be accessible in the browser:

```bash
# .env
# ✅ Safe to expose
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_NAME=My App
NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIza...

# ❌ Never expose secrets
DATABASE_URL=postgresql://...
API_SECRET_KEY=secret123
STRIPE_SECRET_KEY=sk_test_...
```

### Client Component Example

```typescript
// components/ApiClient.tsx
'use client'

export default function ApiClient() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  const fetchData = async () => {
    const response = await fetch(`${apiUrl}/data`)
    return response.json()
  }

  return (
    <button onClick={fetchData}>
      Fetch from {apiUrl}
    </button>
  )
}
```

### Server Component Example

```typescript
// app/page.tsx
export default async function HomePage() {
  // Server-only variable
  const dbUrl = process.env.DATABASE_URL

  // Public variable (also works on server)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  const data = await fetchFromDatabase(dbUrl)

  return <div>{/* ... */}</div>
}
```

## Loading Environment Variables

### Default Behavior

Next.js automatically loads `.env*` files:

```bash
# .env
DATABASE_URL=postgresql://localhost:5432/mydb
NEXT_PUBLIC_API_URL=https://api.example.com
```

No additional configuration needed.

### Custom Environment Variable Loading

```javascript
// next.config.js
module.exports = {
  env: {
    // These are added to process.env
    CUSTOM_KEY: 'my-value',

    // Can reference other env vars
    API_URL: process.env.API_URL || 'https://api.example.com',
  },
}
```

### Loading from External Sources

```javascript
// next.config.js
const { loadEnvConfig } = require('@next/env')

const projectDir = process.cwd()
loadEnvConfig(projectDir)

module.exports = {
  env: {
    // Now you can access .env variables here
    DATABASE_URL: process.env.DATABASE_URL,
  },
}
```

## Environment-Specific Configuration

### Development Environment

```bash
# .env.development
DATABASE_URL=postgresql://localhost:5432/dev_db
NEXT_PUBLIC_API_URL=http://localhost:3001/api
DEBUG=true
```

### Production Environment

```bash
# .env.production
DATABASE_URL=postgresql://prod-server:5432/prod_db
NEXT_PUBLIC_API_URL=https://api.production.com
DEBUG=false
```

### Test Environment

```bash
# .env.test
DATABASE_URL=postgresql://localhost:5432/test_db
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Accessing Current Environment

```typescript
const isDev = process.env.NODE_ENV === 'development'
const isProd = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

if (isDev) {
  console.log('Running in development mode')
}
```

## Validation and Type Safety

### Using Zod for Validation

```typescript
// lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  // Server-side variables
  DATABASE_URL: z.string().url(),
  API_SECRET: z.string().min(32),
  NEXTAUTH_SECRET: z.string().min(32),

  // Client-side variables
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string(),

  // Optional variables
  REDIS_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']),
})

const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  API_SECRET: process.env.API_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  REDIS_URL: process.env.REDIS_URL,
  SENTRY_DSN: process.env.SENTRY_DSN,
  NODE_ENV: process.env.NODE_ENV,
})

export default env
```

### Usage with Type Safety

```typescript
// app/api/users/route.ts
import env from '@/lib/env'

export async function GET() {
  // TypeScript knows the exact type and validates at runtime
  const response = await fetch(env.NEXT_PUBLIC_API_URL, {
    headers: {
      'Authorization': `Bearer ${env.API_SECRET}`
    }
  })

  return Response.json(await response.json())
}
```

### T3 Env Pattern

```typescript
// env.mjs
import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    API_SECRET: process.env.API_SECRET,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
})
```

### Custom Validation Function

```typescript
// lib/validateEnv.ts
type EnvConfig = {
  [key: string]: {
    required?: boolean
    type?: 'string' | 'number' | 'boolean' | 'url'
    default?: any
  }
}

const envConfig: EnvConfig = {
  DATABASE_URL: { required: true, type: 'url' },
  API_SECRET: { required: true },
  NEXT_PUBLIC_API_URL: { required: true, type: 'url' },
  DEBUG: { type: 'boolean', default: false },
}

export function validateEnv() {
  const errors: string[] = []

  for (const [key, config] of Object.entries(envConfig)) {
    const value = process.env[key]

    if (config.required && !value) {
      errors.push(`Missing required environment variable: ${key}`)
      continue
    }

    if (value && config.type === 'url') {
      try {
        new URL(value)
      } catch {
        errors.push(`Invalid URL for ${key}: ${value}`)
      }
    }

    if (value && config.type === 'number' && isNaN(Number(value))) {
      errors.push(`${key} must be a number, got: ${value}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`)
  }
}

// Call on app startup
validateEnv()
```

## Security Best Practices

### 1. Never Commit Secrets

```bash
# .gitignore
.env*.local
.env.production
.env.development.local
```

### 2. Use Secret Management Services

```typescript
// lib/secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager"

export async function getSecret(secretName: string) {
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION,
  })

  const command = new GetSecretValueCommand({
    SecretId: secretName,
  })

  const response = await client.send(command)
  return JSON.parse(response.SecretString!)
}
```

### 3. Validate All Variables

```typescript
// lib/env.ts
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

if (!process.env.API_SECRET || process.env.API_SECRET.length < 32) {
  throw new Error('API_SECRET must be at least 32 characters')
}
```

### 4. Separate Client and Server Variables

```typescript
// lib/env-client.ts (client-safe variables)
export const clientEnv = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL!,
  appName: process.env.NEXT_PUBLIC_APP_NAME!,
}

// lib/env-server.ts (server-only variables)
import 'server-only'

export const serverEnv = {
  databaseUrl: process.env.DATABASE_URL!,
  apiSecret: process.env.API_SECRET!,
}
```

### 5. Mask Sensitive Data in Logs

```typescript
// lib/logger.ts
function maskSecret(value: string): string {
  if (value.length <= 8) return '***'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

export function logEnv() {
  console.log({
    DATABASE_URL: maskSecret(process.env.DATABASE_URL || ''),
    API_SECRET: maskSecret(process.env.API_SECRET || ''),
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL, // Safe to log
  })
}
```

## Common Patterns

### 1. Feature Flags

```bash
# .env
NEXT_PUBLIC_FEATURE_NEW_DASHBOARD=true
NEXT_PUBLIC_FEATURE_BETA_SEARCH=false
```

```typescript
// lib/features.ts
export const features = {
  newDashboard: process.env.NEXT_PUBLIC_FEATURE_NEW_DASHBOARD === 'true',
  betaSearch: process.env.NEXT_PUBLIC_FEATURE_BETA_SEARCH === 'true',
}

// Usage
import { features } from '@/lib/features'

export default function Page() {
  return (
    <div>
      {features.newDashboard ? <NewDashboard /> : <OldDashboard />}
    </div>
  )
}
```

### 2. Multi-Tenant Configuration

```bash
# .env
TENANT_ID=acme
DATABASE_URL=postgresql://localhost:5432/${TENANT_ID}_db
```

```typescript
// lib/tenant.ts
export function getTenantConfig() {
  const tenantId = process.env.TENANT_ID
  const dbUrl = process.env.DATABASE_URL?.replace('${TENANT_ID}', tenantId!)

  return {
    tenantId,
    databaseUrl: dbUrl,
  }
}
```

### 3. API Configuration

```bash
# .env
API_BASE_URL=https://api.example.com
API_VERSION=v1
API_TIMEOUT=30000
```

```typescript
// lib/api-config.ts
export const apiConfig = {
  baseUrl: process.env.API_BASE_URL!,
  version: process.env.API_VERSION || 'v1',
  timeout: parseInt(process.env.API_TIMEOUT || '30000'),

  get fullUrl() {
    return `${this.baseUrl}/${this.version}`
  },
}

// Usage
import { apiConfig } from '@/lib/api-config'

const response = await fetch(`${apiConfig.fullUrl}/users`, {
  signal: AbortSignal.timeout(apiConfig.timeout),
})
```

### 4. Database Connection Pool

```bash
# .env
DATABASE_URL=postgresql://localhost:5432/mydb
DB_POOL_MIN=2
DB_POOL_MAX=10
```

```typescript
// lib/db.ts
import { Pool } from 'pg'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  max: parseInt(process.env.DB_POOL_MAX || '10'),
})
```

### 5. Conditional Configuration

```typescript
// lib/config.ts
const config = {
  database: {
    url: process.env.DATABASE_URL!,
    ssl: process.env.NODE_ENV === 'production',
  },
  api: {
    url: process.env.NODE_ENV === 'production'
      ? 'https://api.production.com'
      : 'http://localhost:3001',
  },
  redis: {
    url: process.env.REDIS_URL || null,
    enabled: !!process.env.REDIS_URL,
  },
}

export default config
```

### 6. Runtime Configuration

For variables that need to change without rebuilding:

```typescript
// public/config.js
window.__ENV__ = {
  API_URL: 'https://api.example.com',
  FEATURE_FLAGS: {
    newUI: true,
  },
}
```

```typescript
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script src="/config.js" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

```typescript
// hooks/useRuntimeConfig.ts
export function useRuntimeConfig() {
  if (typeof window === 'undefined') {
    return null
  }

  return (window as any).__ENV__
}
```

## Testing with Environment Variables

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
}
```

```javascript
// jest.setup.js
process.env = {
  ...process.env,
  DATABASE_URL: 'postgresql://localhost:5432/test_db',
  NEXT_PUBLIC_API_URL: 'http://localhost:3001',
  API_SECRET: 'test-secret-key-32-characters-long',
}
```

### Test-Specific Variables

```bash
# .env.test
DATABASE_URL=postgresql://localhost:5432/test_db
NEXT_PUBLIC_API_URL=http://localhost:3001
API_SECRET=test-secret-key-32-characters-long
```

## Debugging Environment Variables

### Check Loaded Variables

```typescript
// app/api/debug/env/route.ts
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return Response.json({ error: 'Not available in production' }, { status: 403 })
  }

  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    publicVars: Object.keys(process.env)
      .filter(key => key.startsWith('NEXT_PUBLIC_'))
      .reduce((acc, key) => ({
        ...acc,
        [key]: process.env[key],
      }), {}),
    hasDatabase: !!process.env.DATABASE_URL,
    hasApiSecret: !!process.env.API_SECRET,
  }

  return Response.json(envVars)
}
```

### Build-Time Verification

```typescript
// scripts/check-env.ts
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

const myEnv = config()
expand(myEnv)

const required = [
  'DATABASE_URL',
  'API_SECRET',
  'NEXT_PUBLIC_API_URL',
]

const missing = required.filter(key => !process.env[key])

if (missing.length > 0) {
  console.error('Missing required environment variables:')
  missing.forEach(key => console.error(`  - ${key}`))
  process.exit(1)
}

console.log('✓ All required environment variables are set')
```

```json
// package.json
{
  "scripts": {
    "check-env": "tsx scripts/check-env.ts",
    "build": "npm run check-env && next build"
  }
}
```

## Common Pitfalls

1. **Exposing secrets with NEXT_PUBLIC_**: Never use for API keys or secrets
2. **Accessing client variables on server**: Remember to use NEXT_PUBLIC_
3. **Not validating required variables**: Always validate on startup
4. **Hardcoding values**: Use environment variables for all config
5. **Committing .env files**: Add to .gitignore
6. **Missing .env.example**: Document required variables
7. **Not using type safety**: Implement runtime validation
8. **Forgetting to restart dev server**: Changes require restart

## .env.example Template

```bash
# .env.example
# Copy to .env.local and fill in values

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# API Keys (NEVER commit actual values)
API_SECRET=your-secret-key-here-min-32-chars
NEXTAUTH_SECRET=your-nextauth-secret-here

# Public Variables (exposed to browser)
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_NAME=My App
NEXT_PUBLIC_ANALYTICS_ID=

# Optional
REDIS_URL=
SENTRY_DSN=
```

## Resources

- [Next.js Environment Variables Documentation](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [dotenv Documentation](https://github.com/motdotla/dotenv)
- [Zod Documentation](https://zod.dev/)
- [T3 Env](https://env.t3.gg/)
