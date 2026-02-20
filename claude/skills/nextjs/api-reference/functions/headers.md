# headers

The `headers()` function allows you to read incoming HTTP request headers from Server Components, Route Handlers, and Server Actions.

## Function Signature

```typescript
import { headers } from 'next/headers'

async function headers(): Promise<Headers>
```

## Return Value

Returns a Promise that resolves to a **read-only** Web `Headers` object containing the incoming request headers.

## Usage Examples

### Basic Usage in Server Component

```typescript
// app/page.tsx
import { headers } from 'next/headers'

export default async function Page() {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent')

  return (
    <div>
      <h1>Your User Agent</h1>
      <p>{userAgent}</p>
    </div>
  )
}
```

### Reading Multiple Headers

```typescript
import { headers } from 'next/headers'

export default async function Page() {
  const headersList = await headers()

  const referer = headersList.get('referer')
  const userAgent = headersList.get('user-agent')
  const acceptLanguage = headersList.get('accept-language')
  const authorization = headersList.get('authorization')

  return (
    <div>
      <p>Referer: {referer}</p>
      <p>User Agent: {userAgent}</p>
      <p>Language: {acceptLanguage}</p>
      <p>Has Auth: {authorization ? 'Yes' : 'No'}</p>
    </div>
  )
}
```

### In Route Handlers

```typescript
// app/api/info/route.ts
import { headers } from 'next/headers'

export async function GET() {
  const headersList = await headers()
  const authorization = headersList.get('authorization')

  if (!authorization) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Process authenticated request
  return Response.json({ message: 'Success' })
}
```

### In Server Actions

```typescript
// app/actions.ts
'use server'

import { headers } from 'next/headers'

export async function createPost(formData: FormData) {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent')

  // Log user agent for analytics
  console.log('Post created from:', userAgent)

  // Process form data
  const title = formData.get('title')
  // ... save to database

  return { success: true }
}
```

### Checking Custom Headers

```typescript
import { headers } from 'next/headers'

export default async function Page() {
  const headersList = await headers()

  // Check custom API key header
  const apiKey = headersList.get('x-api-key')

  // Check custom request ID
  const requestId = headersList.get('x-request-id')

  // Check custom feature flags
  const featureFlags = headersList.get('x-feature-flags')

  return (
    <div>
      <p>API Key present: {apiKey ? 'Yes' : 'No'}</p>
      <p>Request ID: {requestId}</p>
      <p>Features: {featureFlags}</p>
    </div>
  )
}
```

### Iterating Over All Headers

```typescript
import { headers } from 'next/headers'

export default async function Page() {
  const headersList = await headers()
  const allHeaders: Record<string, string> = {}

  headersList.forEach((value, key) => {
    allHeaders[key] = value
  })

  return (
    <div>
      <h1>All Request Headers</h1>
      <pre>{JSON.stringify(allHeaders, null, 2)}</pre>
    </div>
  )
}
```

### Authentication Check

```typescript
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  const headersList = await headers()
  const authorization = headersList.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    redirect('/login')
  }

  const token = authorization.substring(7)
  // Verify token...

  return <div>Protected Content</div>
}
```

### Getting Client IP Address

```typescript
import { headers } from 'next/headers'

export default async function Page() {
  const headersList = await headers()

  // Different headers depending on proxy/CDN
  const ip =
    headersList.get('x-forwarded-for') ||
    headersList.get('x-real-ip') ||
    headersList.get('cf-connecting-ip') || // Cloudflare
    'Unknown'

  return (
    <div>
      <p>Your IP: {ip}</p>
    </div>
  )
}
```

### Content Negotiation

```typescript
import { headers } from 'next/headers'

export default async function Page() {
  const headersList = await headers()
  const acceptHeader = headersList.get('accept') || ''

  const preferJson = acceptHeader.includes('application/json')
  const preferHtml = acceptHeader.includes('text/html')

  if (preferJson) {
    return Response.json({ data: 'JSON response' })
  }

  return (
    <div>
      <h1>HTML Response</h1>
    </div>
  )
}
```

## Common Headers Reference

### Standard HTTP Headers

```typescript
const headersList = await headers()

// Request metadata
headersList.get('user-agent')      // Browser/client info
headersList.get('referer')         // Previous page URL
headersList.get('accept')          // Accepted content types
headersList.get('accept-language') // Preferred languages
headersList.get('accept-encoding') // Supported encodings

// Authentication
headersList.get('authorization')   // Auth credentials
headersList.get('cookie')          // HTTP cookies

// Content info
headersList.get('content-type')    // Request body type
headersList.get('content-length')  // Request body size

// Caching
headersList.get('cache-control')   // Cache directives
headersList.get('if-none-match')   // Conditional request
```

### Common Proxy/CDN Headers

```typescript
// Client IP
headersList.get('x-forwarded-for')     // Proxy chain IPs
headersList.get('x-real-ip')           // Original client IP
headersList.get('cf-connecting-ip')    // Cloudflare client IP

// Protocol info
headersList.get('x-forwarded-proto')   // Original protocol (http/https)
headersList.get('x-forwarded-host')    // Original host

// Request tracking
headersList.get('x-request-id')        // Unique request ID
headersList.get('x-correlation-id')    // Request correlation
```

## Best Practices

1. **Always Await the Function**
   ```typescript
   // ✅ Correct
   const headersList = await headers()

   // ❌ Wrong (TypeScript error)
   const headersList = headers()
   ```

2. **Headers are Read-Only**
   ```typescript
   const headersList = await headers()

   // ❌ Cannot set headers
   // headersList.set('custom', 'value') // Error

   // ✅ To set response headers, use NextResponse
   ```

3. **Case-Insensitive Header Names**
   ```typescript
   // These are equivalent
   headersList.get('user-agent')
   headersList.get('User-Agent')
   headersList.get('USER-AGENT')
   ```

4. **Check for Null Values**
   ```typescript
   const auth = headersList.get('authorization')

   if (auth) {
     // Header exists
     const token = auth.split(' ')[1]
   } else {
     // Header doesn't exist
   }
   ```

5. **Use for Server-Side Logic Only**
   ```typescript
   // ✅ Server Component
   export default async function Page() {
     const headersList = await headers()
     // ...
   }

   // ❌ Client Component (will error)
   'use client'
   export default function ClientPage() {
     const headersList = await headers() // Error!
   }
   ```

## Security Considerations

1. **Don't Trust Headers Blindly**
   ```typescript
   // ⚠️ Headers can be spoofed by clients
   const adminHeader = headersList.get('x-is-admin')

   // ✅ Always verify on the server
   const token = headersList.get('authorization')
   const isAdmin = await verifyAdminToken(token)
   ```

2. **Sanitize Header Values**
   ```typescript
   const userInput = headersList.get('x-custom-header')

   // Sanitize before using in queries or responses
   const sanitized = sanitizeInput(userInput)
   ```

3. **Be Careful with IP Headers**
   ```typescript
   // IP headers can be spoofed
   // Only trust them if behind a trusted proxy
   const ip = headersList.get('x-forwarded-for')
   ```

## Notes

- `headers()` is an async function that must be awaited
- Only available in Server Components, Route Handlers, and Server Actions
- Returns read-only headers (cannot be modified)
- Header names are case-insensitive
- Returns `null` if a header doesn't exist
- Causes the route to be dynamically rendered (opt-out of static optimization)

## Related

- [cookies](./cookies.md) - Read and set cookies
- [NextRequest](./NextRequest.md) - Extended Request object
- [NextResponse](./NextResponse.md) - Extended Response object
