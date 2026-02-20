# page.js / page.tsx

The `page` file is used to define the UI unique to a route. Pages are Server Components by default but can be set to Client Components.

## File Signature

```tsx
// app/page.tsx
export default function Page() {
  return <h1>Hello, Next.js!</h1>
}
```

## Props

Pages accept two props: `params` and `searchParams`.

### params

An object containing the dynamic route parameters from the root segment down to that page.

```tsx
// app/blog/[slug]/page.tsx
export default function Page({
  params
}: {
  params: { slug: string }
}) {
  return <div>Post: {params.slug}</div>
}
```

**Multi-segment dynamic routes:**

```tsx
// app/shop/[...slug]/page.tsx
export default function Page({
  params
}: {
  params: { slug: string[] }
}) {
  // /shop/a/b/c => params.slug = ['a', 'b', 'c']
  return <div>Category: {params.slug.join('/')}</div>
}
```

### searchParams

An object containing the search parameters of the current URL.

```tsx
// app/shop/page.tsx
export default function Page({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // /shop?search=shoes&size=10
  // searchParams = { search: 'shoes', size: '10' }
  return <div>Search: {searchParams.search}</div>
}
```

**Important Notes:**
- `searchParams` is only available in page.js, not in layout.js
- `searchParams` is a plain object, not a URLSearchParams instance
- `searchParams` is a **Dynamic API** - accessing it opts the page into dynamic rendering
- Values can be strings or arrays (for duplicate query params)

## TypeScript

For TypeScript type safety with dynamic routes:

```tsx
// app/blog/[slug]/page.tsx
type Props = {
  params: { slug: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function Page({ params, searchParams }: Props) {
  return <h1>{params.slug}</h1>
}
```

**For nested dynamic routes:**

```tsx
// app/shop/[category]/[product]/page.tsx
type Props = {
  params: {
    category: string
    product: string
  }
}

export default function Page({ params }: Props) {
  return (
    <div>
      {params.category} - {params.product}
    </div>
  )
}
```

## Examples

### Basic Page

```tsx
// app/about/page.tsx
export default function AboutPage() {
  return (
    <main>
      <h1>About Us</h1>
      <p>Welcome to our about page.</p>
    </main>
  )
}
```

### Dynamic Route Page

```tsx
// app/products/[id]/page.tsx
async function getProduct(id: string) {
  const res = await fetch(`https://api.example.com/products/${id}`)
  return res.json()
}

export default async function ProductPage({
  params
}: {
  params: { id: string }
}) {
  const product = await getProduct(params.id)

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
    </div>
  )
}
```

### Page with Search Params

```tsx
// app/search/page.tsx
async function searchResults(query: string) {
  const res = await fetch(`https://api.example.com/search?q=${query}`)
  return res.json()
}

export default async function SearchPage({
  searchParams
}: {
  searchParams: { q?: string }
}) {
  const query = searchParams.q || ''
  const results = query ? await searchResults(query) : []

  return (
    <div>
      <h1>Search Results for: {query}</h1>
      {results.map((item: any) => (
        <div key={item.id}>{item.title}</div>
      ))}
    </div>
  )
}
```

### Client Component Page

```tsx
// app/counter/page.tsx
'use client'

import { useState } from 'react'

export default function CounterPage() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  )
}
```

### Page with Multiple Dynamic Segments

```tsx
// app/[locale]/blog/[slug]/page.tsx
type Props = {
  params: {
    locale: string
    slug: string
  }
}

export default async function BlogPost({ params }: Props) {
  const { locale, slug } = params

  return (
    <article>
      <p>Locale: {locale}</p>
      <p>Slug: {slug}</p>
    </article>
  )
}
```

## Version History

- **v13.0.0**: App Router introduced with page.js convention
- **v13.4.0**: App Router stable

## Good to Know

- Pages are Server Components by default
- Pages can fetch data directly using async/await
- `.js`, `.jsx`, or `.tsx` file extensions can be used
- A page is always the leaf of the route subtree
- A `page.js` file is required to make a route segment publicly accessible
- Pages are always re-rendered on navigation by default
