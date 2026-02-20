# Authentication Patterns in Next.js

Complete guide to implementing authentication in Next.js applications using NextAuth.js, custom solutions, and middleware-based protection.

## Table of Contents

1. [NextAuth.js Setup](#nextauthjs-setup)
2. [Session Management](#session-management)
3. [Middleware Protection](#middleware-protection)
4. [Custom Authentication](#custom-authentication)
5. [OAuth Providers](#oauth-providers)
6. [JWT vs Database Sessions](#jwt-vs-database-sessions)
7. [Role-Based Access Control](#role-based-access-control)
8. [Best Practices](#best-practices)

## NextAuth.js Setup

### Installation

```bash
npm install next-auth
# or
pnpm add next-auth
```

### App Router Configuration

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth"
import GithubProvider from "next-auth/providers/github"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Add your own logic to validate credentials
        const user = await validateCredentials(credentials)
        if (user) {
          return user
        }
        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

### Pages Router Configuration

```typescript
// pages/api/auth/[...nextauth].ts
import NextAuth from "next-auth"
import type { NextAuthOptions } from "next-auth"
import GithubProvider from "next-auth/providers/github"

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  // ... same configuration as above
}

export default NextAuth(authOptions)
```

## Session Management

### Client-Side Session Access (App Router)

```typescript
// app/components/UserProfile.tsx
'use client'

import { useSession, signIn, signOut } from "next-auth/react"

export default function UserProfile() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div>Loading...</div>
  }

  if (status === "unauthenticated") {
    return <button onClick={() => signIn()}>Sign In</button>
  }

  return (
    <div>
      <p>Signed in as {session?.user?.email}</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  )
}
```

### Server-Side Session Access (App Router)

```typescript
// app/dashboard/page.tsx
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  return (
    <div>
      <h1>Welcome, {session.user?.name}</h1>
      {/* Protected content */}
    </div>
  )
}
```

### Session Provider Setup

```typescript
// app/providers.tsx
'use client'

import { SessionProvider } from "next-auth/react"

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

```typescript
// app/layout.tsx
import { Providers } from "./providers"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

## Middleware Protection

### Basic Middleware Authentication

```typescript
// middleware.ts
import { withAuth } from "next-auth/middleware"

export default withAuth({
  callbacks: {
    authorized({ token }) {
      return !!token
    },
  },
})

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"]
}
```

### Advanced Middleware with Role-Based Access

```typescript
// middleware.ts
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const isAuthPage = req.nextUrl.pathname.startsWith("/auth")

    if (isAuthPage) {
      if (isAuth) {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
      return null
    }

    if (!isAuth) {
      let from = req.nextUrl.pathname
      if (req.nextUrl.search) {
        from += req.nextUrl.search
      }

      return NextResponse.redirect(
        new URL(`/auth/signin?from=${encodeURIComponent(from)}`, req.url)
      )
    }

    // Role-based access control
    if (req.nextUrl.pathname.startsWith("/admin") && token.role !== "admin") {
      return NextResponse.redirect(new URL("/unauthorized", req.url))
    }
  },
  {
    callbacks: {
      authorized({ token }) {
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/auth/:path*"]
}
```

## Custom Authentication

### Custom JWT Authentication

```typescript
// lib/auth.ts
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

const secret = new TextEncoder().encode(process.env.JWT_SECRET)

export async function createToken(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret)
}

export async function verifyToken(token: string) {
  try {
    const verified = await jwtVerify(token, secret)
    return verified.payload
  } catch (err) {
    return null
  }
}

export async function getSession() {
  const token = cookies().get("session")?.value
  if (!token) return null
  return await verifyToken(token)
}

export async function setSession(userId: string, data: any) {
  const token = await createToken({ userId, ...data })
  cookies().set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  })
}

export function clearSession() {
  cookies().delete("session")
}
```

### Login API Route

```typescript
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server"
import { setSession } from "@/lib/auth"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user || !await bcrypt.compare(password, user.password)) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    await setSession(user.id, {
      email: user.email,
      role: user.role,
      name: user.name
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

## OAuth Providers

### Google OAuth

```typescript
import GoogleProvider from "next-auth/providers/google"

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
}
```

### GitHub OAuth

```typescript
import GithubProvider from "next-auth/providers/github"

export const authOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
}
```

### Multiple Providers

```typescript
import GoogleProvider from "next-auth/providers/google"
import GithubProvider from "next-auth/providers/github"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    CredentialsProvider({
      // ... credentials configuration
    }),
  ],
}
```

## JWT vs Database Sessions

### JWT Sessions (Recommended for Stateless)

```typescript
export const authOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      return session
    },
  },
}
```

### Database Sessions (Better for Security)

```typescript
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db"

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
}
```

## Role-Based Access Control

### Type Definitions

```typescript
// types/next-auth.d.ts
import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: "admin" | "user" | "moderator"
    }
  }

  interface User {
    role: "admin" | "user" | "moderator"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: "admin" | "user" | "moderator"
  }
}
```

### Protected Component

```typescript
// components/AdminOnly.tsx
'use client'

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div>Loading...</div>
  }

  if (session?.user?.role !== "admin") {
    redirect("/unauthorized")
  }

  return <>{children}</>
}
```

### Server Component Protection

```typescript
// app/admin/page.tsx
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"

export default async function AdminPage() {
  const session = await getServerSession(authOptions)

  if (session?.user?.role !== "admin") {
    redirect("/unauthorized")
  }

  return <div>Admin Dashboard</div>
}
```

## Best Practices

### 1. Environment Variables

```bash
# .env.local
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_ID=your-github-id
GITHUB_SECRET=your-github-secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
```

### 2. Secure Password Hashing

```typescript
import bcrypt from "bcryptjs"

// Hash password
const hashedPassword = await bcrypt.hash(password, 12)

// Verify password
const isValid = await bcrypt.compare(password, user.hashedPassword)
```

### 3. CSRF Protection

NextAuth.js includes CSRF protection by default. For custom auth:

```typescript
// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const csrfToken = request.cookies.get("csrf-token")
  const headerToken = request.headers.get("x-csrf-token")

  if (request.method !== "GET" && csrfToken?.value !== headerToken) {
    return NextResponse.json(
      { error: "Invalid CSRF token" },
      { status: 403 }
    )
  }

  return NextResponse.next()
}
```

### 4. Rate Limiting

```typescript
// lib/rate-limit.ts
import { LRUCache } from "lru-cache"

type Options = {
  uniqueTokenPerInterval?: number
  interval?: number
}

export default function rateLimit(options?: Options) {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60000,
  })

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0]
        if (tokenCount[0] === 0) {
          tokenCache.set(token, [1])
          resolve()
        } else if (tokenCount[0] < limit) {
          tokenCache.set(token, [tokenCount[0] + 1])
          resolve()
        } else {
          reject()
        }
      }),
  }
}
```

### 5. Email Verification

```typescript
// app/api/auth/verify-email/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.json(
      { error: "Token required" },
      { status: 400 }
    )
  }

  const verification = await prisma.verificationToken.findUnique({
    where: { token }
  })

  if (!verification || verification.expires < new Date()) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 }
    )
  }

  await prisma.user.update({
    where: { email: verification.identifier },
    data: { emailVerified: new Date() }
  })

  await prisma.verificationToken.delete({
    where: { token }
  })

  return NextResponse.redirect(new URL("/auth/signin", request.url))
}
```

### 6. Two-Factor Authentication

```typescript
// lib/2fa.ts
import { authenticator } from "otplib"
import QRCode from "qrcode"

export async function generate2FASecret(email: string) {
  const secret = authenticator.generateSecret()
  const otpauth = authenticator.keyuri(email, "YourApp", secret)
  const qrCode = await QRCode.toDataURL(otpauth)

  return { secret, qrCode }
}

export function verify2FAToken(token: string, secret: string) {
  return authenticator.verify({ token, secret })
}
```

## Common Pitfalls

1. **Not setting NEXTAUTH_URL**: Required for OAuth callbacks
2. **Storing passwords in plain text**: Always hash passwords
3. **Not validating session on server**: Always verify server-side
4. **Hardcoding secrets**: Use environment variables
5. **Not handling loading states**: Check `status === "loading"`
6. **Missing NEXTAUTH_SECRET in production**: Required for JWT encryption
7. **Not implementing CSRF protection**: Use built-in or custom solutions
8. **Exposing sensitive data in JWT**: Keep tokens minimal

## Testing Authentication

```typescript
// __tests__/auth.test.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

jest.mock("next-auth/next")

describe("Authentication", () => {
  it("should redirect unauthenticated users", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null)

    // Test your protected route
  })

  it("should allow authenticated users", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "1", email: "test@example.com", role: "user" }
    })

    // Test your protected route
  })
})
```

## Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Next.js Authentication Guide](https://nextjs.org/docs/authentication)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
