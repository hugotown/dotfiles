# Database Integration in Next.js App Router

Comprehensive guide for integrating databases with Next.js App Router using Prisma, Drizzle, and direct SQL approaches.

## Table of Contents
- [Prisma Setup and Usage](#prisma-setup-and-usage)
- [Drizzle ORM](#drizzle-orm)
- [Direct SQL with Postgres.js](#direct-sql-with-postgresjs)
- [Connection Pooling](#connection-pooling)
- [Database Patterns](#database-patterns)
- [Migrations](#migrations)

## Prisma Setup and Usage

### Installation and Setup

```bash
npm install prisma @prisma/client
npx prisma init
```

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([authorId])
}
```

### Prisma Client Singleton

```ts
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Basic CRUD Operations

```tsx
// app/posts/page.tsx
import { prisma } from '@/lib/prisma'

export default async function PostsPage() {
  const posts = await prisma.post.findMany({
    include: {
      author: {
        select: {
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>By {post.author.name}</p>
        </article>
      ))}
    </div>
  )
}
```

### Server Actions with Prisma

```tsx
// app/actions.ts
'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const content = formData.get('content') as string
  const authorId = formData.get('authorId') as string

  const post = await prisma.post.create({
    data: {
      title,
      content,
      authorId
    }
  })

  revalidatePath('/posts')
  return post
}

export async function updatePost(id: string, data: { title?: string; content?: string }) {
  const post = await prisma.post.update({
    where: { id },
    data
  })

  revalidatePath(`/posts/${id}`)
  return post
}

export async function deletePost(id: string) {
  await prisma.post.delete({
    where: { id }
  })

  revalidatePath('/posts')
}
```

### Advanced Queries

```ts
// lib/queries.ts
import { prisma } from '@/lib/prisma'

export async function getPostWithComments(postId: string) {
  return await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: true,
      comments: {
        include: {
          author: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  })
}

export async function searchPosts(query: string) {
  return await prisma.post.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } }
      ]
    },
    include: {
      author: {
        select: {
          name: true
        }
      }
    }
  })
}

export async function getPaginatedPosts(page = 1, pageSize = 10) {
  const skip = (page - 1) * pageSize

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      skip,
      take: pageSize,
      include: {
        author: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.post.count()
  ])

  return {
    posts,
    total,
    pages: Math.ceil(total / pageSize)
  }
}
```

### Transactions

```ts
// app/actions.ts
'use server'

import { prisma } from '@/lib/prisma'

export async function transferOwnership(postId: string, newOwnerId: string) {
  return await prisma.$transaction(async (tx) => {
    // Get current post
    const post = await tx.post.findUniqueOrThrow({
      where: { id: postId }
    })

    // Update post owner
    const updatedPost = await tx.post.update({
      where: { id: postId },
      data: { authorId: newOwnerId }
    })

    // Create audit log
    await tx.auditLog.create({
      data: {
        action: 'TRANSFER_OWNERSHIP',
        entityType: 'POST',
        entityId: postId,
        oldValue: post.authorId,
        newValue: newOwnerId
      }
    })

    return updatedPost
  })
}
```

## Drizzle ORM

### Installation and Setup

```bash
npm install drizzle-orm pg
npm install -D drizzle-kit
```

```ts
// lib/db/schema.ts
import { pgTable, text, timestamp, boolean, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

export const posts = pgTable('posts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  published: boolean('published').default(false).notNull(),
  authorId: text('author_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts)
}))

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id]
  })
}))
```

### Database Client

```ts
// lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client, { schema })
```

### Queries with Drizzle

```ts
// lib/queries.ts
import { db } from '@/lib/db'
import { posts, users } from '@/lib/db/schema'
import { eq, desc, like, or } from 'drizzle-orm'

export async function getAllPosts() {
  return await db.query.posts.findMany({
    with: {
      author: {
        columns: {
          name: true,
          email: true
        }
      }
    },
    orderBy: [desc(posts.createdAt)]
  })
}

export async function getPostById(id: string) {
  return await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: {
      author: true
    }
  })
}

export async function searchPosts(query: string) {
  return await db.query.posts.findMany({
    where: or(
      like(posts.title, `%${query}%`),
      like(posts.content, `%${query}%`)
    ),
    with: {
      author: true
    }
  })
}
```

### Mutations with Drizzle

```tsx
// app/actions.ts
'use server'

import { db } from '@/lib/db'
import { posts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createPost(data: {
  title: string
  content: string
  authorId: string
}) {
  const [post] = await db.insert(posts).values(data).returning()

  revalidatePath('/posts')
  return post
}

export async function updatePost(id: string, data: {
  title?: string
  content?: string
  published?: boolean
}) {
  const [post] = await db
    .update(posts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(posts.id, id))
    .returning()

  revalidatePath(`/posts/${id}`)
  return post
}

export async function deletePost(id: string) {
  await db.delete(posts).where(eq(posts.id, id))
  revalidatePath('/posts')
}
```

## Direct SQL with Postgres.js

### Setup

```bash
npm install postgres
```

```ts
// lib/db.ts
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10
})

export default sql
```

### Raw SQL Queries

```ts
// lib/queries.ts
import sql from '@/lib/db'

export async function getPosts() {
  return await sql`
    SELECT
      p.*,
      json_build_object(
        'id', u.id,
        'name', u.name,
        'email', u.email
      ) as author
    FROM posts p
    JOIN users u ON p.author_id = u.id
    ORDER BY p.created_at DESC
  `
}

export async function getPostById(id: string) {
  const [post] = await sql`
    SELECT
      p.*,
      json_build_object(
        'id', u.id,
        'name', u.name,
        'email', u.email
      ) as author
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.id = ${id}
  `
  return post
}

export async function createPost(data: {
  title: string
  content: string
  authorId: string
}) {
  const [post] = await sql`
    INSERT INTO posts (title, content, author_id)
    VALUES (${data.title}, ${data.content}, ${data.authorId})
    RETURNING *
  `
  return post
}
```

### SQL Transactions

```ts
// app/actions.ts
'use server'

import sql from '@/lib/db'

export async function createPostWithTags(
  postData: { title: string; content: string; authorId: string },
  tags: string[]
) {
  return await sql.begin(async (tx) => {
    // Create post
    const [post] = await tx`
      INSERT INTO posts (title, content, author_id)
      VALUES (${postData.title}, ${postData.content}, ${postData.authorId})
      RETURNING *
    `

    // Create tags
    if (tags.length > 0) {
      await tx`
        INSERT INTO post_tags (post_id, tag)
        SELECT ${post.id}, tag
        FROM UNNEST(${tags}::text[]) as tag
      `
    }

    return post
  })
}
```

## Connection Pooling

### Prisma with Connection Pooling

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

```env
# .env
DATABASE_URL="postgresql://user:password@pooler.example.com:5432/db?pgbouncer=true"
DIRECT_URL="postgresql://user:password@db.example.com:5432/db"
```

### Custom Connection Pool with postgres.js

```ts
// lib/db.ts
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, {
  max: 20, // Maximum pool size
  idle_timeout: 20, // Close idle connections after 20s
  max_lifetime: 60 * 30, // Close connections after 30 minutes
  connect_timeout: 10,
  prepare: false, // Required for PgBouncer
  onnotice: () => {}, // Silence notices
})

export default sql
```

### Serverless Connection Management

```ts
// lib/db-serverless.ts
import { Pool } from '@neondatabase/serverless'

// For serverless environments (Vercel, AWS Lambda, etc.)
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function query<T>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result.rows
  } finally {
    client.release()
  }
}
```

## Database Patterns

### Repository Pattern

```ts
// lib/repositories/post-repository.ts
import { prisma } from '@/lib/prisma'

export class PostRepository {
  async findAll() {
    return await prisma.post.findMany({
      include: { author: true }
    })
  }

  async findById(id: string) {
    return await prisma.post.findUnique({
      where: { id },
      include: { author: true }
    })
  }

  async create(data: {
    title: string
    content: string
    authorId: string
  }) {
    return await prisma.post.create({ data })
  }

  async update(id: string, data: Partial<{
    title: string
    content: string
    published: boolean
  }>) {
    return await prisma.post.update({
      where: { id },
      data
    })
  }

  async delete(id: string) {
    return await prisma.post.delete({
      where: { id }
    })
  }
}

export const postRepository = new PostRepository()
```

### Data Access Layer

```ts
// lib/dal.ts
import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export const getCurrentUser = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) return null

  return await prisma.user.findUnique({
    where: { id: session.user.id }
  })
})

export const getUserPosts = cache(async (userId: string) => {
  return await prisma.post.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: 'desc' }
  })
})
```

### Soft Deletes

```prisma
// prisma/schema.prisma
model Post {
  id        String    @id @default(cuid())
  title     String
  content   String?
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

```ts
// lib/queries.ts
import { prisma } from '@/lib/prisma'

export async function getActivePosts() {
  return await prisma.post.findMany({
    where: {
      deletedAt: null
    }
  })
}

export async function softDeletePost(id: string) {
  return await prisma.post.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}

export async function restorePost(id: string) {
  return await prisma.post.update({
    where: { id },
    data: { deletedAt: null }
  })
}
```

## Migrations

### Prisma Migrations

```bash
# Create a new migration
npx prisma migrate dev --name add_user_role

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Generate Prisma Client after schema changes
npx prisma generate
```

### Drizzle Migrations

```ts
// drizzle.config.ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!
  }
} satisfies Config
```

```bash
# Generate migrations
npx drizzle-kit generate:pg

# Apply migrations
npx drizzle-kit push:pg

# Open Drizzle Studio
npx drizzle-kit studio
```

### Custom Migration Script

```ts
// scripts/migrate.ts
import sql from '@/lib/db'

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      published BOOLEAN DEFAULT FALSE,
      author_id TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  console.log('Migrations completed')
  await sql.end()
}

migrate()
```

## Best Practices

1. **Use connection pooling** - Essential for serverless environments
2. **Singleton pattern** - One database client instance
3. **Type safety** - Use Prisma or Drizzle for type-safe queries
4. **Prepared statements** - Prevent SQL injection
5. **Transactions** - Use for related operations that must succeed/fail together
6. **Indexes** - Add indexes for frequently queried fields
7. **Soft deletes** - For data that might need recovery
8. **Repository pattern** - Separate data access logic
9. **Cache queries** - Use React's `cache()` for request-level caching
10. **Error handling** - Catch and handle database errors gracefully

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [postgres.js Documentation](https://github.com/porsager/postgres)
- [Next.js Database Guide](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating)
