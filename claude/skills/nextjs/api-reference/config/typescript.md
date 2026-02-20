# TypeScript Configuration

Next.js provides built-in TypeScript support with zero configuration. Configure TypeScript-specific Next.js options in `next.config.js`.

## TypeScript in next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Dangerously allow production builds even with type errors
    ignoreBuildErrors: false,

    // Custom TypeScript config path
    tsconfigPath: './tsconfig.json',
  },
}

module.exports = nextConfig
```

## TypeScript Config Options

### ignoreBuildErrors

```javascript
const nextConfig = {
  typescript: {
    // Skip type checking during builds
    // WARNING: Use with caution!
    ignoreBuildErrors: true,
  },
}
```

**When to use:**
- Gradual TypeScript migration
- Temporary workaround during development
- CI/CD handles type checking separately

**Warning**: This can lead to runtime errors in production.

### tsconfigPath

```javascript
const nextConfig = {
  typescript: {
    // Use custom tsconfig location
    tsconfigPath: './custom-tsconfig.json',
  },
}
```

## TypeScript Configuration File (tsconfig.json)

Next.js automatically creates `tsconfig.json` with recommended settings:

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## Strict Type Checking

### Enable Strict Mode

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### Gradual Strict Mode Adoption

```json
{
  "compilerOptions": {
    "strict": false,
    // Enable one at a time
    "noImplicitAny": true,
    "strictNullChecks": false,
    // "strictFunctionTypes": false,
    // "strictBindCallApply": false,
  }
}
```

## Path Aliases

### Basic Aliases

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@components/*": ["components/*"],
      "@lib/*": ["lib/*"],
      "@utils/*": ["utils/*"]
    }
  }
}
```

Usage:

```typescript
import { Button } from '@components/Button'
import { api } from '@lib/api'
import { formatDate } from '@utils/date'
```

### Monorepo Aliases

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@myorg/shared": ["../../packages/shared/src"],
      "@myorg/ui": ["../../packages/ui/src"]
    }
  }
}
```

## Type Definitions

### Next.js Type Definitions

Next.js automatically includes type definitions:

```typescript
import type {
  NextPage,
  GetServerSideProps,
  GetStaticProps
} from 'next'
import type { AppProps } from 'next/app'
```

### Custom Type Definitions

Create `types` directory:

```typescript
// types/index.d.ts
declare module '*.svg' {
  import { FC, SVGProps } from 'react'
  const content: FC<SVGProps<SVGSVGElement>>
  export default content
}

declare module '*.md' {
  const content: string
  export default content
}
```

### Global Type Augmentation

```typescript
// types/global.d.ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string
      NEXT_PUBLIC_API_URL: string
      NODE_ENV: 'development' | 'production' | 'test'
    }
  }

  interface Window {
    gtag: (...args: any[]) => void
  }
}

export {}
```

## App Router Types

### Page Components

```typescript
// app/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Home',
  description: 'Home page',
}

export default function Page() {
  return <div>Home</div>
}
```

### Layout Components

```typescript
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My App',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

### Dynamic Routes

```typescript
// app/blog/[slug]/page.tsx
export default function BlogPost({
  params,
}: {
  params: { slug: string }
}) {
  return <div>Post: {params.slug}</div>
}
```

### Route Handlers

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({ users: [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  return NextResponse.json({ success: true })
}
```

## Pages Router Types

### Page Components

```typescript
// pages/index.tsx
import type { NextPage } from 'next'

const Home: NextPage = () => {
  return <div>Home</div>
}

export default Home
```

### getStaticProps

```typescript
import type { GetStaticProps, InferGetStaticPropsType } from 'next'

type Props = {
  posts: Post[]
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const posts = await getPosts()
  return {
    props: { posts },
  }
}

export default function Blog({
  posts,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return <div>{/* ... */}</div>
}
```

### getServerSideProps

```typescript
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'

type Props = {
  user: User
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const user = await getUser(context.params?.id)
  return {
    props: { user },
  }
}

export default function Profile({
  user,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return <div>{user.name}</div>
}
```

### API Routes

```typescript
// pages/api/users.ts
import type { NextApiRequest, NextApiResponse } from 'next'

type Data = {
  users: User[]
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const users = await getUsers()
  res.status(200).json({ users })
}
```

## Custom App Types

```typescript
// pages/_app.tsx
import type { AppProps } from 'next/app'

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
```

### With Custom Props

```typescript
import type { AppProps } from 'next/app'

type CustomAppProps = AppProps & {
  customProp: string
}

export default function App({ Component, pageProps, customProp }: CustomAppProps) {
  return <Component {...pageProps} />
}
```

## Middleware Types

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  response.headers.set('x-custom-header', 'value')
  return response
}

export const config = {
  matcher: '/api/:path*',
}
```

## Environment Variables Types

```typescript
// env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    // Server-side only
    DATABASE_URL: string
    API_SECRET_KEY: string

    // Client-side (NEXT_PUBLIC_*)
    NEXT_PUBLIC_API_URL: string
    NEXT_PUBLIC_GA_ID: string

    // Built-in
    NODE_ENV: 'development' | 'production' | 'test'
  }
}
```

Usage with validation:

```typescript
// lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_SECRET_KEY: z.string().min(32),
  NEXT_PUBLIC_API_URL: z.string().url(),
})

export const env = envSchema.parse(process.env)
```

## Incremental Type Checking

### Enable Incremental Compilation

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

Add to `.gitignore`:

```
.tsbuildinfo
```

## Type-Checking Scripts

### Package.json

```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "type-check:watch": "tsc --noEmit --watch",
    "build": "next build",
    "prebuild": "npm run type-check"
  }
}
```

### CI/CD Integration

```yaml
# .github/workflows/ci.yml
- name: Type check
  run: npm run type-check
```

## Common TypeScript Patterns

### Typed Components

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary'
  size?: 'small' | 'medium' | 'large'
  onClick?: () => void
  children: React.ReactNode
}

export function Button({
  variant,
  size = 'medium',
  onClick,
  children
}: ButtonProps) {
  return <button onClick={onClick}>{children}</button>
}
```

### Typed Context

```typescript
import { createContext, useContext, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
```

### Typed Hooks

```typescript
import { useState, useCallback } from 'react'

interface User {
  id: string
  name: string
  email: string
}

export function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchUser = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/users/${userId}`)
      const data: User = await response.json()
      setUser(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  return { user, loading, error, fetchUser }
}
```

## Best Practices

1. **Enable strict mode**: Catch more errors at compile time
2. **Use type imports**: `import type` for type-only imports
3. **Define interfaces**: Better than inline types
4. **Use unknown over any**: Safer type for unknown values
5. **Leverage inference**: Let TypeScript infer when possible
6. **Document complex types**: Add JSDoc comments
7. **Type environment variables**: Create env.d.ts
8. **Use path aliases**: Cleaner imports

## Common Issues

### Module Not Found

```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler", // or "node"
    "resolveJsonModule": true
  }
}
```

### Type Errors in node_modules

```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

### JSX Errors

```json
{
  "compilerOptions": {
    "jsx": "preserve"
  }
}
```

### Next.js Plugin Not Working

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [".next/types/**/*.ts"]
}
```

## TypeScript Config File (next.config.ts)

Next.js 15+ supports TypeScript config:

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['example.com'],
  },
}

export default config
```

## Performance Optimization

```json
{
  "compilerOptions": {
    // Faster type checking
    "skipLibCheck": true,

    // Incremental compilation
    "incremental": true,

    // Faster resolution
    "moduleResolution": "bundler"
  }
}
```

## Migration from JavaScript

```json
{
  "compilerOptions": {
    // Allow JS files
    "allowJs": true,

    // Check JS files
    "checkJs": false,

    // Gradual migration
    "strict": false,
    "noImplicitAny": false
  }
}
```
