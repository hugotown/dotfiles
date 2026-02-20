# Route Handlers in Next.js App Router

Route handlers allow you to create custom request handlers for API endpoints using the Web Request and Response APIs. They are the App Router's replacement for API Routes (pages/api), providing more control and flexibility for building APIs.

## Overview

Route handlers are defined in a `route.js` or `route.ts` file within the `app` directory. They support all HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) and can be used alongside pages, but not in the same route segment.

## Basic Syntax

### Creating a Route Handler

```
app/
  api/
    route.ts          # /api
    users/
      route.ts        # /api/users
    posts/
      [id]/
        route.ts      # /api/posts/[id]
```

**Simple GET handler:**

```typescript
// app/api/hello/route.ts
export async function GET() {
  return Response.json({ message: 'Hello, World!' })
}
```

**Simple POST handler:**

```typescript
// app/api/users/route.ts
export async function POST(request: Request) {
  const body = await request.json()

  // Process the data
  const user = await createUser(body)

  return Response.json(user, { status: 201 })
}
```

## HTTP Methods

Route handlers support all standard HTTP methods:

```typescript
// app/api/posts/route.ts

// GET - Retrieve data
export async function GET(request: Request) {
  const posts = await getPosts()
  return Response.json(posts)
}

// POST - Create data
export async function POST(request: Request) {
  const body = await request.json()
  const post = await createPost(body)
  return Response.json(post, { status: 201 })
}

// PUT - Update/replace data
export async function PUT(request: Request) {
  const body = await request.json()
  const post = await updatePost(body)
  return Response.json(post)
}

// PATCH - Partially update data
export async function PATCH(request: Request) {
  const body = await request.json()
  const post = await patchPost(body)
  return Response.json(post)
}

// DELETE - Remove data
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  await deletePost(id)
  return new Response(null, { status: 204 })
}

// HEAD - Headers only
export async function HEAD(request: Request) {
  return new Response(null, {
    headers: { 'Content-Type': 'application/json' }
  })
}

// OPTIONS - CORS preflight
export async function OPTIONS(request: Request) {
  return new Response(null, {
    headers: {
      'Allow': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    }
  })
}
```

## Request Object

### Reading Request Data

**JSON body:**

```typescript
export async function POST(request: Request) {
  const body = await request.json()
  // { name: "John", email: "john@example.com" }

  return Response.json({ received: body })
}
```

**Form data:**

```typescript
export async function POST(request: Request) {
  const formData = await request.formData()
  const name = formData.get('name')
  const email = formData.get('email')

  return Response.json({ name, email })
}
```

**Text:**

```typescript
export async function POST(request: Request) {
  const text = await request.text()
  return Response.json({ received: text })
}
```

**Headers:**

```typescript
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const userAgent = request.headers.get('user-agent')

  return Response.json({ authHeader, userAgent })
}
```

**Cookies:**

```typescript
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = cookies()
  const token = cookieStore.get('token')

  return Response.json({ token: token?.value })
}
```

**URL and query parameters:**

```typescript
// app/api/search/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const page = searchParams.get('page') || '1'

  const results = await search(query, parseInt(page))

  return Response.json(results)
}
// Usage: /api/search?q=nextjs&page=2
```

## Dynamic Route Handlers

### Dynamic Segments

```typescript
// app/api/posts/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const post = await getPost(params.id)

  if (!post) {
    return Response.json(
      { error: 'Post not found' },
      { status: 404 }
    )
  }

  return Response.json(post)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  await deletePost(params.id)
  return new Response(null, { status: 204 })
}
```

### Multiple Dynamic Segments

```typescript
// app/api/users/[userId]/posts/[postId]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { userId: string; postId: string } }
) {
  const post = await getUserPost(params.userId, params.postId)
  return Response.json(post)
}
```

### Catch-All Segments

```typescript
// app/api/files/[...path]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  const filePath = params.path.join('/')
  const file = await getFile(filePath)

  return new Response(file, {
    headers: { 'Content-Type': 'application/octet-stream' }
  })
}
// Usage: /api/files/documents/2024/report.pdf
```

## Response Types

### JSON Response

```typescript
export async function GET() {
  return Response.json({ message: 'Success' })
}

// With status and headers
export async function POST() {
  return Response.json(
    { created: true },
    {
      status: 201,
      headers: { 'X-Custom-Header': 'value' }
    }
  )
}
```

### Text Response

```typescript
export async function GET() {
  return new Response('Plain text response')
}
```

### HTML Response

```typescript
export async function GET() {
  const html = '<html><body><h1>Hello</h1></body></html>'

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  })
}
```

### Redirect Response

```typescript
import { redirect } from 'next/navigation'

export async function GET() {
  redirect('/new-location')
}

// Or using Response
export async function GET() {
  return Response.redirect(new URL('/new-location', request.url))
}
```

### File Download

```typescript
export async function GET() {
  const file = await getFile()

  return new Response(file, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="document.pdf"'
    }
  })
}
```

### Streaming Response

```typescript
export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 10; i++) {
        controller.enqueue(encoder.encode(`Data chunk ${i}\n`))
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      controller.close()
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain' }
  })
}
```

## Error Handling

### Try-Catch Pattern

```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = await processData(body)

    return Response.json(result)
  } catch (error) {
    console.error('Error:', error)

    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Validation Errors

```typescript
import { z } from 'zod'

const UserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = UserSchema.parse(body)

    const user = await createUser(validated)
    return Response.json(user, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Custom Error Responses

```typescript
class APIError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

export async function GET(request: Request) {
  try {
    const data = await fetchData()

    if (!data) {
      throw new APIError(404, 'Resource not found')
    }

    return Response.json(data)

  } catch (error) {
    if (error instanceof APIError) {
      return Response.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }

    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Common Patterns

### Authentication

```typescript
import { verify } from 'jsonwebtoken'

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.split(' ')[1]

  if (!token) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const decoded = verify(token, process.env.JWT_SECRET!)
    const data = await fetchUserData(decoded.userId)

    return Response.json(data)
  } catch (error) {
    return Response.json(
      { error: 'Invalid token' },
      { status: 401 }
    )
  }
}
```

### CORS Configuration

```typescript
export async function GET(request: Request) {
  const data = await fetchData()

  return Response.json(data, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}
```

### Rate Limiting

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
})

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const { success, remaining } = await ratelimit.limit(ip)

  if (!success) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
    )
  }

  const data = await fetchData()

  return Response.json(data, {
    headers: { 'X-RateLimit-Remaining': remaining.toString() }
  })
}
```

### Pagination

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')

  const offset = (page - 1) * limit

  const [items, total] = await Promise.all([
    getItems(limit, offset),
    getTotalCount()
  ])

  return Response.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  })
}
```

### File Upload

```typescript
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return Response.json(
      { error: 'No file provided' },
      { status: 400 }
    )
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Save file
  const path = `/uploads/${file.name}`
  await saveFile(path, buffer)

  return Response.json({
    success: true,
    url: path
  })
}
```

### Webhooks

```typescript
import crypto from 'crypto'

export async function POST(request: Request) {
  const payload = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex')

  if (signature !== `sha256=${expectedSignature}`) {
    return Response.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }

  const event = JSON.parse(payload)
  await processWebhookEvent(event)

  return Response.json({ received: true })
}
```

## Caching and Revalidation

### Static Route Handlers (Default)

```typescript
// Cached by default
export async function GET() {
  const data = await fetchData()
  return Response.json(data)
}
```

### Dynamic Route Handlers

Route handlers are automatically dynamic when:
- Using the `Request` object
- Using dynamic functions (cookies, headers)
- Using any HTTP method other than GET

```typescript
export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await fetchData()
  return Response.json(data)
}
```

### Revalidation

```typescript
export const revalidate = 3600 // Revalidate every hour

export async function GET() {
  const data = await fetchData()
  return Response.json(data)
}
```

### No Caching

```typescript
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const data = await fetchData()
  return Response.json(data)
}
```

## Edge Runtime

Run route handlers on the Edge runtime for lower latency:

```typescript
export const runtime = 'edge'

export async function GET() {
  const data = await fetchData()
  return Response.json(data)
}
```

**Edge limitations:**
- No Node.js APIs
- Smaller bundle size limits
- Limited npm packages

## Best Practices

### 1. Use TypeScript for Type Safety

```typescript
interface CreateUserRequest {
  name: string
  email: string
}

interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

export async function POST(request: Request): Promise<Response> {
  const body: CreateUserRequest = await request.json()
  const user: User = await createUser(body)
  return Response.json(user)
}
```

### 2. Validate Input Data

```typescript
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
})

export async function POST(request: Request) {
  const body = await request.json()
  const result = schema.safeParse(body)

  if (!result.success) {
    return Response.json(
      { error: result.error.errors },
      { status: 400 }
    )
  }

  // Use validated data
  const user = await createUser(result.data)
  return Response.json(user)
}
```

### 3. Use Proper HTTP Status Codes

```typescript
// 200 - OK
return Response.json(data)

// 201 - Created
return Response.json(data, { status: 201 })

// 204 - No Content
return new Response(null, { status: 204 })

// 400 - Bad Request
return Response.json({ error: 'Invalid input' }, { status: 400 })

// 401 - Unauthorized
return Response.json({ error: 'Unauthorized' }, { status: 401 })

// 404 - Not Found
return Response.json({ error: 'Not found' }, { status: 404 })

// 500 - Internal Server Error
return Response.json({ error: 'Server error' }, { status: 500 })
```

### 4. Handle Errors Consistently

```typescript
function handleError(error: unknown): Response {
  console.error(error)

  if (error instanceof z.ZodError) {
    return Response.json(
      { error: 'Validation failed', details: error.errors },
      { status: 400 }
    )
  }

  return Response.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}

export async function POST(request: Request) {
  try {
    const data = await processRequest(request)
    return Response.json(data)
  } catch (error) {
    return handleError(error)
  }
}
```

### 5. Use Environment Variables

```typescript
const API_KEY = process.env.API_KEY
const DATABASE_URL = process.env.DATABASE_URL

export async function GET() {
  const data = await fetchFromAPI(API_KEY)
  return Response.json(data)
}
```

## Summary

Route handlers provide flexible API endpoint creation in Next.js App Router:

- **File**: `route.ts` in app directory
- **Methods**: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Request**: Web Request API with JSON, FormData, headers, cookies
- **Response**: Web Response API with JSON, streaming, redirects
- **Dynamic**: Support dynamic segments and catch-all routes
- **Caching**: Opt-in with revalidation or force dynamic
- **Edge**: Optional Edge runtime for lower latency
- **Best Practices**: Validate input, handle errors, use proper status codes

Route handlers are perfect for building REST APIs, webhooks, proxy endpoints, and any server-side logic in Next.js applications.
