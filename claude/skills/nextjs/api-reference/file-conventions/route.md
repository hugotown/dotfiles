# route.js / route.ts

Route Handlers allow you to create custom request handlers for a given route using the Web Request and Response APIs.

## File Signature

```ts
// app/api/route.ts
export async function GET(request: Request) {
  return new Response('Hello, Next.js!')
}
```

## Supported HTTP Methods

Route Handlers support the following HTTP methods:

- `GET`
- `POST`
- `PUT`
- `PATCH`
- `DELETE`
- `HEAD`
- `OPTIONS`

```ts
// app/api/route.ts
export async function GET(request: Request) {}
export async function POST(request: Request) {}
export async function PUT(request: Request) {}
export async function PATCH(request: Request) {}
export async function DELETE(request: Request) {}
export async function HEAD(request: Request) {}
export async function OPTIONS(request: Request) {}
```

If an unsupported method is called, Next.js will return a `405 Method Not Allowed` response.

## Parameters

### request

The `request` object is a Web Request API instance.

```ts
export async function GET(request: Request) {
  const url = new URL(request.url)
  const searchParams = url.searchParams
  const query = searchParams.get('query')

  return Response.json({ query })
}
```

### context (Optional)

Route handlers can receive a second `context` parameter containing route params.

```ts
// app/api/posts/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id
  return Response.json({ id })
}
```

## Examples

### Basic GET Request

```ts
// app/api/hello/route.ts
export async function GET() {
  return new Response('Hello, World!')
}
```

### JSON Response

```ts
// app/api/data/route.ts
export async function GET() {
  const data = { message: 'Hello', timestamp: Date.now() }
  return Response.json(data)
}
```

### POST Request with JSON Body

```ts
// app/api/users/route.ts
export async function POST(request: Request) {
  const body = await request.json()

  // Process the data
  const user = {
    id: Math.random(),
    name: body.name,
    email: body.email,
  }

  return Response.json(user, { status: 201 })
}
```

### Reading Query Parameters

```ts
// app/api/search/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const page = searchParams.get('page') || '1'

  // Perform search
  const results = await searchDatabase(query, parseInt(page))

  return Response.json({ results, query, page })
}

// Usage: /api/search?q=nextjs&page=2
```

### Dynamic Route Handler

```ts
// app/api/posts/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const post = await getPost(params.id)

  if (!post) {
    return new Response('Not Found', { status: 404 })
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

### Setting Headers

```ts
// app/api/data/route.ts
export async function GET() {
  return Response.json(
    { message: 'Success' },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  )
}
```

### CORS Headers

```ts
// app/api/route.ts
export async function GET(request: Request) {
  return Response.json(
    { message: 'Success' },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  )
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
```

### Error Handling

```ts
// app/api/users/route.ts
export async function GET() {
  try {
    const users = await fetchUsers()
    return Response.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return Response.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
```

### Reading Cookies

```ts
// app/api/route.ts
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = cookies()
  const token = cookieStore.get('token')

  return Response.json({ token: token?.value })
}
```

### Setting Cookies

```ts
// app/api/login/route.ts
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const { username, password } = await request.json()

  // Authenticate user
  const token = await authenticate(username, password)

  cookies().set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  })

  return Response.json({ success: true })
}
```

### Reading Headers

```ts
// app/api/route.ts
import { headers } from 'next/headers'

export async function GET() {
  const headersList = headers()
  const authorization = headersList.get('authorization')

  return Response.json({ authorization })
}
```

### Redirects

```ts
// app/api/redirect/route.ts
import { redirect } from 'next/navigation'

export async function GET() {
  redirect('https://nextjs.org/')
}
```

### Streaming Response

```ts
// app/api/stream/route.ts
export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode('Hello '))
      await new Promise((resolve) => setTimeout(resolve, 1000))
      controller.enqueue(encoder.encode('World!'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain' },
  })
}
```

### FormData Handling

```ts
// app/api/upload/route.ts
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const name = formData.get('name') as string

  // Process file upload
  const buffer = await file.arrayBuffer()

  return Response.json({
    success: true,
    fileName: file.name,
    size: file.size,
    name,
  })
}
```

### Webhook Handler

```ts
// app/api/webhook/route.ts
import crypto from 'crypto'

export async function POST(request: Request) {
  const payload = await request.text()
  const signature = request.headers.get('x-signature')

  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex')

  if (signature !== expectedSignature) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const data = JSON.parse(payload)

  // Process webhook
  await processWebhook(data)

  return Response.json({ received: true })
}
```

### Middleware-like Pattern

```ts
// app/api/protected/route.ts
import { NextResponse } from 'next/server'

async function authenticate(request: Request) {
  const token = request.headers.get('authorization')

  if (!token) {
    return false
  }

  // Verify token
  return verifyToken(token)
}

export async function GET(request: Request) {
  const isAuthenticated = await authenticate(request)

  if (!isAuthenticated) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return Response.json({ data: 'Protected data' })
}
```

### Pagination

```ts
// app/api/posts/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')

  const offset = (page - 1) * limit

  const posts = await getPosts({ offset, limit })
  const total = await getPostsCount()

  return Response.json({
    posts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
```

### NextResponse Helper

```ts
// app/api/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  // Simpler API
  return NextResponse.json({ message: 'Success' })
}

export async function POST(request: Request) {
  const data = await request.json()

  return NextResponse.json(
    { success: true },
    {
      status: 201,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
```

## Route Resolution

**Important:** Route handlers cannot be at the same route segment level as `page.js`.

```
❌ Invalid:
app/
└── route.ts
└── page.tsx        # Error: Cannot have both

✅ Valid:
app/
├── page.tsx
└── api/
    └── route.ts
```

## Caching Behavior

Route Handlers are cached by default when using the `GET` method with the Response object.

```ts
// Cached by default
export async function GET() {
  return Response.json({ time: Date.now() })
}
```

**Opting out of caching:**

```ts
// Using dynamic functions
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url) // Dynamic
  return Response.json({ query: searchParams.get('q') })
}

// Using segment config
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({ time: Date.now() })
}
```

## Segment Config Options

```ts
export const dynamic = 'auto' // 'auto' | 'force-dynamic' | 'error' | 'force-static'
export const dynamicParams = true // true | false
export const revalidate = false // false | 0 | number
export const fetchCache = 'auto' // 'auto' | 'default-cache' | 'only-cache' | 'force-cache' | 'force-no-store' | 'default-no-store' | 'only-no-store'
export const runtime = 'nodejs' // 'nodejs' | 'edge'
export const preferredRegion = 'auto' // 'auto' | 'global' | 'home' | string | string[]
```

## TypeScript

```ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({ success: true })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  return NextResponse.json({ id: params.id, body })
}
```

## Version History

- **v13.2.0**: Route Handlers introduced
- **v13.4.0**: App Router stable

## Good to Know

- Route handlers run server-side only
- Can be placed anywhere in the `app` directory
- Cannot coexist with `page.js` in the same segment
- Support Web Request and Response APIs
- Can use Edge or Node.js runtime
- Cached by default for GET requests with Response
- Use `dynamic` segment config to control caching
- Support streaming responses
- Can read and set cookies and headers
