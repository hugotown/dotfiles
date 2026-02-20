# Search Implementation in Next.js App Router

Comprehensive guide for implementing search functionality including full-text search, third-party services, and database search strategies.

## Table of Contents
- [Database Full-Text Search](#database-full-text-search)
- [Algolia Integration](#algolia-integration)
- [Typesense Integration](#typesense-integration)
- [Client-Side Search](#client-side-search)
- [Search UI Patterns](#search-ui-patterns)
- [Advanced Features](#advanced-features)

## Database Full-Text Search

### PostgreSQL Full-Text Search

```prisma
// prisma/schema.prisma
model Post {
  id      String @id @default(cuid())
  title   String
  content String

  @@index([title, content], type: Fulltext)
}
```

```ts
// lib/search.ts
import { prisma } from '@/lib/prisma'

export async function searchPosts(query: string) {
  return await prisma.$queryRaw`
    SELECT *,
      ts_rank(
        to_tsvector('english', title || ' ' || content),
        plainto_tsquery('english', ${query})
      ) as rank
    FROM "Post"
    WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT 20
  `
}
```

### Prisma Full-Text Search (MySQL)

```ts
// app/actions.ts
'use server'

import { prisma } from '@/lib/prisma'

export async function searchPosts(query: string) {
  return await prisma.post.findMany({
    where: {
      OR: [
        { title: { search: query } },
        { content: { search: query } }
      ]
    },
    orderBy: {
      _relevance: {
        fields: ['title', 'content'],
        search: query,
        sort: 'desc'
      }
    }
  })
}
```

### Simple LIKE Search

```ts
// lib/queries.ts
import { prisma } from '@/lib/prisma'

export async function searchPostsSimple(query: string) {
  return await prisma.post.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } }
      ]
    },
    take: 20
  })
}
```

### Drizzle Full-Text Search

```ts
// lib/queries.ts
import { db } from '@/lib/db'
import { posts } from '@/lib/db/schema'
import { sql, or, like } from 'drizzle-orm'

export async function searchPosts(query: string) {
  const searchPattern = `%${query}%`

  return await db
    .select()
    .from(posts)
    .where(
      or(
        like(posts.title, searchPattern),
        like(posts.content, searchPattern)
      )
    )
    .limit(20)
}

// PostgreSQL full-text search with Drizzle
export async function searchPostsFullText(query: string) {
  return await db.execute(sql`
    SELECT *,
      ts_rank(
        to_tsvector('english', ${posts.title} || ' ' || ${posts.content}),
        plainto_tsquery('english', ${query})
      ) as rank
    FROM ${posts}
    WHERE to_tsvector('english', ${posts.title} || ' ' || ${posts.content})
      @@ plainto_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT 20
  `)
}
```

## Algolia Integration

### Setup Algolia

```bash
npm install algoliasearch
```

```ts
// lib/algolia.ts
import algoliasearch from 'algoliasearch'

const client = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
  process.env.ALGOLIA_ADMIN_KEY!
)

export const postsIndex = client.initIndex('posts')
```

### Index Data to Algolia

```ts
// lib/algolia-sync.ts
import { postsIndex } from '@/lib/algolia'
import { prisma } from '@/lib/prisma'

export async function syncPostToAlgolia(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { author: true }
  })

  if (!post) return

  await postsIndex.saveObject({
    objectID: post.id,
    title: post.title,
    content: post.content,
    author: post.author.name,
    createdAt: post.createdAt.getTime()
  })
}

export async function syncAllPosts() {
  const posts = await prisma.post.findMany({
    include: { author: true }
  })

  const records = posts.map(post => ({
    objectID: post.id,
    title: post.title,
    content: post.content,
    author: post.author.name,
    createdAt: post.createdAt.getTime()
  }))

  await postsIndex.saveObjects(records)
}

export async function deletePostFromAlgolia(postId: string) {
  await postsIndex.deleteObject(postId)
}
```

### Server-Side Search

```tsx
// app/actions.ts
'use server'

import { postsIndex } from '@/lib/algolia'

export async function searchPosts(query: string, page = 0) {
  const result = await postsIndex.search(query, {
    page,
    hitsPerPage: 20,
    attributesToRetrieve: ['title', 'content', 'author'],
    attributesToHighlight: ['title', 'content']
  })

  return {
    hits: result.hits,
    nbHits: result.nbHits,
    nbPages: result.nbPages
  }
}
```

### Client-Side InstantSearch

```bash
npm install react-instantsearch algoliasearch
```

```tsx
// components/AlgoliaSearch.tsx
'use client'

import { InstantSearch, SearchBox, Hits, Pagination } from 'react-instantsearch'
import algoliasearch from 'algoliasearch/lite'

const searchClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!
)

function Hit({ hit }: { hit: any }) {
  return (
    <article>
      <h2>{hit.title}</h2>
      <p>{hit.content.substring(0, 200)}...</p>
      <small>By {hit.author}</small>
    </article>
  )
}

export function AlgoliaSearch() {
  return (
    <InstantSearch
      searchClient={searchClient}
      indexName="posts"
    >
      <SearchBox />
      <Hits hitComponent={Hit} />
      <Pagination />
    </InstantSearch>
  )
}
```

### Configure Algolia Index

```ts
// scripts/configure-algolia.ts
import { postsIndex } from '@/lib/algolia'

async function configureIndex() {
  // Set searchable attributes
  await postsIndex.setSettings({
    searchableAttributes: [
      'title',
      'content',
      'author'
    ],
    attributesForFaceting: [
      'author',
      'category'
    ],
    customRanking: [
      'desc(createdAt)'
    ],
    ranking: [
      'typo',
      'geo',
      'words',
      'filters',
      'proximity',
      'attribute',
      'exact',
      'custom'
    ]
  })
}

configureIndex()
```

## Typesense Integration

### Setup Typesense

```bash
npm install typesense
```

```ts
// lib/typesense.ts
import Typesense from 'typesense'

export const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST!,
      port: 443,
      protocol: 'https'
    }
  ],
  apiKey: process.env.TYPESENSE_API_KEY!,
  connectionTimeoutSeconds: 2
})

export const postsCollection = 'posts'
```

### Create Collection Schema

```ts
// scripts/setup-typesense.ts
import { typesenseClient, postsCollection } from '@/lib/typesense'

async function createPostsCollection() {
  const schema = {
    name: postsCollection,
    fields: [
      { name: 'title', type: 'string' },
      { name: 'content', type: 'string' },
      { name: 'author', type: 'string', facet: true },
      { name: 'category', type: 'string', facet: true },
      { name: 'createdAt', type: 'int64' }
    ],
    default_sorting_field: 'createdAt'
  }

  await typesenseClient.collections().create(schema)
}

createPostsCollection()
```

### Index Documents

```ts
// lib/typesense-sync.ts
import { typesenseClient, postsCollection } from '@/lib/typesense'
import { prisma } from '@/lib/prisma'

export async function indexPost(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { author: true }
  })

  if (!post) return

  await typesenseClient
    .collections(postsCollection)
    .documents()
    .upsert({
      id: post.id,
      title: post.title,
      content: post.content,
      author: post.author.name,
      category: post.category,
      createdAt: post.createdAt.getTime()
    })
}

export async function deletePost(postId: string) {
  await typesenseClient
    .collections(postsCollection)
    .documents(postId)
    .delete()
}
```

### Search with Typesense

```tsx
// app/actions.ts
'use server'

import { typesenseClient, postsCollection } from '@/lib/typesense'

export async function searchPosts(
  query: string,
  filters?: { author?: string; category?: string }
) {
  const filterBy = []

  if (filters?.author) {
    filterBy.push(`author:=${filters.author}`)
  }

  if (filters?.category) {
    filterBy.push(`category:=${filters.category}`)
  }

  const searchParameters = {
    q: query,
    query_by: 'title,content',
    filter_by: filterBy.join(' && '),
    sort_by: 'createdAt:desc',
    per_page: 20
  }

  const results = await typesenseClient
    .collections(postsCollection)
    .documents()
    .search(searchParameters)

  return results.hits?.map(hit => hit.document) || []
}
```

## Client-Side Search

### Simple Client-Side Filter

```tsx
// components/ClientSearch.tsx
'use client'

import { useState, useMemo } from 'react'

type Post = {
  id: string
  title: string
  content: string
}

export function ClientSearch({ posts }: { posts: Post[] }) {
  const [query, setQuery] = useState('')

  const filteredPosts = useMemo(() => {
    if (!query) return posts

    const lowerQuery = query.toLowerCase()

    return posts.filter(
      post =>
        post.title.toLowerCase().includes(lowerQuery) ||
        post.content.toLowerCase().includes(lowerQuery)
    )
  }, [posts, query])

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search posts..."
      />

      <div>
        {filteredPosts.map(post => (
          <article key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.content.substring(0, 200)}...</p>
          </article>
        ))}
      </div>
    </div>
  )
}
```

### Fuse.js Fuzzy Search

```bash
npm install fuse.js
```

```tsx
// components/FuzzySearch.tsx
'use client'

import { useState, useMemo } from 'react'
import Fuse from 'fuse.js'

type Post = {
  id: string
  title: string
  content: string
  author: string
}

export function FuzzySearch({ posts }: { posts: Post[] }) {
  const [query, setQuery] = useState('')

  const fuse = useMemo(
    () =>
      new Fuse(posts, {
        keys: ['title', 'content', 'author'],
        threshold: 0.3,
        includeScore: true
      }),
    [posts]
  )

  const results = useMemo(() => {
    if (!query) return posts

    return fuse.search(query).map(result => result.item)
  }, [query, fuse, posts])

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search posts..."
      />

      <div>
        {results.map(post => (
          <article key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.content.substring(0, 200)}...</p>
            <small>By {post.author}</small>
          </article>
        ))}
      </div>
    </div>
  )
}
```

## Search UI Patterns

### Debounced Search Input

```tsx
// hooks/useDebounce.ts
'use client'

import { useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delay = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
```

```tsx
// components/DebouncedSearch.tsx
'use client'

import { useState, useEffect } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { searchPosts } from '@/app/actions'

export function DebouncedSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([])
      return
    }

    setLoading(true)

    searchPosts(debouncedQuery)
      .then(setResults)
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />

      {loading && <div>Searching...</div>}

      <div>
        {results.map(post => (
          <article key={post.id}>
            <h2>{post.title}</h2>
          </article>
        ))}
      </div>
    </div>
  )
}
```

### Search with URL State

```tsx
// app/search/page.tsx
'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { searchPosts } from '@/app/actions'

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }

    setLoading(true)
    searchPosts(query)
      .then(setResults)
      .finally(() => setLoading(false))
  }, [query])

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const q = formData.get('q') as string

    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <div>
      <form onSubmit={handleSearch}>
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search..."
        />
        <button type="submit">Search</button>
      </form>

      {loading && <div>Loading...</div>}

      <div>
        {results.map(post => (
          <article key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.content}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
```

### Autocomplete/Suggestions

```tsx
// components/Autocomplete.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { searchSuggestions } from '@/app/actions'

export function Autocomplete() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const debouncedQuery = useDebounce(query, 200)

  useEffect(() => {
    if (!debouncedQuery) {
      setSuggestions([])
      return
    }

    searchSuggestions(debouncedQuery).then(setSuggestions)
  }, [debouncedQuery])

  function handleSelect(suggestion: string) {
    setQuery(suggestion)
    setShowSuggestions(false)
    // Trigger search with selected suggestion
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        placeholder="Search..."
      />

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border rounded-md shadow-lg">
          {suggestions.map((suggestion, i) => (
            <li
              key={i}
              onClick={() => handleSelect(suggestion)}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

## Advanced Features

### Faceted Search

```tsx
// app/actions.ts
'use server'

import { prisma } from '@/lib/prisma'

export async function searchWithFacets(
  query: string,
  filters: { category?: string; author?: string } = {}
) {
  const where = {
    AND: [
      query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } }
            ]
          }
        : {},
      filters.category ? { category: filters.category } : {},
      filters.author ? { authorId: filters.author } : {}
    ].filter(Boolean)
  }

  const [posts, categories, authors] = await Promise.all([
    prisma.post.findMany({ where, take: 20 }),
    prisma.post.groupBy({
      by: ['category'],
      where: query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } }
            ]
          }
        : {},
      _count: true
    }),
    prisma.post.groupBy({
      by: ['authorId'],
      where: query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } }
            ]
          }
        : {},
      _count: true
    })
  ])

  return { posts, facets: { categories, authors } }
}
```

### Search Highlighting

```tsx
// lib/highlight.ts
export function highlightText(text: string, query: string): string {
  if (!query) return text

  const regex = new RegExp(`(${query})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}
```

```tsx
// components/HighlightedResult.tsx
import { highlightText } from '@/lib/highlight'

export function HighlightedResult({
  title,
  content,
  query
}: {
  title: string
  content: string
  query: string
}) {
  return (
    <article>
      <h2 dangerouslySetInnerHTML={{ __html: highlightText(title, query) }} />
      <p dangerouslySetInnerHTML={{ __html: highlightText(content, query) }} />
    </article>
  )
}
```

### Search Analytics

```tsx
// app/actions.ts
'use server'

import { prisma } from '@/lib/prisma'

export async function trackSearch(query: string, resultsCount: number) {
  await prisma.searchLog.create({
    data: {
      query,
      resultsCount,
      timestamp: new Date()
    }
  })
}

export async function getPopularSearches(limit = 10) {
  return await prisma.searchLog.groupBy({
    by: ['query'],
    _count: {
      query: true
    },
    orderBy: {
      _count: {
        query: 'desc'
      }
    },
    take: limit
  })
}
```

## Best Practices

1. **Choose the right solution**:
   - Simple apps: Database LIKE queries
   - Medium traffic: PostgreSQL full-text search
   - High traffic: Algolia or Typesense

2. **Debounce input** - Reduce API calls with debouncing

3. **Index strategically** - Index only searchable fields

4. **Pagination** - Limit results per page

5. **Caching** - Cache popular searches

6. **Analytics** - Track searches to improve results

7. **Synonyms** - Handle common synonyms and misspellings

8. **Relevance** - Order by relevance, not just recency

9. **Facets** - Provide filters for better refinement

10. **Performance** - Use indexes and optimize queries

## Resources

- [Algolia Documentation](https://www.algolia.com/doc/)
- [Typesense Documentation](https://typesense.org/docs/)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Fuse.js](https://fusejs.io/)
