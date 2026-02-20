# cookies

The `cookies()` function allows you to read and set HTTP cookies from Server Components, Route Handlers, and Server Actions.

## Function Signature

```typescript
import { cookies } from 'next/headers'

async function cookies(): Promise<ReadonlyRequestCookies>
```

## Return Value

Returns a Promise that resolves to a `ReadonlyRequestCookies` object with methods to read and set cookies.

## Available Methods

### Reading Cookies

```typescript
const cookieStore = await cookies()

// Get a single cookie
cookieStore.get('name')          // { name: string, value: string } | undefined
cookieStore.getAll()             // Array<{ name: string, value: string }>
cookieStore.has('name')          // boolean
```

### Setting Cookies

```typescript
const cookieStore = await cookies()

// Set a cookie
cookieStore.set('name', 'value')
cookieStore.set('name', 'value', options)

// Set with options object
cookieStore.set({
  name: 'name',
  value: 'value',
  httpOnly: true,
  // ... other options
})

// Delete a cookie
cookieStore.delete('name')
```

## Usage Examples

### Reading Cookies in Server Component

```typescript
// app/page.tsx
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')

  return (
    <div>
      <h1>Current Theme</h1>
      <p>{theme?.value || 'default'}</p>
    </div>
  )
}
```

### Reading All Cookies

```typescript
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  return (
    <div>
      <h1>All Cookies</h1>
      <ul>
        {allCookies.map(cookie => (
          <li key={cookie.name}>
            {cookie.name}: {cookie.value}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Checking if Cookie Exists

```typescript
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const hasSession = cookieStore.has('session')

  if (!hasSession) {
    return <div>Please log in</div>
  }

  return <div>Welcome back!</div>
}
```

### Setting Cookies in Server Action

```typescript
// app/actions.ts
'use server'

import { cookies } from 'next/headers'

export async function setTheme(theme: string) {
  const cookieStore = await cookies()

  cookieStore.set('theme', theme, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365 // 1 year
  })
}

export async function deleteTheme() {
  const cookieStore = await cookies()
  cookieStore.delete('theme')
}
```

### Setting Session Cookie

```typescript
'use server'

import { cookies } from 'next/headers'

export async function createSession(userId: string) {
  const cookieStore = await cookies()
  const sessionToken = generateSessionToken(userId)

  cookieStore.set('session', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/'
  })
}
```

### Reading Cookie in Route Handler

```typescript
// app/api/user/route.ts
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')

  if (!session) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Verify session and get user
  const user = await getUserFromSession(session.value)

  return Response.json({ user })
}
```

### Setting Cookie in Route Handler

```typescript
// app/api/login/route.ts
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const { username, password } = await request.json()

  // Authenticate user
  const user = await authenticate(username, password)

  if (!user) {
    return Response.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    )
  }

  // Set session cookie
  const cookieStore = await cookies()
  cookieStore.set('session', user.sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  })

  return Response.json({ success: true })
}
```

### Deleting Cookie

```typescript
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  redirect('/login')
}
```

### Setting Multiple Cookies

```typescript
'use server'

import { cookies } from 'next/headers'

export async function setUserPreferences(preferences: {
  theme: string
  language: string
  timezone: string
}) {
  const cookieStore = await cookies()

  cookieStore.set('theme', preferences.theme, {
    maxAge: 60 * 60 * 24 * 365
  })

  cookieStore.set('language', preferences.language, {
    maxAge: 60 * 60 * 24 * 365
  })

  cookieStore.set('timezone', preferences.timezone, {
    maxAge: 60 * 60 * 24 * 365
  })
}
```

### Reading and Updating Cookie

```typescript
'use server'

import { cookies } from 'next/headers'

export async function updateVisitCount() {
  const cookieStore = await cookies()
  const currentCount = cookieStore.get('visitCount')

  const newCount = currentCount
    ? parseInt(currentCount.value) + 1
    : 1

  cookieStore.set('visitCount', newCount.toString(), {
    maxAge: 60 * 60 * 24 * 365
  })

  return newCount
}
```

## Cookie Options

When setting cookies, you can provide these options:

```typescript
interface CookieOptions {
  domain?: string       // Cookie domain
  expires?: Date        // Expiration date
  httpOnly?: boolean    // HTTP-only cookie (not accessible via JS)
  maxAge?: number       // Max age in seconds
  path?: string         // Cookie path
  sameSite?: 'strict' | 'lax' | 'none'  // SameSite policy
  secure?: boolean      // Require HTTPS
  priority?: 'low' | 'medium' | 'high'  // Cookie priority
}
```

### Cookie Options Examples

```typescript
const cookieStore = await cookies()

// Secure session cookie
cookieStore.set('session', token, {
  httpOnly: true,      // Not accessible via JavaScript
  secure: true,        // Only sent over HTTPS
  sameSite: 'strict',  // Strict CSRF protection
  maxAge: 86400,       // 1 day in seconds
  path: '/'            // Available site-wide
})

// Public preference cookie
cookieStore.set('theme', 'dark', {
  httpOnly: false,     // Accessible via JavaScript
  secure: false,       // Works on HTTP (dev)
  sameSite: 'lax',     // Some CSRF protection
  maxAge: 31536000,    // 1 year
  path: '/'
})

// Subdomain cookie
cookieStore.set('tracking', 'xyz', {
  domain: '.example.com',  // Available to all subdomains
  path: '/',
  maxAge: 31536000
})

// Expiring cookie
cookieStore.set('promo', 'summer2024', {
  expires: new Date('2024-09-01'),
  path: '/'
})
```

## Best Practices

1. **Always Await the Function**
   ```typescript
   // ✅ Correct
   const cookieStore = await cookies()

   // ❌ Wrong
   const cookieStore = cookies()
   ```

2. **Use httpOnly for Sensitive Cookies**
   ```typescript
   // ✅ Secure session cookie
   cookieStore.set('session', token, {
     httpOnly: true,  // Prevents XSS attacks
     secure: true,
     sameSite: 'strict'
   })

   // ❌ Insecure (accessible via JavaScript)
   cookieStore.set('session', token)
   ```

3. **Set Appropriate Expiration**
   ```typescript
   // Session cookie (expires when browser closes)
   cookieStore.set('temp', 'value')

   // Persistent cookie with maxAge
   cookieStore.set('remember', 'value', {
     maxAge: 60 * 60 * 24 * 30  // 30 days
   })

   // Persistent cookie with expires date
   cookieStore.set('promo', 'value', {
     expires: new Date('2024-12-31')
   })
   ```

4. **Use Secure Cookies in Production**
   ```typescript
   cookieStore.set('auth', token, {
     secure: process.env.NODE_ENV === 'production',
     httpOnly: true,
     sameSite: 'strict'
   })
   ```

5. **Handle Missing Cookies Gracefully**
   ```typescript
   const session = cookieStore.get('session')

   if (!session) {
     // Cookie doesn't exist
     redirect('/login')
   }

   // Cookie exists
   const userId = session.value
   ```

6. **Choose the Right SameSite Policy**
   ```typescript
   // Strict - most secure (cookie only sent for same-site requests)
   cookieStore.set('auth', token, { sameSite: 'strict' })

   // Lax - balanced (cookie sent on top-level navigation)
   cookieStore.set('preference', value, { sameSite: 'lax' })

   // None - least secure (cookie sent with all requests)
   // Requires secure: true
   cookieStore.set('tracking', id, {
     sameSite: 'none',
     secure: true
   })
   ```

## Common Patterns

### Authentication Check

```typescript
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')

  if (!session) {
    redirect('/login')
  }

  return <div>Protected Content</div>
}
```

### User Preferences

```typescript
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()

  const theme = cookieStore.get('theme')?.value || 'light'
  const language = cookieStore.get('language')?.value || 'en'

  return (
    <div data-theme={theme} data-lang={language}>
      <h1>Welcome</h1>
    </div>
  )
}
```

### Cookie Banner Consent

```typescript
'use server'

import { cookies } from 'next/headers'

export async function acceptCookies() {
  const cookieStore = await cookies()

  cookieStore.set('cookie-consent', 'accepted', {
    maxAge: 60 * 60 * 24 * 365,  // 1 year
    path: '/'
  })
}

export async function checkCookieConsent() {
  const cookieStore = await cookies()
  return cookieStore.has('cookie-consent')
}
```

## Notes

- `cookies()` is an async function that must be awaited
- Only available in Server Components, Route Handlers, and Server Actions
- Reading cookies in Server Components causes dynamic rendering
- Setting/deleting cookies only works in Server Actions and Route Handlers
- Cookie names are case-sensitive
- Cookies are automatically encoded/decoded
- Setting cookies in Server Components will throw an error

## Related

- [headers](./headers.md) - Read request headers
- [NextRequest](./NextRequest.md) - Extended Request object
- [NextResponse](./NextResponse.md) - Extended Response object
