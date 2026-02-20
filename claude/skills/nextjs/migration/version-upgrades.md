# Upgrading Between Next.js Versions

This guide covers upgrading between major Next.js versions: 13 → 14 → 15 → 16.

## General Upgrade Process

For any version upgrade:

1. **Check the Release Notes**: Review breaking changes and new features
2. **Update Dependencies**: Upgrade Next.js and related packages
3. **Run Codemods**: Use automated migration tools when available
4. **Test Thoroughly**: Verify your application works correctly
5. **Update Code**: Make necessary code changes for breaking changes

## Quick Upgrade Commands

### Using npm
```bash
npm install next@latest react@latest react-dom@latest
```

### Using yarn
```bash
yarn add next@latest react@latest react-dom@latest
```

### Using pnpm
```bash
pnpm add next@latest react@latest react-dom@latest
```

## Upgrading to Next.js 16

> Note: Next.js 16 is hypothetical as of the knowledge cutoff. This section provides a template for future upgrades.

### Prerequisites
- Node.js 18.18 or later
- Next.js 15.x

### Upgrade Steps

```bash
npm install next@16 react@latest react-dom@latest
```

### Expected Changes (Template)

When Next.js 16 is released, check for:

1. **Breaking Changes**: Review the official migration guide
2. **Deprecated Features**: Check for deprecation warnings
3. **New Features**: Explore new capabilities
4. **Configuration Changes**: Update `next.config.js` if needed

## Upgrading to Next.js 15

### Prerequisites
- Node.js 18.18 or later
- React 18.2.0 or later
- Next.js 14.x (recommended to upgrade incrementally)

### Major Changes in Next.js 15

1. **Stable React 19 Support**: Full support for React 19
2. **Turbopack Stable**: Turbopack for local development is now stable
3. **Enhanced Caching**: Improved caching strategies
4. **Server Actions Improvements**: Better form handling and mutations
5. **Partial Prerendering (PPR)**: Experimental feature for hybrid rendering

### Upgrade Steps

```bash
npm install next@15 react@latest react-dom@latest
```

### Breaking Changes

#### 1. Minimum Node.js Version

**Before**: Node.js 16.x supported
**After**: Node.js 18.18 or later required

**Action**: Upgrade Node.js
```bash
nvm install 18.18
nvm use 18.18
```

#### 2. fetch() Caching Changes

**Before (Next.js 14)**: `fetch()` cached by default
**After (Next.js 15)**: `fetch()` no longer cached by default

**Migration**:
```typescript
// Before (Next.js 14) - automatically cached
const data = await fetch('https://api.example.com/data')

// After (Next.js 15) - explicit caching
const data = await fetch('https://api.example.com/data', {
  cache: 'force-cache' // Opt into caching
})

// Or use next.revalidate
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 3600 }
})
```

#### 3. Route Handlers Default to Dynamic

**Before**: GET requests cached by default
**After**: GET requests are dynamic by default

**Migration**:
```typescript
// app/api/data/route.ts

// To cache responses, add segment config
export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  // This will now be cached
  return Response.json({ data: '...' })
}
```

#### 4. Async Request APIs

Some Next.js APIs are now async:

**Before (Next.js 14)**:
```typescript
import { cookies, headers } from 'next/headers'

export default function Page() {
  const cookieStore = cookies()
  const headersList = headers()

  const theme = cookieStore.get('theme')
  const userAgent = headersList.get('user-agent')
}
```

**After (Next.js 15)**:
```typescript
import { cookies, headers } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const headersList = await headers()

  const theme = cookieStore.get('theme')
  const userAgent = headersList.get('user-agent')
}
```

### New Features in Next.js 15

#### 1. Turbopack for Development (Stable)

Enable in `next.config.js`:
```javascript
module.exports = {
  // Turbopack is now the default in dev
  // No configuration needed
}
```

Or use CLI flag:
```bash
next dev --turbo
```

#### 2. Enhanced Server Actions

Better error handling and validation:
```typescript
'use server'

import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
})

export async function createUser(formData: FormData) {
  const validatedFields = schema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  // Process validated data
  const user = await db.user.create(validatedFields.data)
  return { success: true, user }
}
```

#### 3. Partial Prerendering (Experimental)

Enable in `next.config.js`:
```javascript
module.exports = {
  experimental: {
    ppr: true,
  },
}
```

Usage:
```typescript
export const experimental_ppr = true

export default async function Page() {
  return (
    <div>
      <h1>Static Shell</h1>
      <Suspense fallback={<Loading />}>
        <DynamicContent />
      </Suspense>
    </div>
  )
}
```

## Upgrading to Next.js 14

### Prerequisites
- Node.js 18.17 or later
- Next.js 13.x

### Major Changes in Next.js 14

1. **Turbopack Beta**: 5x faster local dev iteration
2. **Server Actions (Stable)**: Form mutations without API routes
3. **Partial Prerendering (Preview)**: Experimental hybrid rendering
4. **Metadata Improvements**: Enhanced SEO capabilities

### Upgrade Steps

```bash
npm install next@14 react@latest react-dom@latest
```

### Breaking Changes

#### 1. Minimum Node.js Version

**Before**: Node.js 16.14 supported
**After**: Node.js 18.17 or later required

#### 2. ImageResponse Imports

**Before (Next.js 13)**:
```typescript
import { ImageResponse } from 'next/server'
```

**After (Next.js 14)**:
```typescript
import { ImageResponse } from 'next/og'
```

#### 3. next/image Improvements

Better defaults for image optimization:

```typescript
import Image from 'next/image'

// Now has better default sizing behavior
<Image
  src="/photo.jpg"
  alt="Photo"
  width={500}
  height={300}
  // sizes is automatically calculated for responsive images
/>
```

### New Features in Next.js 14

#### 1. Server Actions (Stable)

```typescript
// app/actions.ts
'use server'

export async function createTodo(formData: FormData) {
  const todo = await db.todo.create({
    data: {
      title: formData.get('title') as string,
    },
  })

  revalidatePath('/todos')
  return todo
}
```

```typescript
// app/todos/page.tsx
import { createTodo } from '../actions'

export default function TodosPage() {
  return (
    <form action={createTodo}>
      <input name="title" required />
      <button type="submit">Add Todo</button>
    </form>
  )
}
```

#### 2. Turbopack (Beta)

```bash
# Enable Turbopack for dev
next dev --turbo
```

Or in `package.json`:
```json
{
  "scripts": {
    "dev": "next dev --turbo"
  }
}
```

## Upgrading to Next.js 13

### Prerequisites
- Node.js 16.14 or later
- Next.js 12.x

### Major Changes in Next.js 13

1. **App Router**: New routing system with React Server Components
2. **Turbopack (Alpha)**: Rust-based bundler
3. **New Metadata API**: Better SEO handling
4. **Server Components**: Default to server rendering
5. **Font Optimization**: `next/font` for automatic font optimization

### Upgrade Steps

```bash
npm install next@13 react@latest react-dom@latest
```

### Breaking Changes

#### 1. Minimum Versions

- Node.js 16.14 or later
- React 18.2.0 or later

#### 2. next/image Changes

**Before (Next.js 12)**:
```typescript
import Image from 'next/image'

<Image src="/photo.jpg" layout="fill" objectFit="cover" />
```

**After (Next.js 13)**:
```typescript
import Image from 'next/image'

<Image src="/photo.jpg" fill style={{ objectFit: 'cover' }} />
```

#### 3. Link Component Changes

**Before (Next.js 12)**:
```typescript
import Link from 'next/link'

<Link href="/about">
  <a>About</a>
</Link>
```

**After (Next.js 13)**:
```typescript
import Link from 'next/link'

<Link href="/about">
  About
</Link>
```

### New Features in Next.js 13

#### 1. App Router (Optional)

Create `app/` directory alongside `pages/`:

```
my-app/
├── app/          # New App Router
│   ├── layout.tsx
│   └── page.tsx
└── pages/        # Existing Pages Router
    └── index.tsx
```

#### 2. Server Components

```typescript
// app/page.tsx - Default Server Component
export default async function Page() {
  const data = await fetch('https://api.example.com/data')
  const json = await data.json()

  return <div>{json.message}</div>
}
```

#### 3. Font Optimization

```typescript
import { Inter, Roboto_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

#### 4. Metadata API

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Page',
  description: 'Page description',
}
```

## Version-Specific Codemod Usage

Next.js provides codemods for automated migrations:

### Next.js 13 → 14
```bash
npx @next/codemod@latest upgrade/14 .
```

### Next.js 12 → 13
```bash
# Upgrade Image imports
npx @next/codemod@latest next-image-to-legacy-image .

# Upgrade Link components
npx @next/codemod@latest new-link .

# Migrate to App Router
npx @next/codemod@latest app-router-migration .
```

## Common Issues and Solutions

### Issue 1: Build Errors After Upgrade

**Solution**: Clear Next.js cache
```bash
rm -rf .next
npm run build
```

### Issue 2: Type Errors

**Solution**: Update TypeScript and type definitions
```bash
npm install --save-dev @types/react@latest @types/react-dom@latest @types/node@latest
```

### Issue 3: Environment Variables Not Working

**Solution**: Check prefix requirements
- Pages Router: Can use any prefix
- App Router: Client-side vars need `NEXT_PUBLIC_` prefix

### Issue 4: Hydration Errors After Upgrade

**Solution**: Check for client/server mismatches
```typescript
'use client'

import { useState, useEffect } from 'react'

export default function Component() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null // or loading state
  }

  // Client-only code here
  return <div>{/* ... */}</div>
}
```

### Issue 5: Performance Regression

**Solution**: Check caching configuration
```typescript
// Ensure proper caching for fetch requests
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 3600 }
})
```

## Testing After Upgrade

### 1. Development Build
```bash
npm run dev
# Test all pages and features
```

### 2. Production Build
```bash
npm run build
npm start
# Test production-specific features
```

### 3. Check Bundle Size
```bash
npm run build
# Review .next/analyze output
```

### 4. Run Tests
```bash
npm test
# or
npm run test:e2e
```

### 5. Performance Testing
- Use Lighthouse
- Check Core Web Vitals
- Monitor bundle sizes

## Best Practices for Upgrades

1. **Incremental Upgrades**: Don't skip major versions
   - 12 → 13 → 14 → 15 (not 12 → 15)

2. **Read Release Notes**: Always review before upgrading
   - [Next.js Releases](https://github.com/vercel/next.js/releases)

3. **Use Version Control**: Create a branch for upgrades
   ```bash
   git checkout -b upgrade-nextjs-15
   ```

4. **Test in Staging**: Deploy to staging before production

5. **Monitor After Deployment**: Watch for errors and performance issues

6. **Keep Dependencies Updated**: Update related packages
   ```bash
   npm outdated
   npm update
   ```

## Deprecation Warnings

Pay attention to deprecation warnings in the console:

```typescript
// If you see: "Warning: Feature X is deprecated"
// Check the migration guide for the replacement

// Example: Old API
const data = oldApi.getData()

// New API
const data = newApi.getData()
```

## Rollback Strategy

If upgrade causes issues:

1. **Using Git**:
```bash
git checkout main
npm install
```

2. **Using npm**:
```bash
npm install next@13.0.0 react@18.2.0 react-dom@18.2.0
```

3. **Clear cache**:
```bash
rm -rf .next node_modules package-lock.json
npm install
```

## Additional Resources

- [Next.js Upgrade Guide](https://nextjs.org/docs/upgrading)
- [Next.js GitHub Releases](https://github.com/vercel/next.js/releases)
- [Next.js Blog](https://nextjs.org/blog)
- [Vercel Discussions](https://github.com/vercel/next.js/discussions)
- [Codemods Documentation](https://nextjs.org/docs/app/building-your-application/upgrading/codemods)

## Version Support Timeline

| Version | Release Date | Support Status |
|---------|-------------|----------------|
| 15.x    | 2024        | Current        |
| 14.x    | 2023        | Supported      |
| 13.x    | 2022        | Maintenance    |
| 12.x    | 2021        | Limited        |
| < 12    | Earlier     | Unsupported    |

Always aim to be on the latest stable version for security and performance benefits.
