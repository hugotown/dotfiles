# NextResponse

`NextResponse` extends the Web Response API with additional convenience methods for Next.js-specific functionality.

## Import

```typescript
import { NextResponse } from 'next/server'
```

## Static Methods

### `NextResponse.json(data, options?)`
Create a JSON response.

### `NextResponse.redirect(url, status?)`
Create a redirect response.

### `NextResponse.rewrite(url)`
Rewrite to a different URL (for Middleware).

### `NextResponse.next()`
Continue to the next middleware or route handler.

## Usage Examples

### JSON Response

```typescript
// app/api/users/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  const users = await getUsers()

  return NextResponse.json(users)
}
```

### JSON with Status Code

```typescript
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const user = await createUser(body)

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
```

### Set Headers

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const data = { message: 'Hello' }

  return NextResponse.json(data, {
    headers: {
      'X-Custom-Header': 'value',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
```

### Set Cookies

```typescript
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const user = await login(body)

  const response = NextResponse.json({ user })

  response.cookies.set('session', user.sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7 // 1 week
  })

  return response
}
```

### Delete Cookies

```typescript
import { NextResponse } from 'next/server'

export async function POST() {
  await logout()

  const response = NextResponse.json({ success: true })

  // Delete session cookie
  response.cookies.delete('session')

  return response
}
```

### Redirect

```typescript
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const redirectUrl = searchParams.get('redirect')

  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.json({ error: 'No redirect URL' })
}
```

### Redirect with Status

```typescript
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const isAuthenticated = checkAuth(request)

  if (!isAuthenticated) {
    // Temporary redirect (307)
    return NextResponse.redirect(
      new URL('/login', request.url),
      307
    )
  }

  return NextResponse.next()
}
```

### Permanent Redirect

```typescript
import { NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Permanent redirect (308)
  if (request.nextUrl.pathname === '/old-page') {
    return NextResponse.redirect(
      new URL('/new-page', request.url),
      308
    )
  }

  return NextResponse.next()
}
```

### Rewrite (Middleware)

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Rewrite /api/old to /api/new
  if (request.nextUrl.pathname.startsWith('/api/old')) {
    return NextResponse.rewrite(
      new URL('/api/new', request.url)
    )
  }

  return NextResponse.next()
}
```

### Conditional Rewrite

```typescript
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const country = request.geo?.country

  // Rewrite based on geolocation
  if (country === 'GB') {
    return NextResponse.rewrite(
      new URL('/en-gb' + request.nextUrl.pathname, request.url)
    )
  }

  return NextResponse.next()
}
```

### Continue to Next Middleware

```typescript
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Add custom header and continue
  const response = NextResponse.next()

  response.headers.set('X-Custom-Header', 'value')

  return response
}
```

### CORS Headers

```typescript
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const data = { message: 'Hello' }

  return NextResponse.json(data, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
```

### Error Response

```typescript
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = await processData(body)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Multiple Cookies

```typescript
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true })

  // Set multiple cookies
  response.cookies.set('theme', 'dark')
  response.cookies.set('language', 'en')
  response.cookies.set('timezone', 'UTC')

  return response
}
```

### Modify Response Headers

```typescript
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin')

  return response
}
```

### Rate Limit Response

```typescript
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': '60'
        }
      }
    )
  }

  // Process request
  return NextResponse.json({ success: true })
}
```

### Cache Control

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const data = await fetchData()

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  })
}
```

### Content-Type Header

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const xml = generateXML()

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml'
    }
  })
}
```

### Download Response

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const csvData = generateCSV()

  return new NextResponse(csvData, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="data.csv"'
    }
  })
}
```

### Stream Response

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 10; i++) {
        const data = `data: ${i}\n\n`
        controller.enqueue(new TextEncoder().encode(data))
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      controller.close()
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

## Cookie Methods

### Set Cookie

```typescript
response.cookies.set('name', 'value', {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 3600,
  path: '/'
})
```

### Get Cookie

```typescript
const cookie = response.cookies.get('name')
```

### Delete Cookie

```typescript
response.cookies.delete('name')
```

### Get All Cookies

```typescript
const cookies = response.cookies.getAll()
```

### Has Cookie

```typescript
const hasCookie = response.cookies.has('name')
```

## Response Options

```typescript
NextResponse.json(data, {
  status: 200,
  statusText: 'OK',
  headers: {
    'Content-Type': 'application/json',
    'X-Custom-Header': 'value'
  }
})
```

## Best Practices

1. **Always Set Appropriate Status Codes**
   ```typescript
   // 200 - Success
   return NextResponse.json(data)

   // 201 - Created
   return NextResponse.json(newItem, { status: 201 })

   // 400 - Bad Request
   return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

   // 401 - Unauthorized
   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

   // 404 - Not Found
   return NextResponse.json({ error: 'Not found' }, { status: 404 })

   // 500 - Server Error
   return NextResponse.json({ error: 'Server error' }, { status: 500 })
   ```

2. **Use Secure Cookie Settings**
   ```typescript
   response.cookies.set('session', token, {
     httpOnly: true,      // Not accessible via JavaScript
     secure: true,        // Only HTTPS
     sameSite: 'strict',  // CSRF protection
     maxAge: 86400        // 1 day
   })
   ```

3. **Add Security Headers**
   ```typescript
   const response = NextResponse.next()
   response.headers.set('X-Frame-Options', 'DENY')
   response.headers.set('X-Content-Type-Options', 'nosniff')
   ```

4. **Handle Errors Gracefully**
   ```typescript
   try {
     const data = await fetchData()
     return NextResponse.json(data)
   } catch (error) {
     console.error(error)
     return NextResponse.json(
       { error: 'Something went wrong' },
       { status: 500 }
     )
   }
   ```

5. **Use Appropriate Redirect Status Codes**
   ```typescript
   // 307 - Temporary Redirect (maintains method)
   NextResponse.redirect(url, 307)

   // 308 - Permanent Redirect (maintains method)
   NextResponse.redirect(url, 308)
   ```

## Important Notes

- Extends Web Response API
- Available in Route Handlers and Middleware
- `NextResponse.json()` automatically sets Content-Type
- Cookies can be set on any response
- Use `NextResponse.next()` to continue middleware chain
- `rewrite()` only works in Middleware
- Headers are case-insensitive

## Related

- [NextRequest](./NextRequest.md) - Extended Request object
- [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) - API routes
- [Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware) - Request interception
- [cookies](./cookies.md) - Server-side cookie management
