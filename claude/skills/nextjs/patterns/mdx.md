# MDX Integration in Next.js

Complete guide to integrating MDX (Markdown with JSX) in Next.js applications for content-driven sites, documentation, and blogs.

## Table of Contents

1. [MDX Basics](#mdx-basics)
2. [Setup and Configuration](#setup-and-configuration)
3. [File-Based Routing](#file-based-routing)
4. [Custom Components](#custom-components)
5. [Remote MDX](#remote-mdx)
6. [Content Collections](#content-collections)
7. [Syntax Highlighting](#syntax-highlighting)
8. [Best Practices](#best-practices)

## MDX Basics

### What is MDX?

MDX allows you to write JSX directly in Markdown files, combining the simplicity of Markdown with the power of React components.

```mdx
# Hello, World!

This is regular Markdown content.

<CustomButton>Click me!</CustomButton>

You can mix **Markdown** and <strong>HTML/JSX</strong> seamlessly.

import { Chart } from './components/Chart'

<Chart data={myData} />
```

### Use Cases

- Technical documentation
- Blogs with interactive elements
- Marketing pages with custom components
- Educational content
- API documentation

## Setup and Configuration

### Installation

```bash
npm install @next/mdx @mdx-js/loader @mdx-js/react @types/mdx
# or
pnpm add @next/mdx @mdx-js/loader @mdx-js/react @types/mdx
```

### Next.js Configuration

```javascript
// next.config.js
const withMDX = require('@next/mdx')({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
    providerImportSource: '@mdx-js/react',
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  experimental: {
    mdxRs: true, // Use Rust-based MDX compiler for better performance
  },
}

module.exports = withMDX(nextConfig)
```

### TypeScript Configuration

```typescript
// mdx.d.ts
declare module '*.mdx' {
  import { MDXProps } from 'mdx/types'
  export default function MDXContent(props: MDXProps): JSX.Element
}
```

### MDX Provider Setup (App Router)

```typescript
// app/layout.tsx
import { MDXProvider } from '@/components/MDXProvider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <MDXProvider>{children}</MDXProvider>
      </body>
    </html>
  )
}
```

```typescript
// components/MDXProvider.tsx
'use client'

import { MDXProvider as BaseMDXProvider } from '@mdx-js/react'
import { ComponentPropsWithoutRef } from 'react'

const components = {
  h1: (props: ComponentPropsWithoutRef<'h1'>) => (
    <h1 className="text-4xl font-bold mt-8 mb-4" {...props} />
  ),
  h2: (props: ComponentPropsWithoutRef<'h2'>) => (
    <h2 className="text-3xl font-semibold mt-6 mb-3" {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<'p'>) => (
    <p className="mb-4 leading-7" {...props} />
  ),
  a: (props: ComponentPropsWithoutRef<'a'>) => (
    <a className="text-blue-600 hover:underline" {...props} />
  ),
  code: (props: ComponentPropsWithoutRef<'code'>) => (
    <code className="bg-gray-100 rounded px-1 py-0.5" {...props} />
  ),
}

export function MDXProvider({ children }: { children: React.ReactNode }) {
  return <BaseMDXProvider components={components}>{children}</BaseMDXProvider>
}
```

## File-Based Routing

### Pages Router Approach

```mdx
<!-- pages/blog/my-post.mdx -->
---
title: My First Post
date: 2024-01-15
author: John Doe
---

# {frontmatter.title}

Published on {frontmatter.date} by {frontmatter.author}

This is my first blog post written in MDX!

<CustomComponent />
```

```typescript
// pages/blog/[slug].tsx
import dynamic from 'next/dynamic'

export default function BlogPost({ slug }: { slug: string }) {
  const MDXContent = dynamic(() => import(`@/content/blog/${slug}.mdx`))

  return (
    <article>
      <MDXContent />
    </article>
  )
}
```

### App Router Approach

```typescript
// app/blog/[slug]/page.tsx
import { compileMDX } from 'next-mdx-remote/rsc'
import fs from 'fs'
import path from 'path'

interface Frontmatter {
  title: string
  date: string
  author: string
}

async function getPost(slug: string) {
  const filePath = path.join(process.cwd(), 'content', 'blog', `${slug}.mdx`)
  const source = fs.readFileSync(filePath, 'utf-8')

  const { content, frontmatter } = await compileMDX<Frontmatter>({
    source,
    options: { parseFrontmatter: true },
  })

  return { content, frontmatter }
}

export async function generateStaticParams() {
  const contentDir = path.join(process.cwd(), 'content', 'blog')
  const files = fs.readdirSync(contentDir)

  return files
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => ({
      slug: file.replace('.mdx', ''),
    }))
}

export default async function BlogPost({
  params,
}: {
  params: { slug: string }
}) {
  const { content, frontmatter } = await getPost(params.slug)

  return (
    <article>
      <h1>{frontmatter.title}</h1>
      <p>
        By {frontmatter.author} on {frontmatter.date}
      </p>
      <div>{content}</div>
    </article>
  )
}
```

## Custom Components

### Define Custom Components

```typescript
// components/mdx/Callout.tsx
export function Callout({
  type = 'info',
  children,
}: {
  type?: 'info' | 'warning' | 'error' | 'success'
  children: React.ReactNode
}) {
  const styles = {
    info: 'bg-blue-50 border-blue-500 text-blue-900',
    warning: 'bg-yellow-50 border-yellow-500 text-yellow-900',
    error: 'bg-red-50 border-red-500 text-red-900',
    success: 'bg-green-50 border-green-500 text-green-900',
  }

  return (
    <div className={`border-l-4 p-4 my-4 ${styles[type]}`}>
      {children}
    </div>
  )
}
```

```typescript
// components/mdx/CodeBlock.tsx
'use client'

import { useState } from 'react'

export function CodeBlock({
  children,
  language,
}: {
  children: string
  language: string
}) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
        <code className={`language-${language}`}>{children}</code>
      </pre>
      <button
        onClick={copyToClipboard}
        className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}
```

### Component Registry

```typescript
// components/mdx/components.tsx
import { Callout } from './Callout'
import { CodeBlock } from './CodeBlock'
import { Chart } from './Chart'
import { Tweet } from './Tweet'

export const mdxComponents = {
  Callout,
  CodeBlock,
  Chart,
  Tweet,
  // Override default HTML elements
  pre: (props: any) => <CodeBlock {...props} />,
  blockquote: (props: any) => (
    <Callout type="info" {...props} />
  ),
}
```

### Using Components in MDX

```mdx
<!-- content/blog/my-post.mdx -->
# My Interactive Post

<Callout type="warning">
  This is an important warning message!
</Callout>

<Chart
  data={[
    { label: 'Jan', value: 10 },
    { label: 'Feb', value: 20 },
  ]}
/>

<Tweet id="1234567890" />
```

## Remote MDX

### Using next-mdx-remote

```bash
npm install next-mdx-remote
```

```typescript
// app/blog/[slug]/page.tsx
import { MDXRemote } from 'next-mdx-remote/rsc'
import { mdxComponents } from '@/components/mdx/components'

async function getPostFromCMS(slug: string) {
  const response = await fetch(`https://api.example.com/posts/${slug}`)
  const post = await response.json()
  return post
}

export default async function BlogPost({
  params,
}: {
  params: { slug: string }
}) {
  const post = await getPostFromCMS(params.slug)

  return (
    <article>
      <h1>{post.title}</h1>
      <MDXRemote source={post.content} components={mdxComponents} />
    </article>
  )
}
```

### Custom MDX Components with Remote Content

```typescript
// app/docs/[...slug]/page.tsx
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypePrettyCode from 'rehype-pretty-code'

const components = {
  h1: (props: any) => <h1 className="text-4xl font-bold" {...props} />,
  code: (props: any) => <code className="bg-gray-100 px-1 rounded" {...props} />,
}

const options = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [[rehypePrettyCode, { theme: 'github-dark' }]],
  },
}

export default async function DocsPage({
  params,
}: {
  params: { slug: string[] }
}) {
  const content = await fetchDocContent(params.slug.join('/'))

  return (
    <div className="prose">
      <MDXRemote
        source={content}
        components={components}
        options={options}
      />
    </div>
  )
}
```

## Content Collections

### Organize Content

```
content/
├── blog/
│   ├── 2024-01-15-first-post.mdx
│   ├── 2024-01-20-second-post.mdx
│   └── 2024-02-01-third-post.mdx
├── docs/
│   ├── getting-started.mdx
│   ├── installation.mdx
│   └── configuration.mdx
└── authors/
    ├── john-doe.mdx
    └── jane-smith.mdx
```

### Content Utilities

```typescript
// lib/mdx.ts
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const contentDirectory = path.join(process.cwd(), 'content')

export function getContentBySlug(collection: string, slug: string) {
  const filePath = path.join(contentDirectory, collection, `${slug}.mdx`)
  const fileContents = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(fileContents)

  return {
    slug,
    frontmatter: data,
    content,
  }
}

export function getAllContent(collection: string) {
  const collectionPath = path.join(contentDirectory, collection)
  const files = fs.readdirSync(collectionPath)

  return files
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      const slug = file.replace('.mdx', '')
      return getContentBySlug(collection, slug)
    })
    .sort((a, b) => {
      return new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
    })
}

export function getCollectionByTag(collection: string, tag: string) {
  const allContent = getAllContent(collection)

  return allContent.filter((item) =>
    item.frontmatter.tags?.includes(tag)
  )
}
```

### Blog List Page

```typescript
// app/blog/page.tsx
import Link from 'next/link'
import { getAllContent } from '@/lib/mdx'

export default function BlogIndex() {
  const posts = getAllContent('blog')

  return (
    <div>
      <h1>Blog Posts</h1>
      <div className="grid gap-6">
        {posts.map((post) => (
          <article key={post.slug} className="border rounded p-6">
            <Link href={`/blog/${post.slug}`}>
              <h2 className="text-2xl font-bold mb-2">
                {post.frontmatter.title}
              </h2>
            </Link>
            <p className="text-gray-600 mb-4">
              {post.frontmatter.excerpt}
            </p>
            <div className="flex gap-4 text-sm text-gray-500">
              <span>{post.frontmatter.date}</span>
              <span>By {post.frontmatter.author}</span>
            </div>
            {post.frontmatter.tags && (
              <div className="flex gap-2 mt-4">
                {post.frontmatter.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="bg-gray-200 px-2 py-1 rounded text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
```

## Syntax Highlighting

### Using rehype-pretty-code

```bash
npm install rehype-pretty-code shiki
```

```javascript
// next.config.js
const withMDX = require('@next/mdx')({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [
      [
        require('rehype-pretty-code'),
        {
          theme: 'github-dark',
          onVisitLine(node) {
            // Prevent lines from collapsing
            if (node.children.length === 0) {
              node.children = [{ type: 'text', value: ' ' }]
            }
          },
          onVisitHighlightedLine(node) {
            node.properties.className.push('highlighted')
          },
          onVisitHighlightedWord(node) {
            node.properties.className = ['word']
          },
        },
      ],
    ],
  },
})

module.exports = withMDX({
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
})
```

### Code Block with Line Numbers

```mdx
```typescript showLineNumbers {1,3-5}
function hello() {
  console.log('Hello')
  console.log('World')
  return true
}
```
```

### Custom Code Styles

```css
/* styles/code.css */
.highlighted {
  background-color: rgba(255, 255, 0, 0.1);
  border-left: 2px solid yellow;
  padding-left: 0.5rem;
}

.word {
  background-color: rgba(255, 255, 0, 0.2);
  padding: 0.2rem;
  border-radius: 0.25rem;
}

pre {
  padding: 1rem;
  overflow-x: auto;
  border-radius: 0.5rem;
}

code {
  font-family: 'Fira Code', monospace;
  font-size: 0.9rem;
}
```

## Plugins and Extensions

### Table of Contents

```bash
npm install remark-toc
```

```javascript
// next.config.js
const withMDX = require('@next/mdx')({
  options: {
    remarkPlugins: [require('remark-toc')],
  },
})
```

### GitHub Flavored Markdown

```bash
npm install remark-gfm
```

```javascript
// next.config.js
const withMDX = require('@next/mdx')({
  options: {
    remarkPlugins: [require('remark-gfm')],
  },
})
```

Now you can use:
- Tables
- Task lists
- Strikethrough
- Autolinks

### Math Equations

```bash
npm install remark-math rehype-katex
```

```javascript
// next.config.js
const withMDX = require('@next/mdx')({
  options: {
    remarkPlugins: [require('remark-math')],
    rehypePlugins: [require('rehype-katex')],
  },
})
```

```mdx
# Math Example

Inline math: $E = mc^2$

Block math:

$$
\frac{n!}{k!(n-k)!} = \binom{n}{k}
$$
```

### Reading Time

```typescript
// lib/reading-time.ts
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200
  const words = content.trim().split(/\s+/).length
  return Math.ceil(words / wordsPerMinute)
}
```

```typescript
// app/blog/[slug]/page.tsx
import { calculateReadingTime } from '@/lib/reading-time'

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const { content, frontmatter } = await getPost(params.slug)
  const readingTime = calculateReadingTime(content)

  return (
    <article>
      <h1>{frontmatter.title}</h1>
      <p>{readingTime} min read</p>
      <div>{content}</div>
    </article>
  )
}
```

## Best Practices

### 1. Frontmatter Schema

```typescript
// types/frontmatter.ts
export interface BlogPostFrontmatter {
  title: string
  date: string
  author: string
  excerpt: string
  tags: string[]
  coverImage?: string
  published: boolean
}

export interface DocFrontmatter {
  title: string
  description: string
  order: number
  category: string
}
```

### 2. SEO Metadata

```typescript
// app/blog/[slug]/page.tsx
import { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const { frontmatter } = await getPost(params.slug)

  return {
    title: frontmatter.title,
    description: frontmatter.excerpt,
    openGraph: {
      title: frontmatter.title,
      description: frontmatter.excerpt,
      images: [frontmatter.coverImage],
      type: 'article',
      publishedTime: frontmatter.date,
      authors: [frontmatter.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: frontmatter.title,
      description: frontmatter.excerpt,
      images: [frontmatter.coverImage],
    },
  }
}
```

### 3. Content Validation

```typescript
// lib/validate-frontmatter.ts
import { z } from 'zod'

const blogPostSchema = z.object({
  title: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  author: z.string().min(1),
  excerpt: z.string().max(200),
  tags: z.array(z.string()),
  published: z.boolean(),
})

export function validateBlogPost(frontmatter: unknown) {
  return blogPostSchema.parse(frontmatter)
}
```

### 4. Image Optimization

```typescript
// components/mdx/OptimizedImage.tsx
import Image from 'next/image'

export function OptimizedImage({
  src,
  alt,
  ...props
}: {
  src: string
  alt: string
  [key: string]: any
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={600}
      className="rounded-lg my-8"
      {...props}
    />
  )
}
```

### 5. Error Handling

```typescript
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'

export default async function BlogPost({
  params,
}: {
  params: { slug: string }
}) {
  try {
    const { content, frontmatter } = await getPost(params.slug)

    if (!frontmatter.published) {
      notFound()
    }

    return (
      <article>
        <h1>{frontmatter.title}</h1>
        <div>{content}</div>
      </article>
    )
  } catch (error) {
    notFound()
  }
}
```

## Common Pitfalls

1. **Not handling frontmatter parsing**: Use gray-matter or built-in parsing
2. **Missing TypeScript types**: Define frontmatter interfaces
3. **Poor performance with many files**: Implement caching
4. **No SEO metadata**: Generate metadata for each page
5. **Unoptimized images**: Use Next.js Image component
6. **Not validating content**: Validate frontmatter schema
7. **Forgetting to sanitize user content**: Always sanitize when using remote MDX
8. **No error boundaries**: Handle MDX parsing errors gracefully

## Resources

- [MDX Documentation](https://mdxjs.com/)
- [@next/mdx](https://nextjs.org/docs/app/building-your-application/configuring/mdx)
- [next-mdx-remote](https://github.com/hashicorp/next-mdx-remote)
- [remark plugins](https://github.com/remarkjs/remark/blob/main/doc/plugins.md)
- [rehype plugins](https://github.com/rehypejs/rehype/blob/main/doc/plugins.md)
