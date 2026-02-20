# Composition Patterns

Composition patterns define how Server and Client Components interact, where boundaries are drawn, and how data flows between them. Mastering these patterns is essential for building performant Next.js applications.

## Understanding the Server-Client Boundary

The `'use client'` directive creates a boundary between Server and Client Component code.

```tsx
// Server Component (default)
export default async function Page() {
  const data = await fetchData()

  return (
    <div>
      {/* This is a Server Component */}
      <ServerHeader data={data} />

      {/* Boundary: Client Component starts here */}
      <ClientSidebar />

      {/* Back to Server Component */}
      <ServerFooter />
    </div>
  )
}

// client-sidebar.tsx
'use client'

export function ClientSidebar() {
  // Everything in this file and its imports becomes client-side
  return <aside>...</aside>
}
```

### Key Rules

1. **Server Components cannot import Client Components** - but they can render them
2. **Client Components can import other Client Components**
3. **Server Components can be passed as children to Client Components**
4. **Props passed across the boundary must be serializable**

## Pattern 1: Passing Server Components as Children

You can pass Server Components as children or props to Client Components, keeping them on the server.

### The Problem
```tsx
// ❌ This doesn't work as expected
'use client'

import { ServerComponent } from './server-component'

export function ClientWrapper() {
  // ServerComponent becomes a Client Component!
  return <ServerComponent />
}
```

### The Solution
```tsx
// ✅ Pass Server Components as children
'use client'

export function ClientWrapper({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      {isOpen && children}
    </div>
  )
}

// Server Component can use it
export default async function Page() {
  const data = await fetchData()

  return (
    <ClientWrapper>
      {/* This stays a Server Component! */}
      <ServerContent data={data} />
    </ClientWrapper>
  )
}
```

### Real-World Example: Modal with Server Content

```tsx
// modal.tsx (Client Component)
'use client'

import { useState, ReactNode } from 'react'

export function Modal({
  trigger,
  children
}: {
  trigger: ReactNode
  children: ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <div onClick={() => setIsOpen(true)}>{trigger}</div>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Children remain Server Components */}
            {children}
            <button onClick={() => setIsOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  )
}

// page.tsx (Server Component)
export default async function Page() {
  const product = await fetchProduct()

  return (
    <Modal trigger={<button>View Details</button>}>
      {/* This entire component tree stays on the server */}
      <ProductDetails product={product} />
      <Reviews productId={product.id} />
      <Recommendations category={product.category} />
    </Modal>
  )
}
```

## Pattern 2: Prop Passing and Serialization

Props passed from Server to Client Components must be serializable.

### Serializable Data

✅ **Works:**
```tsx
// Server Component
export default async function Page() {
  const data = await fetchData()

  return (
    <ClientComponent
      // All these are serializable
      string="hello"
      number={42}
      boolean={true}
      array={[1, 2, 3]}
      object={{ name: 'John', age: 30 }}
      date={new Date().toISOString()}
      null={null}
    />
  )
}
```

### Non-Serializable Data

❌ **Doesn't work:**
```tsx
// Server Component
export default async function Page() {
  return (
    <ClientComponent
      // ❌ Functions cannot be serialized
      onClick={() => console.log('click')}

      // ❌ Class instances cannot be serialized
      date={new Date()}

      // ❌ Symbols cannot be serialized
      symbol={Symbol('unique')}
    />
  )
}
```

### Solution: Use Server Actions for Functions

```tsx
// actions.ts
'use server'

export async function handleClick() {
  console.log('Clicked!')
  // Server-side logic
}

// Server Component
import { handleClick } from './actions'

export default function Page() {
  return <ClientButton onClick={handleClick} />
}

// client-button.tsx
'use client'

export function ClientButton({
  onClick
}: {
  onClick: () => Promise<void>
}) {
  return <button onClick={onClick}>Click Me</button>
}
```

## Pattern 3: Wrapping Client Components

Create wrapper Server Components that fetch data and pass it to Client Components.

```tsx
// Server Component wrapper
export default async function ProductPageWrapper({
  params
}: {
  params: { id: string }
}) {
  // Fetch data on server
  const [product, reviews] = await Promise.all([
    fetchProduct(params.id),
    fetchReviews(params.id)
  ])

  // Pass data to Client Component
  return <ProductPage product={product} reviews={reviews} />
}

// Client Component
'use client'

export function ProductPage({
  product,
  reviews
}: {
  product: Product
  reviews: Review[]
}) {
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)

  return (
    <div>
      <h1>{product.name}</h1>
      <ReviewsList
        reviews={reviews}
        onSelect={setSelectedReview}
      />
      {selectedReview && <ReviewModal review={selectedReview} />}
    </div>
  )
}
```

## Pattern 4: Context Providers

Context providers must be Client Components, but you can structure them to keep content on the server.

### The Setup

```tsx
// context.tsx (Client Component)
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

const ThemeContext = createContext<{
  theme: string
  setTheme: (theme: string) => void
} | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('light')

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
```

### The Pattern

```tsx
// layout.tsx (Server Component)
import { ThemeProvider } from './context'

export default async function RootLayout({
  children
}: {
  children: ReactNode
}) {
  return (
    <html>
      <body>
        <ThemeProvider>
          {/* All children remain Server Components by default */}
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

// page.tsx (Server Component)
export default async function Page() {
  const data = await fetchData()

  return (
    <div>
      <ServerContent data={data} />
      {/* Only interactive parts use the context */}
      <ThemeToggle />
    </div>
  )
}

// theme-toggle.tsx (Client Component)
'use client'

import { useTheme } from './context'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Theme: {theme}
    </button>
  )
}
```

## Pattern 5: Interleaving Server and Client Components

Build component trees that efficiently mix Server and Client Components.

```tsx
// page.tsx (Server Component - ROOT)
export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug)
  const relatedPosts = await fetchRelatedPosts(params.slug)

  return (
    <article>
      {/* Server Component */}
      <PostHeader post={post} />

      {/* Client Component with Server Component children */}
      <ShareButtons>
        {/* Server Component inside Client Component */}
        <ShareCount postId={post.id} />
      </ShareButtons>

      {/* Server Component */}
      <PostContent content={post.content} />

      {/* Client Component */}
      <CommentSection postId={post.id}>
        {/* Server Component children */}
        <ExistingComments postId={post.id} />
      </CommentSection>

      {/* Server Component */}
      <RelatedPosts posts={relatedPosts} />
    </article>
  )
}

// share-buttons.tsx (Client Component)
'use client'

export function ShareButtons({ children }: { children: ReactNode }) {
  const share = async (platform: string) => {
    // Client-side sharing logic
  }

  return (
    <div className="share-buttons">
      {/* Client-side interactivity */}
      <button onClick={() => share('twitter')}>Twitter</button>
      <button onClick={() => share('facebook')}>Facebook</button>
      {/* Server Component children */}
      {children}
    </div>
  )
}

// share-count.tsx (Server Component)
export async function ShareCount({ postId }: { postId: string }) {
  const count = await fetchShareCount(postId)
  return <span>{count} shares</span>
}

// comment-section.tsx (Client Component)
'use client'

export function CommentSection({
  postId,
  children
}: {
  postId: string
  children: ReactNode
}) {
  const [newComment, setNewComment] = useState('')

  const handleSubmit = async () => {
    await submitComment(postId, newComment)
    setNewComment('')
  }

  return (
    <section>
      <h2>Comments</h2>

      {/* Server Component children */}
      {children}

      {/* Client-side form */}
      <form onSubmit={handleSubmit}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button type="submit">Post Comment</button>
      </form>
    </section>
  )
}

// existing-comments.tsx (Server Component)
export async function ExistingComments({ postId }: { postId: string }) {
  const comments = await fetchComments(postId)

  return (
    <div>
      {comments.map(comment => (
        <div key={comment.id}>
          <p>{comment.author}: {comment.text}</p>
        </div>
      ))}
    </div>
  )
}
```

## Pattern 6: Shared Components Between Server and Client

Some components can work in both environments.

```tsx
// shared/button.tsx (No 'use client')
// This can be used in both Server and Client Components

export function Button({
  children,
  variant = 'primary'
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary'
}) {
  return (
    <button className={`btn btn-${variant}`}>
      {children}
    </button>
  )
}

// Used in Server Component
export default async function Page() {
  return (
    <div>
      <Button>Static Button</Button>
    </div>
  )
}

// Used in Client Component
'use client'

export function InteractiveCard() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <Button onClick={() => setCount(count + 1)}>
        Clicked {count} times
      </Button>
    </div>
  )
}
```

## Pattern 7: Loading States with Server and Client

Combine Server Components with Client Components for optimal loading experiences.

```tsx
// page.tsx (Server Component)
import { Suspense } from 'react'

export default function Page() {
  return (
    <div>
      {/* Instantly available */}
      <Header />

      {/* Client-side loading state while Server Component loads */}
      <Suspense fallback={<LoadingSpinner />}>
        <AsyncServerContent />
      </Suspense>

      {/* Instantly available */}
      <Sidebar />
    </div>
  )
}

// async-server-content.tsx (Server Component)
export async function AsyncServerContent() {
  const data = await fetchSlowData()

  return (
    <div>
      <DataDisplay data={data} />
      {/* Client Component for interactivity */}
      <InteractiveFilters />
    </div>
  )
}

// loading-spinner.tsx (Client Component)
'use client'

export function LoadingSpinner() {
  return <div className="spinner">Loading...</div>
}
```

## Best Practices

### 1. Start with Server Components

Default to Server Components and only add `'use client'` when necessary.

```tsx
// ✅ Good - mostly Server Components
export default async function Page() {
  const data = await fetchData()

  return (
    <div>
      <StaticHeader />
      <ServerContent data={data} />
      {/* Only this needs to be client-side */}
      <InteractiveLikeButton postId={data.id} />
      <StaticFooter />
    </div>
  )
}

// ❌ Avoid - entire page is client-side
'use client'

export default function Page() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetchData().then(setData)
  }, [])

  return <div>...</div>
}
```

### 2. Keep Client Components Leaf Nodes

Push `'use client'` as deep as possible in the component tree.

```tsx
// ✅ Good - client component is a leaf
export default async function ProductPage() {
  const product = await fetchProduct()

  return (
    <div>
      <ProductImage src={product.image} />
      <ProductDetails product={product} />
      <ProductSpecs specs={product.specs} />
      {/* Leaf node */}
      <AddToCartButton productId={product.id} />
    </div>
  )
}

// ❌ Avoid - client component wraps everything
'use client'

export default function ProductPage() {
  return (
    <div>
      <ProductImage />
      <ProductDetails />
      <ProductSpecs />
      <AddToCartButton />
    </div>
  )
}
```

### 3. Use Composition Over Importing

Prefer passing components as children rather than importing them.

```tsx
// ✅ Good - composition
'use client'

export function Dialog({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  return <div>{isOpen && children}</div>
}

// Server Component uses it
export default async function Page() {
  const data = await fetchData()

  return (
    <Dialog>
      <ServerContent data={data} />
    </Dialog>
  )
}

// ❌ Avoid - importing makes it client-side
'use client'

import { ServerContent } from './server-content'

export function Dialog() {
  // ServerContent becomes client-side!
  return <div><ServerContent /></div>
}
```

### 4. Minimize Props Across Boundaries

Pass only necessary data across Server-Client boundaries.

```tsx
// ❌ Avoid - passing entire object
export default async function Page() {
  const product = await fetchProduct() // Large object with 50 fields

  return <LikeButton product={product} />
}

// ✅ Better - pass only what's needed
export default async function Page() {
  const product = await fetchProduct()

  return (
    <LikeButton
      productId={product.id}
      initialLikes={product.likes}
    />
  )
}
```

### 5. Use Server Actions for Mutations

```tsx
// actions.ts
'use server'

export async function addToCart(productId: string, quantity: number) {
  // Server-side logic
  await db.cart.create({ productId, quantity })
  revalidatePath('/cart')
}

// Client Component
'use client'

import { addToCart } from './actions'

export function AddToCartButton({ productId }: { productId: string }) {
  const [quantity, setQuantity] = useState(1)

  return (
    <button onClick={() => addToCart(productId, quantity)}>
      Add to Cart
    </button>
  )
}
```

## Common Pitfalls

### Pitfall 1: Importing Server Components in Client Components

```tsx
// ❌ This breaks the server component
'use client'

import { ServerComponent } from './server-component'

export function ClientWrapper() {
  return <ServerComponent /> // Now runs on client!
}

// ✅ Use children instead
'use client'

export function ClientWrapper({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}
```

### Pitfall 2: Passing Non-Serializable Props

```tsx
// ❌ Functions don't serialize
export default function Page() {
  const handleClick = () => console.log('click')

  return <ClientButton onClick={handleClick} />
}

// ✅ Use Server Actions
import { handleClick } from './actions' // Server Action

export default function Page() {
  return <ClientButton onClick={handleClick} />
}
```

### Pitfall 3: Making Entire Routes Client Components

```tsx
// ❌ Entire page is client-side
'use client'

export default function Page() {
  const [tab, setTab] = useState('home')

  return (
    <div>
      <Header />
      <Content tab={tab} />
      <Footer />
    </div>
  )
}

// ✅ Only tabs are client-side
export default async function Page() {
  const data = await fetchData()

  return (
    <div>
      <Header />
      <TabsContainer>
        <ServerContent data={data} />
      </TabsContainer>
      <Footer />
    </div>
  )
}
```

## Summary

Effective composition patterns:

1. **Children pattern**: Pass Server Components as children to Client Components
2. **Prop serialization**: Only pass serializable data across boundaries
3. **Wrapping**: Fetch in Server Components, pass to Client Components
4. **Context providers**: Keep them thin, children remain Server Components
5. **Interleaving**: Mix Server and Client Components efficiently
6. **Shared components**: Create components that work in both environments
7. **Loading states**: Combine Suspense with Server Components

Follow these patterns to build applications that are performant, maintainable, and take full advantage of React Server Components.
