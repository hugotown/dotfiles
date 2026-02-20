# Intercepting Routes

Intercepting routes allow you to load a route from another part of your application within the current layout. This is useful when you want to show the content of a route without the user losing their current context.

## Syntax

Intercepting routes use a special folder naming convention:

- `(.)` - match segments on the same level
- `(..)` - match segments one level above
- `(..)(..)` - match segments two levels above
- `(...)` - match segments from the root `app` directory

```
app/
├── feed/
│   ├── page.tsx
│   └── (..)photo/
│       └── [id]/
│           └── page.tsx    # Intercepts /photo/[id]
└── photo/
    └── [id]/
        └── page.tsx        # Original route
```

## How It Works

Intercepting routes allow you to:
1. Show a route's content in a modal while keeping the URL
2. Preserve the context of the current page
3. Navigate to the full page on refresh or direct visit

**Example flow:**
- User is on `/feed`
- User clicks photo → URL changes to `/photo/123`
- Intercepting route shows photo in modal (on `/feed`)
- User refreshes → Full page shows (`/photo/123`)

## Convention Patterns

### (.) Same Level

Match segments at the same level.

```
app/
├── feed/
│   ├── page.tsx            # /feed
│   └── (.)photo/
│       └── page.tsx        # Intercepts /photo
└── photo/
    └── page.tsx            # /photo
```

### (..) One Level Up

Match segments one level above.

```
app/
├── page.tsx                # /
├── photo/
│   └── [id]/
│       └── page.tsx        # /photo/[id]
└── feed/
    └── (..)photo/
        └── [id]/
            └── page.tsx    # Intercepts /photo/[id] from /feed
```

### (..)(..) Two Levels Up

Match segments two levels above.

```
app/
├── photo/
│   └── [id]/
│       └── page.tsx        # /photo/[id]
└── dashboard/
    └── feed/
        └── (..)(..)photo/
            └── [id]/
                └── page.tsx  # Intercepts /photo/[id] from /dashboard/feed
```

### (...) Root Level

Match from the root app directory.

```
app/
├── photo/
│   └── [id]/
│       └── page.tsx        # /photo/[id]
└── deep/
    └── nested/
        └── route/
            └── (...)photo/
                └── [id]/
                    └── page.tsx  # Intercepts /photo/[id] from any deep level
```

## Examples

### Photo Modal

**Directory structure:**

```
app/
├── layout.tsx
├── page.tsx
├── @modal/
│   ├── default.tsx
│   └── (..)photo/
│       └── [id]/
│           └── page.tsx    # Modal version
└── photo/
    └── [id]/
        └── page.tsx        # Full page version
```

**Root layout:**

```tsx
// app/layout.tsx
export default function Layout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <html>
      <body>
        {children}
        {modal}
      </body>
    </html>
  )
}
```

**Modal default:**

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null
}
```

**Intercepted modal:**

```tsx
// app/@modal/(..)photo/[id]/page.tsx
import { Modal } from '@/components/modal'
import Image from 'next/image'

export default function PhotoModal({
  params,
}: {
  params: { id: string }
}) {
  return (
    <Modal>
      <Image
        src={`/photos/${params.id}.jpg`}
        alt="Photo"
        width={800}
        height={600}
      />
    </Modal>
  )
}
```

**Full page:**

```tsx
// app/photo/[id]/page.tsx
import Image from 'next/image'

export default function PhotoPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <div className="container mx-auto">
      <h1>Photo {params.id}</h1>
      <Image
        src={`/photos/${params.id}.jpg`}
        alt="Photo"
        width={1200}
        height={800}
      />
    </div>
  )
}
```

**Modal component:**

```tsx
// components/modal.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const closeModal = () => {
    router.back()
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm"
      onClose={closeModal}
    >
      <div className="relative bg-white p-8 rounded-lg max-w-4xl mx-auto mt-20">
        <button
          onClick={closeModal}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
        {children}
      </div>
    </dialog>
  )
}
```

### Product Quick View

```
app/
├── products/
│   ├── page.tsx            # Product listing
│   ├── (..)product/
│   │   └── [id]/
│   │       └── page.tsx    # Quick view modal
│   └── [id]/
│       └── page.tsx        # Full product page
└── product/
    └── [id]/
        └── page.tsx        # Alternative full page route
```

### Login Modal

```
app/
├── layout.tsx
├── page.tsx
├── @auth/
│   ├── default.tsx
│   └── (.)login/
│       └── page.tsx        # Login modal
└── login/
    └── page.tsx            # Full login page
```

```tsx
// app/@auth/(.)login/page.tsx
import { Modal } from '@/components/modal'
import { LoginForm } from '@/components/login-form'

export default function LoginModal() {
  return (
    <Modal>
      <h2 className="text-2xl font-bold mb-4">Login</h2>
      <LoginForm />
    </Modal>
  )
}
```

```tsx
// app/login/page.tsx
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <div className="container mx-auto max-w-md py-16">
      <h1 className="text-4xl font-bold mb-8">Login</h1>
      <LoginForm />
    </div>
  )
}
```

### Shopping Cart Modal

```
app/
├── shop/
│   ├── page.tsx
│   └── (..)cart/
│       └── page.tsx        # Cart modal
└── cart/
    └── page.tsx            # Full cart page
```

### Gallery with Image Preview

```
app/
├── gallery/
│   ├── page.tsx            # Grid of images
│   └── (..)image/
│       └── [id]/
│           └── page.tsx    # Image preview modal
└── image/
    └── [id]/
        └── page.tsx        # Full image page
```

```tsx
// app/gallery/page.tsx
import Link from 'next/link'
import Image from 'next/image'

export default function Gallery() {
  const images = [1, 2, 3, 4, 5, 6]

  return (
    <div className="grid grid-cols-3 gap-4">
      {images.map((id) => (
        <Link key={id} href={`/image/${id}`}>
          <Image
            src={`/images/${id}.jpg`}
            alt={`Image ${id}`}
            width={300}
            height={300}
            className="hover:opacity-80 transition"
          />
        </Link>
      ))}
    </div>
  )
}
```

```tsx
// app/gallery/(..)image/[id]/page.tsx
import { Modal } from '@/components/modal'
import Image from 'next/image'

export default function ImageModal({
  params,
}: {
  params: { id: string }
}) {
  return (
    <Modal>
      <Image
        src={`/images/${params.id}.jpg`}
        alt={`Image ${params.id}`}
        width={1000}
        height={1000}
      />
    </Modal>
  )
}
```

### Settings Dialog

```
app/
├── dashboard/
│   ├── page.tsx
│   └── (.)settings/
│       └── page.tsx        # Settings modal
└── settings/
    └── page.tsx            # Full settings page
```

### Share Dialog

```
app/
├── @modal/
│   ├── default.tsx
│   └── (...)share/
│       └── [id]/
│           └── page.tsx    # Share modal (from root)
├── post/
│   └── [id]/
│       └── page.tsx
└── share/
    └── [id]/
        └── page.tsx        # Full share page
```

## Combining with Route Groups

```
app/
├── (marketing)/
│   ├── page.tsx
│   └── (..)signup/
│       └── page.tsx        # Signup modal
└── (auth)/
    └── signup/
        └── page.tsx        # Full signup page
```

## Navigation Behavior

**Soft Navigation (Client-side):**
- Intercepting route is shown (e.g., modal)
- URL changes to the target route
- User context is preserved

**Hard Navigation (Page reload/direct access):**
- Original route is shown (e.g., full page)
- No interception occurs
- Full page render

**Example:**
- User on `/feed` clicks link to `/photo/1`
- Soft navigation → Shows modal via `(..)photo/[id]`
- User refreshes → Shows full page via `/photo/[id]`

## Best Practices

### 1. Always Provide Full Page Route

```
app/
├── @modal/
│   └── (..)photo/
│       └── [id]/
│           └── page.tsx    # ✅ Modal version
└── photo/
    └── [id]/
        └── page.tsx        # ✅ Full page version (required!)
```

### 2. Use default.tsx for Parallel Routes

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null  // Hide modal by default
}
```

### 3. Reusable Components

Share logic between intercepted and full routes:

```tsx
// components/photo-view.tsx
export function PhotoView({ id }: { id: string }) {
  return <Image src={`/photos/${id}.jpg`} alt="Photo" />
}
```

```tsx
// app/@modal/(..)photo/[id]/page.tsx
import { Modal } from '@/components/modal'
import { PhotoView } from '@/components/photo-view'

export default function PhotoModal({ params }) {
  return (
    <Modal>
      <PhotoView id={params.id} />
    </Modal>
  )
}
```

```tsx
// app/photo/[id]/page.tsx
import { PhotoView } from '@/components/photo-view'

export default function PhotoPage({ params }) {
  return (
    <div className="container">
      <PhotoView id={params.id} />
    </div>
  )
}
```

## TypeScript

```tsx
type ModalProps = {
  params: { id: string }
}

export default function Modal({ params }: ModalProps) {
  return <div>Modal for {params.id}</div>
}
```

## Version History

- **v13.0.0**: Intercepting Routes introduced with App Router
- **v13.4.0**: App Router stable

## Good to Know

- Intercepting routes work with soft navigation (client-side)
- Hard navigation (refresh/direct link) shows the original route
- Use with Parallel Routes for modal patterns
- URL changes to the intercepted route
- Always provide both intercepted and full route
- Intercepting routes are relative to route groups, not file system
- Use `(.)` for same level, `(..)` for one up, `(..)(..)` for two up, `(...)` for root
- Perfect for modals, dialogs, and overlays
- Preserves user context during navigation
- Can fetch data in both versions
