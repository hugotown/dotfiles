# Server Components

Server Components are the default component type in Next.js App Router. They render on the server and send only the resulting HTML to the client, keeping the JavaScript runtime and component logic on the server.

## Key Characteristics

### Default Behavior
In the App Router, **all components are Server Components by default** unless you explicitly mark them as Client Components with `'use client'`.

```tsx
// This is a Server Component (default)
export default function ProductList() {
  return <div>Product List</div>
}
```

### Zero Client-Side JavaScript
Server Components don't add JavaScript to the client bundle. The component code runs only on the server, dramatically reducing bundle size.

```tsx
// This entire component and its logic stays on the server
import { calculateComplexMetrics } from '@/lib/analytics'

export default function Dashboard() {
  const metrics = calculateComplexMetrics() // Runs on server only

  return (
    <div>
      <h1>Dashboard</h1>
      <MetricsDisplay data={metrics} />
    </div>
  )
}
```

## Benefits

### 1. Direct Data Access
Server Components can directly access databases, filesystems, and backend services without creating API routes.

```tsx
import { db } from '@/lib/database'

export default async function UserProfile({ userId }: { userId: string }) {
  // Direct database access - no API route needed
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { posts: true }
  })

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <PostList posts={user.posts} />
    </div>
  )
}
```

### 2. Security
Sensitive operations, API keys, and business logic remain on the server.

```tsx
import { getServerSession } from 'next-auth'
import { stripe } from '@/lib/stripe' // API key stays on server

export default async function SubscriptionStatus() {
  const session = await getServerSession()

  // Stripe API key never exposed to client
  const subscription = await stripe.subscriptions.retrieve(
    session.user.subscriptionId
  )

  return <div>Status: {subscription.status}</div>
}
```

### 3. Reduced Bundle Size
Component dependencies and logic don't ship to the client.

```tsx
// Heavy libraries only run on server
import { parseMarkdown } from 'heavy-markdown-parser' // 500KB
import { formatCode } from 'syntax-highlighter' // 300KB

export default async function BlogPost({ slug }: { slug: string }) {
  const post = await getPost(slug)
  const html = parseMarkdown(post.content) // Server-side only
  const formatted = formatCode(html) // Server-side only

  return <article dangerouslySetInnerHTML={{ __html: formatted }} />
}
```

### 4. Automatic Code Splitting
Next.js automatically splits Server Components, sending only what's needed.

### 5. SEO Optimization
Content is rendered on the server and fully available to search engines.

## Async Components

Server Components can be async functions, enabling direct await syntax.

```tsx
// Async Server Component - clean async/await syntax
export default async function ProductPage({
  params
}: {
  params: { id: string }
}) {
  // Multiple concurrent data fetches
  const [product, reviews, recommendations] = await Promise.all([
    fetchProduct(params.id),
    fetchReviews(params.id),
    fetchRecommendations(params.id)
  ])

  return (
    <div>
      <ProductDetails product={product} />
      <Reviews reviews={reviews} />
      <Recommendations items={recommendations} />
    </div>
  )
}
```

## Data Fetching Patterns

### Sequential Fetching
When data dependencies exist, fetch sequentially.

```tsx
export default async function UserPosts({ userId }: { userId: string }) {
  // Fetch user first
  const user = await fetchUser(userId)

  // Then fetch posts based on user preferences
  const posts = await fetchPosts({
    userId,
    language: user.preferredLanguage
  })

  return <PostsList posts={posts} user={user} />
}
```

### Parallel Fetching
Fetch independent data in parallel for better performance.

```tsx
export default async function Dashboard() {
  // All fetches start simultaneously
  const [user, stats, notifications] = await Promise.all([
    fetchUser(),
    fetchStats(),
    fetchNotifications()
  ])

  return (
    <div>
      <UserInfo user={user} />
      <Stats data={stats} />
      <Notifications items={notifications} />
    </div>
  )
}
```

### Preloading Pattern
Start fetches early and await them later.

```tsx
// lib/data.ts
export function preloadUser(id: string) {
  void fetchUser(id) // Start fetch but don't await
}

// Component
import { preloadUser, fetchUser } from '@/lib/data'

export default async function Page({ params }: { params: { id: string } }) {
  preloadUser(params.id) // Start early

  // Do other work...
  const otherData = await fetchOtherData()

  // Await the preloaded data
  const user = await fetchUser(params.id) // May already be resolved

  return <UserProfile user={user} otherData={otherData} />
}
```

## Caching Behavior

Server Components are cached by default in Next.js.

### Automatic Request Deduplication
Multiple identical fetch requests are automatically deduplicated.

```tsx
// These three components make the same request
// Next.js deduplicates them - only 1 actual fetch occurs
async function Component1() {
  const data = await fetch('https://api.example.com/data')
  return <div>...</div>
}

async function Component2() {
  const data = await fetch('https://api.example.com/data')
  return <div>...</div>
}

async function Component3() {
  const data = await fetch('https://api.example.com/data')
  return <div>...</div>
}
```

### Cache Control
Control caching behavior with fetch options.

```tsx
// Revalidate every 60 seconds
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 60 }
})

// Never cache - always fetch fresh
const data = await fetch('https://api.example.com/data', {
  cache: 'no-store'
})

// Cache with tag for on-demand revalidation
const data = await fetch('https://api.example.com/data', {
  next: { tags: ['products'] }
})
```

## Limitations

Server Components **cannot**:

- Use React hooks (useState, useEffect, useContext, etc.)
- Use browser-only APIs (window, localStorage, etc.)
- Attach event handlers directly (onClick, onChange, etc.)
- Use state or lifecycle methods

```tsx
// ❌ These will cause errors in Server Components

export default function BadServerComponent() {
  // ❌ Cannot use hooks
  const [count, setCount] = useState(0)

  // ❌ Cannot use browser APIs
  const theme = window.localStorage.getItem('theme')

  // ❌ Cannot attach event handlers directly
  return <button onClick={() => setCount(count + 1)}>Click</button>
}
```

For these features, use Client Components instead.

## Performance Implications

### Advantages
- **Smaller bundles**: Component code doesn't ship to client
- **Faster initial load**: Less JavaScript to parse and execute
- **Better SEO**: Fully rendered HTML available immediately
- **Secure**: Backend logic and keys stay on server

### Considerations
- **Server load**: More rendering happens on server
- **Network latency**: Each render requires server round-trip
- **No interactivity**: Need Client Components for user interactions

## When to Use Server Components

✅ **Ideal for:**
- Fetching data from APIs, databases, or CMS
- Accessing backend resources and services
- Rendering static content
- SEO-critical pages
- Large dependencies that don't need client-side execution
- Secure operations requiring API keys or secrets

❌ **Not suitable for:**
- Interactive UI elements
- Components using React hooks
- Browser API access
- Event handlers
- Real-time updates requiring websockets

## Best Practices

### 1. Keep Server Components as Default
Only use Client Components when necessary.

```tsx
// ✅ Good - Server Component by default
export default async function Page() {
  const data = await fetchData()

  return (
    <div>
      <StaticHeader data={data} />
      {/* Only the interactive part is a Client Component */}
      <InteractiveWidget />
    </div>
  )
}
```

### 2. Move Data Fetching to Server Components
Fetch data in Server Components, not Client Components.

```tsx
// ✅ Good - fetch in Server Component
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await fetchProduct(params.id)

  return <ProductDisplay product={product} />
}

// ❌ Avoid - fetching in Client Component
'use client'
export default function ProductPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState(null)

  useEffect(() => {
    fetchProduct(params.id).then(setProduct)
  }, [params.id])

  return product ? <ProductDisplay product={product} /> : <Loading />
}
```

### 3. Compose with Client Components
Pass Server Component children to Client Components.

```tsx
// ✅ Good - Server Components as children
export default async function Layout() {
  return (
    <ClientSidebar>
      {/* These remain Server Components */}
      <ServerNav />
      <ServerUserMenu />
    </ClientSidebar>
  )
}
```

### 4. Parallel Data Fetching
Use Promise.all for independent data sources.

```tsx
// ✅ Good - parallel fetching
export default async function Dashboard() {
  const [analytics, users, revenue] = await Promise.all([
    fetchAnalytics(),
    fetchUsers(),
    fetchRevenue()
  ])

  return <DashboardLayout analytics={analytics} users={users} revenue={revenue} />
}
```

## Examples

### Blog Post with Comments
```tsx
// app/blog/[slug]/page.tsx
import { db } from '@/lib/database'
import { CommentForm } from './comment-form' // Client Component

export default async function BlogPost({
  params
}: {
  params: { slug: string }
}) {
  // Server-side data fetching
  const [post, comments] = await Promise.all([
    db.post.findUnique({ where: { slug: params.slug } }),
    db.comment.findMany({ where: { postSlug: params.slug } })
  ])

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />

      <section>
        <h2>Comments ({comments.length})</h2>
        {comments.map(comment => (
          <div key={comment.id}>
            <p>{comment.author}: {comment.text}</p>
          </div>
        ))}
        {/* Client Component for interactivity */}
        <CommentForm postSlug={params.slug} />
      </section>
    </article>
  )
}
```

### E-commerce Product Page
```tsx
// app/products/[id]/page.tsx
import { getProduct, getRecommendations } from '@/lib/api'
import { AddToCartButton } from './add-to-cart-button' // Client Component

export default async function ProductPage({
  params
}: {
  params: { id: string }
}) {
  const product = await getProduct(params.id)
  const recommendations = await getRecommendations(params.id)

  return (
    <div>
      <h1>{product.name}</h1>
      <img src={product.image} alt={product.name} />
      <p>{product.description}</p>
      <p className="price">${product.price}</p>

      {/* Client Component for cart interaction */}
      <AddToCartButton productId={product.id} />

      <section>
        <h2>You might also like</h2>
        <div className="grid">
          {recommendations.map(item => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      </section>
    </div>
  )
}
```

## Summary

Server Components are the foundation of Next.js App Router rendering. They provide:

- **Performance**: Smaller bundles, faster loads
- **Security**: Backend logic stays secure
- **Simplicity**: Direct async/await data fetching
- **SEO**: Fully rendered HTML for search engines

Use Server Components by default and only reach for Client Components when you need interactivity, hooks, or browser APIs.
