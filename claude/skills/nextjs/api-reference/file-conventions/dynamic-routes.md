# Dynamic Routes

Dynamic routes use square brackets in file/folder names to create routes with dynamic parameters. This allows you to create routes based on data rather than predefined paths.

## Syntax

### Single Dynamic Segment

```
app/
└── blog/
    └── [slug]/
        └── page.tsx
```

Matches: `/blog/a`, `/blog/b`, `/blog/hello-world`

**Page component:**

```tsx
// app/blog/[slug]/page.tsx
export default function BlogPost({
  params
}: {
  params: { slug: string }
}) {
  return <div>Post: {params.slug}</div>
}
```

### Multiple Dynamic Segments

```
app/
└── shop/
    └── [category]/
        └── [product]/
            └── page.tsx
```

Matches: `/shop/shoes/nike`, `/shop/clothing/shirt`

**Page component:**

```tsx
// app/shop/[category]/[product]/page.tsx
export default function Product({
  params
}: {
  params: {
    category: string
    product: string
  }
}) {
  return (
    <div>
      Category: {params.category}
      <br />
      Product: {params.product}
    </div>
  )
}
```

## Catch-all Segments

### Basic Catch-all: [...slug]

Matches one or more segments.

```
app/
└── docs/
    └── [...slug]/
        └── page.tsx
```

**Matches:**
- `/docs/a` → `params.slug = ['a']`
- `/docs/a/b` → `params.slug = ['a', 'b']`
- `/docs/a/b/c` → `params.slug = ['a', 'b', 'c']`

**Does NOT match:**
- `/docs` ❌

**Page component:**

```tsx
// app/docs/[...slug]/page.tsx
export default function Docs({
  params
}: {
  params: { slug: string[] }
}) {
  return (
    <div>
      Path: {params.slug.join('/')}
    </div>
  )
}
```

### Optional Catch-all: [[...slug]]

Matches zero or more segments.

```
app/
└── shop/
    └── [[...slug]]/
        └── page.tsx
```

**Matches:**
- `/shop` → `params.slug = undefined`
- `/shop/clothes` → `params.slug = ['clothes']`
- `/shop/clothes/tops` → `params.slug = ['clothes', 'tops']`

**Page component:**

```tsx
// app/shop/[[...slug]]/page.tsx
export default function Shop({
  params
}: {
  params: { slug?: string[] }
}) {
  const path = params.slug ? params.slug.join('/') : 'home'
  return <div>Shop: {path}</div>
}
```

## Examples

### Blog with Dynamic Routes

```tsx
// app/blog/[slug]/page.tsx
async function getPost(slug: string) {
  const res = await fetch(`https://api.example.com/posts/${slug}`)
  if (!res.ok) return null
  return res.json()
}

export default async function BlogPost({
  params
}: {
  params: { slug: string }
}) {
  const post = await getPost(params.slug)

  if (!post) {
    notFound()
  }

  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  )
}
```

### E-commerce Product Page

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
      <p>${product.price}</p>
    </div>
  )
}
```

### User Profile

```tsx
// app/users/[username]/page.tsx
async function getUserProfile(username: string) {
  const res = await fetch(`https://api.example.com/users/${username}`)
  return res.json()
}

export default async function UserProfile({
  params
}: {
  params: { username: string }
}) {
  const user = await getUserProfile(params.username)

  return (
    <div>
      <h1>{user.name}</h1>
      <p>@{user.username}</p>
      <p>{user.bio}</p>
    </div>
  )
}
```

### Documentation with Catch-all

```tsx
// app/docs/[[...slug]]/page.tsx
async function getDocContent(slug?: string[]) {
  const path = slug ? slug.join('/') : 'index'
  const res = await fetch(`https://api.example.com/docs/${path}`)
  return res.json()
}

export default async function Docs({
  params
}: {
  params: { slug?: string[] }
}) {
  const doc = await getDocContent(params.slug)

  return (
    <article>
      <h1>{doc.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: doc.content }} />
    </article>
  )
}
```

### Multi-level Categories

```tsx
// app/shop/[...categories]/page.tsx
async function getProductsByCategory(categories: string[]) {
  const path = categories.join('/')
  const res = await fetch(`https://api.example.com/categories/${path}/products`)
  return res.json()
}

export default async function CategoryPage({
  params
}: {
  params: { categories: string[] }
}) {
  const products = await getProductsByCategory(params.categories)

  return (
    <div>
      <h1>Category: {params.categories.join(' > ')}</h1>
      <div className="grid grid-cols-4 gap-4">
        {products.map((product: any) => (
          <div key={product.id}>{product.name}</div>
        ))}
      </div>
    </div>
  )
}
```

### Locale and Dynamic Route

```tsx
// app/[locale]/blog/[slug]/page.tsx
type Props = {
  params: {
    locale: string
    slug: string
  }
}

async function getPost(locale: string, slug: string) {
  const res = await fetch(
    `https://api.example.com/${locale}/posts/${slug}`
  )
  return res.json()
}

export default async function BlogPost({ params }: Props) {
  const post = await getPost(params.locale, params.slug)

  return (
    <article lang={params.locale}>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  )
}
```

## Generating Static Params

Use `generateStaticParams` to generate routes at build time:

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await fetch('https://api.example.com/posts').then(res =>
    res.json()
  )

  return posts.map((post: any) => ({
    slug: post.slug,
  }))
}

export default async function BlogPost({
  params
}: {
  params: { slug: string }
}) {
  const post = await getPost(params.slug)
  return <article>{post.title}</article>
}
```

**Multiple dynamic segments:**

```tsx
// app/products/[category]/[product]/page.tsx
export async function generateStaticParams() {
  const products = await getProducts()

  return products.map((product) => ({
    category: product.category,
    product: product.id,
  }))
}
```

**Nested generation:**

```tsx
// app/[lang]/blog/[slug]/page.tsx
export async function generateStaticParams({
  params: { lang },
}: {
  params: { lang: string }
}) {
  const posts = await getPostsByLang(lang)

  return posts.map((post) => ({
    slug: post.slug,
  }))
}
```

## Dynamic API Routes

```ts
// app/api/users/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id
  const user = await getUser(id)

  return Response.json(user)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  await deleteUser(params.id)
  return new Response(null, { status: 204 })
}
```

## TypeScript

```tsx
type PageProps = {
  params: { slug: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function Page({ params, searchParams }: PageProps) {
  return <div>{params.slug}</div>
}
```

**Multiple segments:**

```tsx
type PageProps = {
  params: {
    category: string
    product: string
  }
}

export default function Page({ params }: PageProps) {
  return <div>{params.category} - {params.product}</div>
}
```

**Catch-all segments:**

```tsx
type PageProps = {
  params: { slug: string[] }
}

export default function Page({ params }: PageProps) {
  return <div>{params.slug.join('/')}</div>
}
```

**Optional catch-all:**

```tsx
type PageProps = {
  params: { slug?: string[] }
}

export default function Page({ params }: PageProps) {
  const path = params.slug?.join('/') || 'home'
  return <div>{path}</div>
}
```

## Comparison

| Pattern | File Path | URL | params |
|---------|-----------|-----|--------|
| Single | `[slug]` | `/a` | `{ slug: 'a' }` |
| Multiple | `[category]/[id]` | `/shoes/123` | `{ category: 'shoes', id: '123' }` |
| Catch-all | `[...slug]` | `/a/b/c` | `{ slug: ['a', 'b', 'c'] }` |
| Optional Catch-all | `[[...slug]]` | `/` or `/a/b` | `undefined` or `{ slug: ['a', 'b'] }` |

## Version History

- **v13.0.0**: App Router introduced with dynamic routes
- **v13.4.0**: App Router stable

## Good to Know

- Params are always available in Server Components
- Use square brackets for dynamic segments: `[param]`
- Use `[...param]` for catch-all routes (one or more)
- Use `[[...param]]` for optional catch-all routes (zero or more)
- Dynamic segments are URL decoded by default
- Params are always strings or string arrays
- Use `generateStaticParams` for static generation
- Can be combined with layouts and route groups
- Works in both page routes and API routes
- Supports TypeScript for type-safe params
