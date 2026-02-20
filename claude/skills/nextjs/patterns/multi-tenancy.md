# Multi-Tenancy in Next.js

Complete guide to implementing multi-tenant architecture in Next.js applications, including subdomain routing, tenant isolation, database strategies, and data separation.

## Table of Contents

1. [Multi-Tenancy Patterns](#multi-tenancy-patterns)
2. [Subdomain Routing](#subdomain-routing)
3. [Path-Based Tenancy](#path-based-tenancy)
4. [Database Strategies](#database-strategies)
5. [Tenant Context](#tenant-context)
6. [Middleware for Tenant Resolution](#middleware-for-tenant-resolution)
7. [Data Isolation](#data-isolation)
8. [Best Practices](#best-practices)

## Multi-Tenancy Patterns

### 1. Subdomain-Based (Recommended for SaaS)
- `acme.yourapp.com`
- `widgets.yourapp.com`
- Best for branding and isolation

### 2. Path-Based
- `yourapp.com/acme`
- `yourapp.com/widgets`
- Simpler DNS setup

### 3. Header-Based
- Uses custom headers for tenant identification
- Good for APIs

### 4. Hybrid
- Combination of approaches
- Maximum flexibility

## Subdomain Routing

### DNS Configuration

For development, add to `/etc/hosts`:
```
127.0.0.1 tenant1.localhost
127.0.0.1 tenant2.localhost
127.0.0.1 app.localhost
```

### Next.js Configuration

```javascript
// next.config.js
module.exports = {
  async rewrites() {
    return {
      beforeFiles: [
        // Rewrite subdomains to dynamic routes
        {
          source: '/:path*',
          has: [
            {
              type: 'host',
              value: '(?<tenant>.*)\\.localhost:3000',
            },
          ],
          destination: '/tenants/:tenant/:path*',
        },
      ],
    }
  },
}
```

### Middleware for Subdomain Detection

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl

  // Extract tenant from subdomain
  const tenant = extractTenant(hostname)

  // Skip for main domain or www
  if (!tenant || tenant === 'www' || tenant === 'app') {
    return NextResponse.next()
  }

  // Validate tenant exists
  const tenantExists = await validateTenant(tenant)
  if (!tenantExists) {
    return NextResponse.redirect(new URL('/404', request.url))
  }

  // Add tenant to headers for use in app
  const response = NextResponse.next()
  response.headers.set('x-tenant-id', tenant)

  return response
}

function extractTenant(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0]

  // For subdomain.domain.com, extract 'subdomain'
  const parts = host.split('.')

  if (parts.length >= 3) {
    // subdomain.domain.com or subdomain.domain.co.uk
    return parts[0]
  }

  if (parts.length === 2 && parts[0] !== 'localhost') {
    // Custom domain: acme.com -> acme
    return parts[0]
  }

  return null
}

async function validateTenant(tenant: string): Promise<boolean> {
  // Check if tenant exists in database
  // This should be cached for performance
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/tenants/${tenant}/validate`
    )
    return response.ok
  } catch {
    return false
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### App Router with Subdomains

```typescript
// app/layout.tsx
import { headers } from 'next/headers'
import { getTenant } from '@/lib/tenants'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = headers()
  const tenantId = headersList.get('x-tenant-id')

  const tenant = tenantId ? await getTenant(tenantId) : null

  return (
    <html lang="en">
      <head>
        {tenant && (
          <>
            <title>{tenant.name}</title>
            <link rel="icon" href={tenant.favicon} />
            <style dangerouslySetInnerHTML={{
              __html: `
                :root {
                  --primary-color: ${tenant.primaryColor};
                  --secondary-color: ${tenant.secondaryColor};
                }
              `
            }} />
          </>
        )}
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Tenant Data Fetching

```typescript
// lib/tenants.ts
import { prisma } from '@/lib/db'

export interface Tenant {
  id: string
  slug: string
  name: string
  domain?: string
  favicon?: string
  logo?: string
  primaryColor: string
  secondaryColor: string
  settings: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export async function getTenant(
  identifier: string
): Promise<Tenant | null> {
  return await prisma.tenant.findFirst({
    where: {
      OR: [
        { slug: identifier },
        { domain: identifier },
      ],
    },
  })
}

export async function getTenantByDomain(
  domain: string
): Promise<Tenant | null> {
  return await prisma.tenant.findUnique({
    where: { domain },
  })
}
```

## Path-Based Tenancy

### Route Structure

```
app/
├── [tenant]/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
└── api/
    └── [tenant]/
        └── route.ts
```

### Dynamic Tenant Layout

```typescript
// app/[tenant]/layout.tsx
import { getTenant } from '@/lib/tenants'
import { notFound } from 'next/navigation'
import { TenantProvider } from '@/components/TenantProvider'

export async function generateStaticParams() {
  const tenants = await prisma.tenant.findMany({
    select: { slug: true },
  })

  return tenants.map((tenant) => ({
    tenant: tenant.slug,
  }))
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { tenant: string }
}) {
  const tenant = await getTenant(params.tenant)

  if (!tenant) {
    notFound()
  }

  return (
    <TenantProvider tenant={tenant}>
      <div className="tenant-wrapper" data-tenant={tenant.slug}>
        {children}
      </div>
    </TenantProvider>
  )
}
```

### Tenant Context

```typescript
// components/TenantProvider.tsx
'use client'

import { createContext, useContext } from 'react'
import { Tenant } from '@/lib/tenants'

const TenantContext = createContext<Tenant | null>(null)

export function TenantProvider({
  tenant,
  children,
}: {
  tenant: Tenant
  children: React.ReactNode
}) {
  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider')
  }
  return context
}
```

### Usage in Components

```typescript
// components/TenantDashboard.tsx
'use client'

import { useTenant } from '@/components/TenantProvider'

export default function TenantDashboard() {
  const tenant = useTenant()

  return (
    <div>
      <h1>Welcome to {tenant.name}</h1>
      <p>Tenant ID: {tenant.id}</p>
      <div style={{ color: tenant.primaryColor }}>
        Branded content
      </div>
    </div>
  )
}
```

## Database Strategies

### 1. Shared Database with Tenant Column (Recommended)

```prisma
// prisma/schema.prisma
model Tenant {
  id            String   @id @default(cuid())
  slug          String   @unique
  name          String
  domain        String?  @unique
  primaryColor  String   @default("#3b82f6")
  secondaryColor String  @default("#8b5cf6")
  settings      Json     @default("{}")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  users         User[]
  posts         Post[]
}

model User {
  id        String   @id @default(cuid())
  email     String
  name      String?
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([email, tenantId])
  @@index([tenantId])
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([tenantId])
}
```

### 2. Database Per Tenant

```typescript
// lib/db-connections.ts
import { PrismaClient } from '@prisma/client'

const connections = new Map<string, PrismaClient>()

export function getTenantDb(tenantId: string): PrismaClient {
  if (connections.has(tenantId)) {
    return connections.get(tenantId)!
  }

  const dbUrl = `${process.env.DATABASE_URL_PREFIX}${tenantId}${process.env.DATABASE_URL_SUFFIX}`

  const client = new PrismaClient({
    datasources: {
      db: { url: dbUrl },
    },
  })

  connections.set(tenantId, client)
  return client
}

export async function disconnectTenantDb(tenantId: string) {
  const client = connections.get(tenantId)
  if (client) {
    await client.$disconnect()
    connections.delete(tenantId)
  }
}
```

### 3. Schema Per Tenant (PostgreSQL)

```typescript
// lib/tenant-schema.ts
import { PrismaClient } from '@prisma/client'

export async function getTenantPrisma(tenantId: string) {
  const prisma = new PrismaClient()

  // Set the schema search path for this connection
  await prisma.$executeRawUnsafe(`SET search_path TO "tenant_${tenantId}"`)

  return prisma
}

export async function createTenantSchema(tenantId: string) {
  const prisma = new PrismaClient()

  await prisma.$executeRawUnsafe(
    `CREATE SCHEMA IF NOT EXISTS "tenant_${tenantId}"`
  )

  // Run migrations for the new schema
  // This requires custom migration handling
}
```

## Middleware for Tenant Resolution

### Advanced Middleware with Caching

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
const TENANT_CACHE_TTL = 3600 // 1 hour

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const tenant = extractTenant(hostname)

  if (!tenant) {
    return NextResponse.next()
  }

  // Try to get tenant from cache
  let tenantData = await redis.get(`tenant:${tenant}`)

  if (!tenantData) {
    // Fetch from database
    const response = await fetch(
      `${process.env.API_URL}/api/tenants/${tenant}`,
      {
        headers: {
          'x-api-key': process.env.INTERNAL_API_KEY!,
        },
      }
    )

    if (!response.ok) {
      return NextResponse.redirect(new URL('/404', request.url))
    }

    tenantData = await response.json()

    // Cache the result
    await redis.setex(
      `tenant:${tenant}`,
      TENANT_CACHE_TTL,
      JSON.stringify(tenantData)
    )
  }

  // Add tenant data to headers
  const response = NextResponse.next()
  response.headers.set('x-tenant-id', tenantData.id)
  response.headers.set('x-tenant-slug', tenant)
  response.headers.set('x-tenant-data', JSON.stringify(tenantData))

  return response
}

function extractTenant(hostname: string): string | null {
  const host = hostname.split(':')[0]
  const parts = host.split('.')

  if (parts.length >= 3) {
    return parts[0]
  }

  return null
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

## Data Isolation

### Row-Level Security Query Wrapper

```typescript
// lib/tenant-query.ts
import { prisma } from '@/lib/db'
import { headers } from 'next/headers'

export function getTenantId(): string {
  const headersList = headers()
  const tenantId = headersList.get('x-tenant-id')

  if (!tenantId) {
    throw new Error('Tenant ID not found in request headers')
  }

  return tenantId
}

export const tenantDb = {
  user: {
    findMany: (args: any = {}) => {
      const tenantId = getTenantId()
      return prisma.user.findMany({
        ...args,
        where: {
          ...args.where,
          tenantId,
        },
      })
    },
    findUnique: (args: any) => {
      const tenantId = getTenantId()
      return prisma.user.findFirst({
        ...args,
        where: {
          ...args.where,
          tenantId,
        },
      })
    },
    create: (args: any) => {
      const tenantId = getTenantId()
      return prisma.user.create({
        ...args,
        data: {
          ...args.data,
          tenantId,
        },
      })
    },
    update: (args: any) => {
      const tenantId = getTenantId()
      return prisma.user.updateMany({
        ...args,
        where: {
          ...args.where,
          tenantId,
        },
      })
    },
    delete: (args: any) => {
      const tenantId = getTenantId()
      return prisma.user.deleteMany({
        ...args,
        where: {
          ...args.where,
          tenantId,
        },
      })
    },
  },
  // Repeat for other models...
}
```

### Prisma Middleware for Automatic Filtering

```typescript
// lib/prisma-tenant-middleware.ts
import { Prisma } from '@prisma/client'

export function createTenantMiddleware(tenantId: string) {
  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<any>
  ) => {
    const modelsWithTenant = ['User', 'Post', 'Comment']

    if (modelsWithTenant.includes(params.model || '')) {
      if (params.action === 'create') {
        params.args.data = {
          ...params.args.data,
          tenantId,
        }
      }

      if (
        params.action === 'findUnique' ||
        params.action === 'findFirst' ||
        params.action === 'findMany' ||
        params.action === 'update' ||
        params.action === 'updateMany' ||
        params.action === 'delete' ||
        params.action === 'deleteMany'
      ) {
        params.args.where = {
          ...params.args.where,
          tenantId,
        }
      }
    }

    return next(params)
  }
}

// Usage
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
prisma.$use(createTenantMiddleware('tenant-id-here'))
```

## API Routes with Multi-Tenancy

### Tenant-Aware API Route

```typescript
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id')

  if (!tenantId) {
    return NextResponse.json(
      { error: 'Tenant not found' },
      { status: 400 }
    )
  }

  const posts = await prisma.post.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(posts)
}

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id')

  if (!tenantId) {
    return NextResponse.json(
      { error: 'Tenant not found' },
      { status: 400 }
    )
  }

  const body = await request.json()

  const post = await prisma.post.create({
    data: {
      ...body,
      tenantId,
    },
  })

  return NextResponse.json(post)
}
```

## Custom Domains

### Database Schema

```prisma
model Tenant {
  id            String   @id @default(cuid())
  slug          String   @unique
  name          String
  customDomain  String?  @unique
  verified      Boolean  @default(false)
  // ... other fields
}
```

### Domain Verification

```typescript
// app/api/tenants/verify-domain/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { tenantId, domain } = await request.json()

  // Check DNS records
  const txtRecords = await fetch(
    `https://dns.google/resolve?name=_acme-challenge.${domain}&type=TXT`
  ).then((r) => r.json())

  const expectedValue = `tenant-verify=${tenantId}`
  const verified = txtRecords.Answer?.some(
    (record: any) => record.data.includes(expectedValue)
  )

  if (verified) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        customDomain: domain,
        verified: true,
      },
    })
  }

  return NextResponse.json({ verified })
}
```

### Vercel Custom Domains API

```typescript
// lib/vercel-domains.ts
export async function addDomain(domain: string) {
  const response = await fetch(
    `https://api.vercel.com/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    }
  )

  return response.json()
}

export async function removeDomain(domain: string) {
  const response = await fetch(
    `https://api.vercel.com/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${domain}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      },
    }
  )

  return response.json()
}

export async function getDomainConfig(domain: string) {
  const response = await fetch(
    `https://api.vercel.com/v6/domains/${domain}/config`,
    {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      },
    }
  )

  return response.json()
}
```

## Best Practices

### 1. Tenant Isolation Testing

```typescript
// __tests__/tenant-isolation.test.ts
import { prisma } from '@/lib/db'

describe('Tenant Isolation', () => {
  it('should not allow cross-tenant data access', async () => {
    const tenant1 = await prisma.tenant.create({
      data: { slug: 'tenant1', name: 'Tenant 1' },
    })

    const tenant2 = await prisma.tenant.create({
      data: { slug: 'tenant2', name: 'Tenant 2' },
    })

    const user1 = await prisma.user.create({
      data: {
        email: 'user@tenant1.com',
        name: 'User 1',
        tenantId: tenant1.id,
      },
    })

    // Try to fetch user1 with tenant2's context
    const result = await prisma.user.findFirst({
      where: {
        id: user1.id,
        tenantId: tenant2.id,
      },
    })

    expect(result).toBeNull()
  })
})
```

### 2. Performance Optimization

```typescript
// lib/tenant-cache.ts
import { LRUCache } from 'lru-cache'

const tenantCache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour
})

export async function getCachedTenant(identifier: string) {
  const cached = tenantCache.get(identifier)
  if (cached) return cached

  const tenant = await getTenant(identifier)
  if (tenant) {
    tenantCache.set(identifier, tenant)
  }

  return tenant
}
```

### 3. Tenant Onboarding

```typescript
// app/api/tenants/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { name, slug, email } = await request.json()

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      primaryColor: '#3b82f6',
      secondaryColor: '#8b5cf6',
      settings: {
        features: {
          analytics: true,
          customBranding: false,
        },
      },
    },
  })

  // Create admin user for the tenant
  const adminUser = await prisma.user.create({
    data: {
      email,
      name: 'Admin',
      role: 'admin',
      tenantId: tenant.id,
    },
  })

  // Create default data (e.g., sample content, settings)
  await seedTenantData(tenant.id)

  return NextResponse.json({ tenant, adminUser })
}

async function seedTenantData(tenantId: string) {
  // Create default categories, settings, etc.
  await prisma.category.createMany({
    data: [
      { name: 'General', tenantId },
      { name: 'Updates', tenantId },
    ],
  })
}
```

### 4. Monitoring and Analytics

```typescript
// lib/tenant-analytics.ts
export async function trackTenantMetric(
  tenantId: string,
  metric: string,
  value: number
) {
  await prisma.metric.create({
    data: {
      tenantId,
      name: metric,
      value,
      timestamp: new Date(),
    },
  })
}

export async function getTenantUsage(tenantId: string) {
  const [userCount, postCount, storageUsed] = await Promise.all([
    prisma.user.count({ where: { tenantId } }),
    prisma.post.count({ where: { tenantId } }),
    prisma.file.aggregate({
      where: { tenantId },
      _sum: { size: true },
    }),
  ])

  return {
    users: userCount,
    posts: postCount,
    storage: storageUsed._sum.size || 0,
  }
}
```

## Common Pitfalls

1. **Missing tenant ID in queries**: Always filter by tenantId
2. **Hard-coded tenant references**: Use context/headers
3. **Cache invalidation**: Clear tenant cache on updates
4. **Cross-tenant data leaks**: Test isolation thoroughly
5. **Performance issues**: Index tenantId columns
6. **DNS propagation**: Handle custom domain delays
7. **Session sharing**: Ensure sessions are tenant-specific
8. **File storage**: Separate tenant files properly

## Resources

- [Multi-Tenant Architecture Patterns](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/overview)
- [Vercel Multi-Tenant Guide](https://vercel.com/guides/nextjs-multi-tenant-application)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
