# useParams

The `useParams` hook allows you to read the dynamic route parameters in Client Components.

## Import

```typescript
'use client'

import { useParams } from 'next/navigation'
```

## Function Signature

```typescript
const params = useParams()
```

## Return Value

Returns an object containing the current dynamic route parameters.

## Usage Examples

### Basic Usage

```typescript
// app/blog/[slug]/page.tsx
'use client'

import { useParams } from 'next/navigation'

export default function BlogPost() {
  const params = useParams()

  return <div>Post slug: {params.slug}</div>
}

// URL: /blog/hello-world
// Output: Post slug: hello-world
```

### Multiple Dynamic Segments

```typescript
// app/shop/[category]/[product]/page.tsx
'use client'

import { useParams } from 'next/navigation'

export default function ProductPage() {
  const params = useParams<{ category: string; product: string }>()

  return (
    <div>
      <p>Category: {params.category}</p>
      <p>Product: {params.product}</p>
    </div>
  )
}

// URL: /shop/electronics/laptop
// Output: Category: electronics, Product: laptop
```

### With TypeScript

```typescript
'use client'

import { useParams } from 'next/navigation'

type Params = {
  id: string
}

export default function Page() {
  const params = useParams<Params>()

  return <div>ID: {params.id}</div>
}
```

### Fetch Data with Params

```typescript
'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function UserPage() {
  const params = useParams<{ id: string }>()
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetch(`/api/users/${params.id}`)
      .then((res) => res.json())
      .then((data) => setUser(data))
  }, [params.id])

  if (!user) return <div>Loading...</div>

  return <div>User: {user.name}</div>
}
```

### Nested Dynamic Routes

```typescript
// app/[lang]/blog/[slug]/page.tsx
'use client'

import { useParams } from 'next/navigation'

export default function Page() {
  const params = useParams<{ lang: string; slug: string }>()

  return (
    <div>
      <p>Language: {params.lang}</p>
      <p>Slug: {params.slug}</p>
    </div>
  )
}

// URL: /en/blog/my-post
// Output: Language: en, Slug: my-post
```

### Catch-All Segments

```typescript
// app/docs/[...slug]/page.tsx
'use client'

import { useParams } from 'next/navigation'

export default function DocsPage() {
  const params = useParams<{ slug: string[] }>()

  return (
    <div>
      <h1>Documentation</h1>
      <p>Path: {params.slug.join('/')}</p>
    </div>
  )
}

// URL: /docs/api/reference/hooks
// Output: Path: api/reference/hooks
```

### Optional Catch-All

```typescript
// app/blog/[[...slug]]/page.tsx
'use client'

import { useParams } from 'next/navigation'

export default function BlogPage() {
  const params = useParams<{ slug?: string[] }>()

  if (!params.slug) {
    return <div>Blog Home</div>
  }

  return <div>Path: {params.slug.join('/')}</div>
}

// URL: /blog → Blog Home
// URL: /blog/2023/my-post → Path: 2023/my-post
```

### Build Breadcrumbs

```typescript
'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function Breadcrumbs() {
  const params = useParams<{ slug: string[] }>()

  return (
    <nav>
      <Link href="/">Home</Link>
      {params.slug?.map((segment, index) => {
        const href = `/${params.slug.slice(0, index + 1).join('/')}`
        return (
          <span key={href}>
            {' / '}
            <Link href={href}>{segment}</Link>
          </span>
        )
      })}
    </nav>
  )
}
```

### Navigate to Related Items

```typescript
'use client'

import { useParams, useRouter } from 'next/navigation'

export default function ProductNavigation() {
  const router = useRouter()
  const params = useParams<{ category: string; id: string }>()

  const viewProduct = (productId: string) => {
    router.push(`/shop/${params.category}/${productId}`)
  }

  return (
    <div>
      <button onClick={() => viewProduct('product-1')}>
        View Product 1
      </button>
      <button onClick={() => viewProduct('product-2')}>
        View Product 2
      </button>
    </div>
  )
}
```

### Conditional Rendering

```typescript
'use client'

import { useParams } from 'next/navigation'

export default function Page() {
  const params = useParams<{ mode: string }>()

  return (
    <div>
      {params.mode === 'edit' && <EditMode />}
      {params.mode === 'view' && <ViewMode />}
    </div>
  )
}
```

### Extract Numeric ID

```typescript
'use client'

import { useParams } from 'next/navigation'

export default function Page() {
  const params = useParams<{ id: string }>()
  const numericId = parseInt(params.id, 10)

  if (isNaN(numericId)) {
    return <div>Invalid ID</div>
  }

  return <div>Numeric ID: {numericId}</div>
}
```

### Share Button with Current Route

```typescript
'use client'

import { useParams, usePathname } from 'next/navigation'

export default function ShareButton() {
  const params = useParams<{ slug: string }>()
  const pathname = usePathname()

  const share = () => {
    const url = `${window.location.origin}${pathname}`
    navigator.share({ url, title: params.slug })
  }

  return <button onClick={share}>Share</button>
}
```

### Multi-Language Routes

```typescript
// app/[locale]/products/[id]/page.tsx
'use client'

import { useParams } from 'next/navigation'

export default function ProductPage() {
  const params = useParams<{ locale: string; id: string }>()

  return (
    <div data-locale={params.locale}>
      <h1>Product {params.id}</h1>
    </div>
  )
}
```

### Workspace and Item Pattern

```typescript
// app/workspace/[workspaceId]/item/[itemId]/page.tsx
'use client'

import { useParams } from 'next/navigation'

export default function ItemPage() {
  const params = useParams<{ workspaceId: string; itemId: string }>()

  return (
    <div>
      <p>Workspace: {params.workspaceId}</p>
      <p>Item: {params.itemId}</p>
    </div>
  )
}
```

### Decode URL Parameters

```typescript
'use client'

import { useParams } from 'next/navigation'

export default function Page() {
  const params = useParams<{ slug: string }>()

  // Decode URL-encoded parameters
  const decodedSlug = decodeURIComponent(params.slug)

  return <div>Slug: {decodedSlug}</div>
}
```

## Best Practices

1. **Use TypeScript for Type Safety**
   ```typescript
   type Params = {
     id: string
     category: string
   }

   const params = useParams<Params>()
   ```

2. **Validate Parameter Values**
   ```typescript
   const params = useParams<{ id: string }>()
   const id = parseInt(params.id)

   if (isNaN(id)) {
     return <div>Invalid ID</div>
   }
   ```

3. **Handle Catch-All Routes**
   ```typescript
   const params = useParams<{ slug?: string[] }>()

   if (!params.slug) {
     // Handle home/index case
     return <Home />
   }
   ```

4. **Decode URL-Encoded Values**
   ```typescript
   const slug = decodeURIComponent(params.slug)
   ```

5. **Use with Other Hooks**
   ```typescript
   const params = useParams()
   const pathname = usePathname()
   const searchParams = useSearchParams()
   ```

## Common Patterns

### Load Data Based on Params

```typescript
function Page() {
  const params = useParams<{ id: string }>()
  const { data } = useSWR(`/api/items/${params.id}`)

  return <div>{data?.title}</div>
}
```

### Navigate Between Dynamic Routes

```typescript
function Navigation() {
  const router = useRouter()
  const params = useParams<{ category: string }>()

  const goToProduct = (id: string) => {
    router.push(`/shop/${params.category}/${id}`)
  }

  return <ProductList onSelect={goToProduct} />
}
```

### Hierarchical Navigation

```typescript
function Breadcrumbs() {
  const params = useParams<{ slug: string[] }>()

  return (
    <div>
      {params.slug?.map((segment, i) => (
        <Link key={i} href={`/${params.slug.slice(0, i + 1).join('/')}`}>
          {segment}
        </Link>
      ))}
    </div>
  )
}
```

## Important Notes

- Only works in Client Components (`'use client'`)
- Returns object with route parameters
- Parameters are always strings
- Catch-all segments return arrays
- Import from `'next/navigation'`, not `'next/router'`
- Parameters are automatically URL-decoded
- Use with `usePathname()` and `useSearchParams()` for complete route info

## Related

- [usePathname](./usePathname.md) - Get current pathname
- [useSearchParams](./useSearchParams.md) - Access query parameters
- [useRouter](./useRouter.md) - Programmatic navigation
- [generateStaticParams](./generateStaticParams.md) - Generate static params
