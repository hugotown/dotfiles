---
name: pages-router-api-routes
description: Comprehensive guide to building API endpoints with Next.js Pages Router including request/response handling, dynamic routes, middleware patterns, authentication, and Edge API routes.
---

# Pages Router API Routes

API Routes provide a solution to build a REST API with Next.js. Any file inside the `pages/api` folder is mapped to `/api/*` and treated as an API endpoint instead of a page.

## Overview

API Routes features:

- **File-based routing** - Files in `pages/api` become API endpoints
- **Server-side only** - Code runs only on the server, never in the browser
- **Built-in parsing** - Automatic parsing of request body, query params, and cookies
- **Dynamic routes** - Support for dynamic API routes
- **Middleware support** - Custom middleware for authentication, logging, etc.
- **Edge Runtime** - Optional Edge runtime for better performance

## Basic API Route

### Simple Example

```typescript
// pages/api/hello.ts → /api/hello
import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  message: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({ message: 'Hello from Next.js!' });
}
```

### Request Methods

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  if (req.method === 'PUT') {
    return handlePut(req, res);
  }

  if (req.method === 'DELETE') {
    return handleDelete(req, res);
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}

function handleGet(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ method: 'GET' });
}

function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const { title, content } = req.body;
  res.status(201).json({ created: true, title, content });
}

function handlePut(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ method: 'PUT' });
}

function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  res.status(204).end();
}
```

## Request Object

### Query Parameters

```typescript
// /api/search?q=nextjs&page=1
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { q, page = '1' } = req.query;

  res.status(200).json({
    query: q,
    page: parseInt(page as string),
  });
}
```

### Request Body

```typescript
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, content, tags } = req.body;

  // Body is automatically parsed as JSON
  res.status(201).json({
    title,
    content,
    tags,
  });
}
```

### Cookies

```typescript
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Read cookies
  const { authToken } = req.cookies;

  if (!authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.status(200).json({ authenticated: true });
}
```

### Headers

```typescript
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const userAgent = req.headers['user-agent'];
  const contentType = req.headers['content-type'];
  const authorization = req.headers.authorization;

  res.status(200).json({
    userAgent,
    contentType,
    authorization,
  });
}
```

## Response Object

### JSON Response

```typescript
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    success: true,
    data: { id: 1, name: 'Example' },
  });
}
```

### Set Status Code

```typescript
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(201).json({ created: true }); // Created
  // res.status(204).end(); // No Content
  // res.status(400).json({ error: 'Bad Request' });
  // res.status(401).json({ error: 'Unauthorized' });
  // res.status(404).json({ error: 'Not Found' });
  // res.status(500).json({ error: 'Internal Server Error' });
}
```

### Set Headers

```typescript
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set single header
  res.setHeader('Content-Type', 'application/json');

  // Set multiple headers
  res.setHeader('Cache-Control', 's-maxage=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.status(200).json({ success: true });
}
```

### Set Cookies

```typescript
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set cookie
  res.setHeader('Set-Cookie', 'token=abc123; Path=/; HttpOnly; Secure');

  // Or use a cookie library
  // import { serialize } from 'cookie';
  // res.setHeader('Set-Cookie', serialize('token', 'abc123', {
  //   httpOnly: true,
  //   secure: process.env.NODE_ENV === 'production',
  //   maxAge: 60 * 60 * 24 * 7, // 1 week
  //   path: '/',
  // }));

  res.status(200).json({ authenticated: true });
}
```

### Redirect

```typescript
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.redirect(307, '/api/new-endpoint');
}
```

### Send File

```typescript
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const filePath = path.join(process.cwd(), 'public', 'file.pdf');
  const fileBuffer = fs.readFileSync(filePath);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=file.pdf');
  res.send(fileBuffer);
}
```

## Dynamic API Routes

### Single Parameter

```typescript
// pages/api/posts/[id].ts → /api/posts/:id
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const post = await getPost(id as string);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    return res.status(200).json(post);
  }

  if (req.method === 'PUT') {
    const post = await updatePost(id as string, req.body);
    return res.status(200).json(post);
  }

  if (req.method === 'DELETE') {
    await deletePost(id as string);
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

### Multiple Parameters

```typescript
// pages/api/users/[userId]/posts/[postId].ts
// → /api/users/:userId/posts/:postId
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { userId, postId } = req.query;

  const post = await getUserPost(userId as string, postId as string);

  res.status(200).json(post);
}
```

### Catch-All Routes

```typescript
// pages/api/[...path].ts → /api/*
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;

  // path is an array: /api/a/b/c → ['a', 'b', 'c']
  const fullPath = (path as string[]).join('/');

  res.status(200).json({
    path,
    fullPath,
    method: req.method,
  });
}
```

### Optional Catch-All Routes

```typescript
// pages/api/[[...params]].ts → /api, /api/*, /api/*/*
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { params = [] } = req.query;

  if ((params as string[]).length === 0) {
    return res.status(200).json({ message: 'API Root' });
  }

  res.status(200).json({ params });
}
```

## CRUD Operations

### Complete CRUD Example

```typescript
// pages/api/posts/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === 'GET') {
      // List all posts
      const posts = await db.post.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(posts);
    }

    if (req.method === 'POST') {
      // Create a new post
      const { title, content, authorId } = req.body;

      if (!title || !content) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const post = await db.post.create({
        data: {
          title,
          content,
          authorId,
        },
      });

      return res.status(201).json(post);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

```typescript
// pages/api/posts/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      // Get a single post
      const post = await db.post.findUnique({
        where: { id: id as string },
        include: { author: true },
      });

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      return res.status(200).json(post);
    }

    if (req.method === 'PUT') {
      // Update a post
      const { title, content } = req.body;

      const post = await db.post.update({
        where: { id: id as string },
        data: { title, content },
      });

      return res.status(200).json(post);
    }

    if (req.method === 'DELETE') {
      // Delete a post
      await db.post.delete({
        where: { id: id as string },
      });

      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

## Middleware Patterns

### Authentication Middleware

```typescript
// lib/withAuth.ts
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { verify } from 'jsonwebtoken';

export function withAuth(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const decoded = verify(token, process.env.JWT_SECRET!);
      (req as any).user = decoded;
      return handler(req, res);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// pages/api/protected.ts
import { withAuth } from '../../lib/withAuth';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user;
  res.status(200).json({ message: `Hello ${user.name}` });
}

export default withAuth(handler);
```

### CORS Middleware

```typescript
// lib/withCors.ts
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';

export function withCors(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,OPTIONS,PATCH,DELETE,POST,PUT'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    return handler(req, res);
  };
}

// Usage
export default withCors(handler);
```

### Rate Limiting

```typescript
// lib/rateLimit.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const rateLimit = new Map<string, { count: number; resetTime: number }>();

export function withRateLimit(
  handler: NextApiHandler,
  options = { maxRequests: 10, windowMs: 60000 }
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const key = `${ip}`;
    const now = Date.now();

    const record = rateLimit.get(key);

    if (!record || now > record.resetTime) {
      rateLimit.set(key, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      return handler(req, res);
    }

    if (record.count >= options.maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    record.count++;
    return handler(req, res);
  };
}
```

### Composing Middleware

```typescript
// lib/compose.ts
import type { NextApiHandler } from 'next';

export function compose(...middlewares: ((handler: NextApiHandler) => NextApiHandler)[]) {
  return (handler: NextApiHandler): NextApiHandler => {
    return middlewares.reduceRight(
      (wrapped, middleware) => middleware(wrapped),
      handler
    );
  };
}

// Usage
import { compose } from '../../lib/compose';
import { withAuth } from '../../lib/withAuth';
import { withCors } from '../../lib/withCors';
import { withRateLimit } from '../../lib/rateLimit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ message: 'Protected endpoint' });
}

export default compose(
  withCors,
  withRateLimit,
  withAuth
)(handler);
```

## Request Validation

### Using Zod

```typescript
import { z } from 'zod';
import type { NextApiRequest, NextApiResponse } from 'next';

const createPostSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  published: z.boolean().default(false),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = createPostSchema.parse(req.body);

    const post = await createPost(data);

    return res.status(201).json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        issues: error.issues,
      });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Validation Middleware

```typescript
// lib/withValidation.ts
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

export function withValidation(
  schema: z.ZodSchema,
  handler: NextApiHandler
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      req.body = schema.parse(req.body);
      return handler(req, res);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          issues: error.issues,
        });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Usage
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email, password } = req.body;
  // Email and password are validated
  res.status(200).json({ success: true });
}

export default withValidation(schema, handler);
```

## File Uploads

### Using Formidable

```typescript
// pages/api/upload.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs/promises';

// Disable body parsing
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({
    uploadDir: './uploads',
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Upload failed' });
    }

    const file = files.file;

    return res.status(200).json({
      success: true,
      filename: file.newFilename,
      size: file.size,
    });
  });
}
```

### Using Multer (Alternative)

```typescript
import multer from 'multer';
import type { NextApiRequest, NextApiResponse } from 'next';

const upload = multer({
  storage: multer.diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uploadMiddleware = upload.single('file');

  uploadMiddleware(req as any, res as any, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const file = (req as any).file;
    res.status(200).json({ filename: file.filename });
  });
}
```

## Edge API Routes

Edge API Routes run on the Edge Runtime for better performance and lower latency.

### Basic Edge API Route

```typescript
// pages/api/edge.ts
import type { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  return new Response(
    JSON.stringify({
      message: 'Hello from Edge!',
      location: req.geo?.city,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    }
  );
}
```

### Edge API with Request Body

```typescript
export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.json();

  return new Response(
    JSON.stringify({
      received: body,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    }
  );
}
```

### Edge API with Headers

```typescript
export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  const userAgent = req.headers.get('user-agent');
  const country = req.geo?.country;
  const city = req.geo?.city;

  return new Response(
    JSON.stringify({
      userAgent,
      country,
      city,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, s-maxage=60',
      },
    }
  );
}
```

## Error Handling

### Centralized Error Handler

```typescript
// lib/apiError.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorHandler(
  error: unknown,
  res: NextApiResponse
): NextApiResponse {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      issues: error.issues,
    });
  }

  console.error('Unhandled error:', error);

  return res.status(500).json({ error: 'Internal server error' });
}

// Usage
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (!req.body.email) {
      throw new ApiError(400, 'Email is required');
    }

    const user = await findUser(req.body.email);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return res.status(200).json(user);
  } catch (error) {
    return errorHandler(error, res);
  }
}
```

## Best Practices

### 1. Use TypeScript

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';

interface Post {
  id: string;
  title: string;
}

type Data = Post | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  // Type-safe response
  res.status(200).json({ id: '1', title: 'Hello' });
}
```

### 2. Validate Input

Always validate and sanitize user input using libraries like Zod or Yup.

### 3. Handle Errors

```typescript
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const data = await fetchData();
    return res.status(200).json(data);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 4. Use Appropriate Status Codes

- 200: Success
- 201: Created
- 204: No Content
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 405: Method Not Allowed
- 500: Internal Server Error

### 5. Implement Authentication

```typescript
const token = req.headers.authorization?.replace('Bearer ', '');

if (!token) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

### 6. Set Proper Headers

```typescript
res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
res.setHeader('Content-Type', 'application/json');
```

### 7. Use Environment Variables

```typescript
const apiKey = process.env.API_KEY;

if (req.headers['x-api-key'] !== apiKey) {
  return res.status(401).json({ error: 'Invalid API key' });
}
```

## Migration to App Router

API Routes in Pages Router become Route Handlers in App Router.

### Pages Router

```typescript
// pages/api/posts/[id].ts
export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const post = await getPost(id);
    return res.status(200).json(post);
  }

  return res.status(405).end();
}
```

### App Router

```typescript
// app/api/posts/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const post = await getPost(params.id);
  return Response.json(post);
}
```

## Resources

- [Next.js API Routes Documentation](https://nextjs.org/docs/pages/building-your-application/routing/api-routes)
- [API Middlewares](https://nextjs.org/docs/pages/building-your-application/routing/api-routes#api-middlewares)
- [Edge API Routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes#edge-api-routes)
