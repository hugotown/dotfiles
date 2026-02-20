# Edge Runtime

## Overview

The Edge Runtime is a lightweight JavaScript runtime optimized for edge computing. It runs code closer to users, providing lower latency and better performance. The Edge Runtime is based on Web Standards and supports a subset of Node.js APIs.

**Key Benefits:**
- ⚡ Low latency (runs near users)
- 🚀 Fast cold starts (<1ms)
- 🌍 Global distribution
- 💰 Cost-effective
- 🔒 Secure sandbox environment

## Architecture

### Runtime Environment

```
Request → Edge Network → Edge Function → Response
         (Global CDN)   (Edge Runtime)
```

**Components:**
1. **V8 Engine**: JavaScript execution
2. **Web Standards APIs**: Fetch, Headers, Request, Response
3. **Edge Middleware**: Request/response interception
4. **Global Distribution**: Runs on CDN nodes worldwide

### Deployment Model

```
Code → Build → Deploy → Edge Nodes (globally distributed)
```

## Use Cases

### 1. Authentication & Authorization

Check authentication at the edge:

```javascript
// middleware.ts
export const config = {
  runtime: 'edge',
}

export function middleware(request) {
  const token = request.cookies.get('auth-token')

  if (!token) {
    return Response.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}
```

### 2. Geo-Location & Personalization

Serve content based on location:

```javascript
// app/api/location/route.ts
export const runtime = 'edge'

export async function GET(request) {
  const country = request.geo?.country || 'US'
  const city = request.geo?.city || 'Unknown'

  return Response.json({
    country,
    city,
    message: `Hello from ${city}, ${country}!`,
  })
}
```

### 3. A/B Testing

Route users to different variants:

```javascript
// middleware.ts
export const config = {
  runtime: 'edge',
}

export function middleware(request) {
  const variant = Math.random() > 0.5 ? 'A' : 'B'
  const response = NextResponse.next()

  response.cookies.set('ab-test', variant)

  if (variant === 'B') {
    return NextResponse.rewrite(new URL('/variant-b', request.url))
  }

  return response
}
```

### 4. Rate Limiting

Protect APIs from abuse:

```javascript
// app/api/protected/route.ts
export const runtime = 'edge'

const rateLimiter = new Map()

export async function GET(request) {
  const ip = request.ip || 'unknown'
  const now = Date.now()
  const windowMs = 60000 // 1 minute
  const maxRequests = 10

  const userRequests = rateLimiter.get(ip) || []
  const recentRequests = userRequests.filter(time => now - time < windowMs)

  if (recentRequests.length >= maxRequests) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }

  recentRequests.push(now)
  rateLimiter.set(ip, recentRequests)

  return Response.json({ data: 'Protected content' })
}
```

### 5. Request Rewriting

Modify requests on the fly:

```javascript
// middleware.ts
export const config = {
  runtime: 'edge',
}

export function middleware(request) {
  const url = request.nextUrl

  // Rewrite /old-path to /new-path
  if (url.pathname === '/old-path') {
    return NextResponse.rewrite(new URL('/new-path', request.url))
  }

  return NextResponse.next()
}
```

## Supported APIs

### ✅ Web Standard APIs

**Fetch API:**
```javascript
export const runtime = 'edge'

export async function GET() {
  const response = await fetch('https://api.example.com/data')
  const data = await response.json()
  return Response.json(data)
}
```

**URL API:**
```javascript
const url = new URL(request.url)
url.searchParams.set('source', 'edge')
```

**Headers API:**
```javascript
const headers = new Headers()
headers.set('X-Custom-Header', 'value')
```

**Request/Response API:**
```javascript
const response = new Response('Hello', {
  status: 200,
  headers: { 'Content-Type': 'text/plain' },
})
```

**Crypto API:**
```javascript
const randomBytes = crypto.getRandomValues(new Uint8Array(32))
const hash = await crypto.subtle.digest('SHA-256', data)
```

**TextEncoder/TextDecoder:**
```javascript
const encoder = new TextEncoder()
const bytes = encoder.encode('Hello')

const decoder = new TextDecoder()
const text = decoder.decode(bytes)
```

**Streams API:**
```javascript
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue('chunk 1')
    controller.enqueue('chunk 2')
    controller.close()
  },
})
```

### ⚠️ Limited Node.js APIs

**Environment Variables:**
```javascript
// ✅ Available
const apiKey = process.env.API_KEY

// ❌ Not available
process.cwd()
process.exit()
```

**Buffer (limited):**
```javascript
// ✅ Basic buffer operations
const buffer = Buffer.from('hello')

// ❌ Some advanced operations not supported
```

### ❌ Unsupported APIs

- **File System**: No `fs` module
- **Child Process**: No `child_process`
- **Native Modules**: No native addons
- **Synchronous Operations**: Limited sync APIs
- **Dynamic Imports**: Some restrictions

## Configuration

### Enable Edge Runtime

**API Routes:**
```javascript
// app/api/edge/route.ts
export const runtime = 'edge'

export async function GET() {
  return Response.json({ message: 'Hello from Edge' })
}
```

**Middleware:**
```javascript
// middleware.ts
export const config = {
  runtime: 'edge',
}

export function middleware(request) {
  return NextResponse.next()
}
```

**Route Handlers:**
```javascript
// app/api/route.ts
export const runtime = 'edge'
export const preferredRegion = 'iad1' // Optional: specify region

export async function GET() {
  return Response.json({ data: 'edge response' })
}
```

### Runtime Configuration

```javascript
// app/api/edge/route.ts
export const runtime = 'edge'
export const dynamic = 'force-dynamic' // Disable static optimization
export const fetchCache = 'force-no-store' // Disable fetch cache
export const preferredRegion = ['iad1', 'sfo1'] // Preferred regions
```

### Middleware Configuration

```javascript
// middleware.ts
export const config = {
  runtime: 'edge',
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

## Request/Response Handling

### Reading Request Data

```javascript
export const runtime = 'edge'

export async function POST(request) {
  // JSON body
  const body = await request.json()

  // Form data
  const formData = await request.formData()

  // Text
  const text = await request.text()

  // Headers
  const auth = request.headers.get('authorization')

  // Cookies
  const token = request.cookies.get('token')

  // URL parameters
  const url = new URL(request.url)
  const id = url.searchParams.get('id')

  // Geo location
  const country = request.geo?.country
  const city = request.geo?.city

  // IP address
  const ip = request.ip

  return Response.json({ received: true })
}
```

### Creating Responses

```javascript
export const runtime = 'edge'

export async function GET() {
  // JSON response
  return Response.json({ data: 'value' })

  // Text response
  return new Response('Hello World', {
    headers: { 'Content-Type': 'text/plain' },
  })

  // Redirect
  return Response.redirect('https://example.com')

  // Streaming response
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue('data chunk')
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}
```

### Using NextResponse

```javascript
import { NextResponse } from 'next/server'

export const runtime = 'edge'

export function GET(request) {
  const response = NextResponse.json({ data: 'value' })

  // Set cookies
  response.cookies.set('name', 'value', {
    httpOnly: true,
    secure: true,
    maxAge: 3600,
  })

  // Set headers
  response.headers.set('X-Custom-Header', 'value')

  return response
}
```

## Performance Optimization

### 1. Minimize Code Size

Edge functions have size limits:

```javascript
// ❌ Large dependencies
import _ from 'lodash' // Too large

// ✅ Use native APIs
const unique = [...new Set(array)]
```

### 2. Use Caching

```javascript
export const runtime = 'edge'

const cache = new Map()

export async function GET(request) {
  const key = new URL(request.url).pathname

  if (cache.has(key)) {
    return Response.json(cache.get(key))
  }

  const data = await fetchData()
  cache.set(key, data)

  return Response.json(data)
}
```

### 3. Optimize External Requests

```javascript
export const runtime = 'edge'

export async function GET() {
  // Parallel requests
  const [users, posts] = await Promise.all([
    fetch('https://api.example.com/users'),
    fetch('https://api.example.com/posts'),
  ])

  return Response.json({
    users: await users.json(),
    posts: await posts.json(),
  })
}
```

### 4. Regional Deployment

```javascript
export const runtime = 'edge'
// Deploy to regions close to your data sources
export const preferredRegion = ['iad1', 'sfo1']
```

## Limitations

### Size Limits

- **Bundle Size**: ~1MB compressed
- **Response Size**: ~4MB
- **Execution Time**: 30 seconds (varies by platform)

### API Restrictions

```javascript
// ❌ Not available in Edge Runtime
const fs = require('fs') // No file system
const { spawn } = require('child_process') // No child processes
const crypto = require('crypto') // Use Web Crypto instead
```

### Memory Limits

Edge functions have limited memory:

```javascript
// ❌ Memory-intensive operations
const largeArray = new Array(10000000).fill(0)

// ✅ Streaming for large data
const stream = new ReadableStream({
  async start(controller) {
    for (let i = 0; i < 1000; i++) {
      controller.enqueue(await fetchChunk(i))
    }
    controller.close()
  },
})
```

### No Native Dependencies

```javascript
// ❌ Native modules not supported
const sharp = require('sharp')

// ✅ Use web APIs or SaaS alternatives
const imageResponse = await fetch('https://image-service.com/resize')
```

## Debugging

### Local Development

```bash
# Edge runtime works in local dev
next dev

# Test edge functions at localhost:3000/api/edge
```

### Logging

```javascript
export const runtime = 'edge'

export async function GET() {
  console.log('Edge function called')
  console.error('Edge error')

  return Response.json({ logged: true })
}
```

### Error Handling

```javascript
export const runtime = 'edge'

export async function GET() {
  try {
    const data = await fetch('https://api.example.com/data')
    return Response.json(await data.json())
  } catch (error) {
    console.error('Edge error:', error)
    return Response.json(
      { error: 'Internal error' },
      { status: 500 }
    )
  }
}
```

### Testing

```javascript
// __tests__/edge.test.js
import { GET } from '../app/api/edge/route'

describe('Edge Function', () => {
  it('returns JSON response', async () => {
    const request = new Request('http://localhost:3000/api/edge')
    const response = await GET(request)
    const data = await response.json()

    expect(data).toHaveProperty('message')
  })
})
```

## Best Practices

### 1. Use for Lightweight Operations

```javascript
// ✅ Good use case: Authentication check
export const runtime = 'edge'

export function middleware(request) {
  const token = request.cookies.get('token')
  if (!token) {
    return Response.redirect('/login')
  }
  return NextResponse.next()
}
```

### 2. Avoid Heavy Computation

```javascript
// ❌ Bad: Heavy processing
export const runtime = 'edge'

export async function POST(request) {
  const video = await request.blob()
  const processed = await processLargeVideo(video) // Too heavy
  return Response.json({ processed })
}

// ✅ Good: Offload to serverless function
export async function POST(request) {
  // Trigger background job
  await queue.add({ videoId: id })
  return Response.json({ queued: true })
}
```

### 3. Handle Errors Gracefully

```javascript
export const runtime = 'edge'

export async function GET() {
  try {
    const data = await fetchData()
    return Response.json(data)
  } catch (error) {
    return Response.json(
      { error: 'Service unavailable' },
      { status: 503 }
    )
  }
}
```

### 4. Use Appropriate Caching

```javascript
export const runtime = 'edge'

export async function GET() {
  const data = await fetch('https://api.example.com/data', {
    // Cache for 1 hour
    next: { revalidate: 3600 },
  })

  return Response.json(await data.json())
}
```

### 5. Monitor Performance

```javascript
export const runtime = 'edge'

export async function GET() {
  const start = Date.now()

  const data = await fetchData()

  const duration = Date.now() - start
  console.log('Edge function took', duration, 'ms')

  return Response.json(data)
}
```

## Migration from Serverless

### Serverless Function

```javascript
// app/api/serverless/route.ts
import fs from 'fs' // Node.js API
import { processData } from 'heavy-library'

export async function GET() {
  const file = fs.readFileSync('./data.json')
  const processed = await processData(file)
  return Response.json(processed)
}
```

### Edge Function

```javascript
// app/api/edge/route.ts
export const runtime = 'edge'

export async function GET() {
  // Fetch from external source instead of file system
  const response = await fetch('https://cdn.example.com/data.json')
  const data = await response.json()

  // Use lightweight processing
  const processed = simpleTransform(data)

  return Response.json(processed)
}
```

## Resources

- [Edge Runtime Documentation](https://edge-runtime.vercel.app/)
- [Next.js Edge Runtime](https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes)
- [Web Standard APIs](https://developer.mozilla.org/en-US/docs/Web/API)
- [Vercel Edge Functions](https://vercel.com/docs/concepts/functions/edge-functions)
