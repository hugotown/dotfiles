# Intercepting Routes in Next.js App Router

Intercepting routes allow you to load a route from another part of your application within the current layout. This is useful for showing content in a modal or overlay while keeping the context of the current page, commonly used for modals, lightboxes, and drawers.

## Overview

Intercepting routes use special conventions to "intercept" a route and show it in a different context. This enables patterns where clicking a link shows a modal, but refreshing or directly visiting the URL shows the full page.

## Convention Syntax

Intercepting routes use parentheses with special prefixes:

- `(.)` - Match segments at the **same level**
- `(..)` - Match segments **one level up**
- `(..)(..)` - Match segments **two levels up**
- `(...)` - Match segments from the **root** `app` directory

### Visual Guide

```
app/
  feed/
    page.tsx
    (.)photo/         # Same level: intercepts /photo from /feed
    (..)settings/     # One up: intercepts /settings from /feed
    (...)login/       # Root: intercepts /login from anywhere
```

## Basic Pattern: Modal with Intercepting Routes

### File Structure

```
app/
  @modal/
    (.)photo/
      [id]/
        page.tsx      # Modal view
    default.tsx
  photo/
    [id]/
      page.tsx        # Full page view
  layout.tsx
  page.tsx
```

### Implementation

**Root Layout:**

```typescript
// app/layout.tsx
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {modal}
      </body>
    </html>
  )
}
```

**Modal Interceptor:**

```typescript
// app/@modal/(.)photo/[id]/page.tsx
import { Modal } from '@/components/Modal'
import { getPhoto } from '@/lib/photos'

export default async function PhotoModal({
  params,
}: {
  params: { id: string }
}) {
  const photo = await getPhoto(params.id)

  return (
    <Modal>
      <img src={photo.url} alt={photo.title} className="w-full" />
      <h2>{photo.title}</h2>
      <p>{photo.description}</p>
    </Modal>
  )
}
```

**Full Page View:**

```typescript
// app/photo/[id]/page.tsx
import { getPhoto } from '@/lib/photos'

export default async function PhotoPage({
  params,
}: {
  params: { id: string }
}) {
  const photo = await getPhoto(params.id)

  return (
    <div className="container mx-auto p-8">
      <img src={photo.url} alt={photo.title} className="w-full max-w-4xl" />
      <h1 className="text-4xl mt-4">{photo.title}</h1>
      <p className="mt-2 text-lg">{photo.description}</p>
      <div className="mt-4">
        <h3>Photo Details</h3>
        <dl>
          <dt>Taken:</dt>
          <dd>{photo.date}</dd>
          <dt>Location:</dt>
          <dd>{photo.location}</dd>
        </dl>
      </div>
    </div>
  )
}
```

**Modal Default:**

```typescript
// app/@modal/default.tsx
export default function Default() {
  return null
}
```

**Modal Component:**

```typescript
// components/Modal.tsx
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
      className="modal backdrop:bg-black/50"
      onClick={closeModal}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button onClick={closeModal} className="close-button">
          ×
        </button>
        {children}
      </div>
    </dialog>
  )
}
```

### Behavior

**Client-side navigation** (clicking link):
- URL: `/photo/123`
- Shows: Modal overlay with photo (from `@modal/(.)photo/[id]/page.tsx`)
- Background: Remains on current page

**Direct navigation** (refresh, bookmark):
- URL: `/photo/123`
- Shows: Full page (from `photo/[id]/page.tsx`)

## Matching Levels

### Same Level `(.)`

Intercept routes at the same directory level:

```
app/
  feed/
    page.tsx          # /feed
    (.)photo/
      [id]/
        page.tsx      # Intercepts /photo/[id] when on /feed
  photo/
    [id]/
      page.tsx        # /photo/[id]
```

When on `/feed` and navigating to `/photo/123`, the interceptor shows the modal.

### One Level Up `(..)`

Intercept routes one directory level above:

```
app/
  dashboard/
    analytics/
      page.tsx        # /dashboard/analytics
      (..)settings/
        page.tsx      # Intercepts /dashboard/settings
  settings/
    page.tsx          # /dashboard/settings
```

When on `/dashboard/analytics` and navigating to `/dashboard/settings`, the interceptor activates.

### Two Levels Up `(..)(..)`

Intercept routes two directory levels above:

```
app/
  teams/
    [teamId]/
      projects/
        [projectId]/
          page.tsx    # /teams/1/projects/1
          (..)(..)settings/
            page.tsx  # Intercepts /teams/1/settings
  settings/
    page.tsx
```

### Root Level `(...)`

Intercept routes from the root `app` directory:

```
app/
  dashboard/
    feed/
      page.tsx        # /dashboard/feed
      (...)login/
        page.tsx      # Intercepts /login from anywhere
  login/
    page.tsx          # /login
```

The `(...)` matcher intercepts from the root regardless of current location.

## Common Use Cases

### 1. Image Gallery Modal

```
app/
  gallery/
    layout.tsx
    page.tsx
    @modal/
      (.)photo/
        [id]/
          page.tsx    # Modal view
      default.tsx
  photo/
    [id]/
      page.tsx        # Full page
```

**Gallery Page:**

```typescript
// app/gallery/page.tsx
import Link from 'next/link'
import { getPhotos } from '@/lib/photos'

export default async function Gallery() {
  const photos = await getPhotos()

  return (
    <div className="grid grid-cols-3 gap-4">
      {photos.map((photo) => (
        <Link key={photo.id} href={`/photo/${photo.id}`}>
          <img src={photo.thumbnail} alt={photo.title} />
        </Link>
      ))}
    </div>
  )
}
```

### 2. Login Modal

```
app/
  @auth/
    (...)login/
      page.tsx        # Modal login
    default.tsx
  login/
    page.tsx          # Full page login
  layout.tsx
```

**Auth Modal Layout:**

```typescript
// app/layout.tsx
export default function RootLayout({
  children,
  auth,
}: {
  children: React.ReactNode
  auth: React.ReactNode
}) {
  return (
    <html>
      <body>
        {children}
        {auth}
      </body>
    </html>
  )
}
```

**Intercepted Login:**

```typescript
// app/@auth/(...)login/page.tsx
import { Modal } from '@/components/Modal'
import { LoginForm } from '@/components/LoginForm'

export default function LoginModal() {
  return (
    <Modal>
      <h2>Sign In</h2>
      <LoginForm />
    </Modal>
  )
}
```

### 3. Product Quick View

```
app/
  products/
    page.tsx
    @quickview/
      (.)product/
        [id]/
          page.tsx    # Quick view modal
      default.tsx
  product/
    [id]/
      page.tsx        # Full product page
  layout.tsx
```

**Quick View Modal:**

```typescript
// app/products/@quickview/(.)product/[id]/page.tsx
import { Modal } from '@/components/Modal'
import { getProduct } from '@/lib/products'
import Link from 'next/link'

export default async function ProductQuickView({
  params,
}: {
  params: { id: string }
}) {
  const product = await getProduct(params.id)

  return (
    <Modal>
      <div className="grid md:grid-cols-2 gap-4">
        <img src={product.image} alt={product.name} />
        <div>
          <h2>{product.name}</h2>
          <p className="text-2xl">${product.price}</p>
          <p>{product.shortDescription}</p>
          <Link href={`/product/${product.id}`} className="btn">
            View Full Details
          </Link>
        </div>
      </div>
    </Modal>
  )
}
```

### 4. Settings Drawer

```
app/
  dashboard/
    page.tsx
    @drawer/
      (.)settings/
        page.tsx      # Drawer view
      default.tsx
  settings/
    page.tsx          # Full settings page
  layout.tsx
```

**Drawer Component:**

```typescript
// components/Drawer.tsx
'use client'

import { useRouter } from 'next/navigation'

export function Drawer({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => router.back()}
      />
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-white z-50 shadow-xl">
        <button
          onClick={() => router.back()}
          className="absolute top-4 right-4"
        >
          ×
        </button>
        <div className="p-6">{children}</div>
      </div>
    </>
  )
}
```

### 5. Multi-Step Form Modal

```
app/
  @modal/
    (.)signup/
      page.tsx        # Step 1
      confirm/
        page.tsx      # Step 2
      complete/
        page.tsx      # Step 3
    default.tsx
  signup/
    page.tsx          # Full signup flow
  layout.tsx
```

## Advanced Patterns

### Modal with Shared State

```typescript
// app/@modal/(.)product/[id]/page.tsx
'use client'

import { Modal } from '@/components/Modal'
import { useCart } from '@/hooks/useCart'

export default function ProductModal({
  params,
}: {
  params: { id: string }
}) {
  const { addToCart } = useCart()

  return (
    <Modal>
      <ProductDetails id={params.id} />
      <button onClick={() => addToCart(params.id)}>
        Add to Cart
      </button>
    </Modal>
  )
}
```

### Nested Intercepting Routes

```
app/
  @modal/
    (.)product/
      [id]/
        page.tsx
        @reviews/
          (.)review/
            [reviewId]/
              page.tsx   # Nested modal
        layout.tsx
    default.tsx
```

### Conditional Interception

```typescript
// app/@modal/(.)photo/[id]/page.tsx
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default function PhotoModal({ params }: { params: { id: string } }) {
  const headersList = headers()
  const referer = headersList.get('referer')

  // Only intercept if coming from gallery
  if (!referer?.includes('/gallery')) {
    redirect(`/photo/${params.id}`)
  }

  return <Modal>{/* Photo content */}</Modal>
}
```

## Best Practices

### 1. Always Provide Full Page Alternative

Ensure the intercepted route has a full page version:

```
✅ Good
app/
  @modal/(.)photo/[id]/page.tsx  # Modal
  photo/[id]/page.tsx            # Full page

❌ Bad
app/
  @modal/(.)photo/[id]/page.tsx  # Modal only
```

### 2. Use default.tsx to Clear Slots

```typescript
// app/@modal/default.tsx
export default function Default() {
  return null // Clears modal slot
}
```

### 3. Handle Back Navigation

```typescript
'use client'

import { useRouter } from 'next/navigation'

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <div onClick={() => router.back()}>
      {children}
    </div>
  )
}
```

### 4. Prevent Background Scroll

```typescript
// components/Modal.tsx
'use client'

import { useEffect } from 'react'

export function Modal({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return <div className="modal">{children}</div>
}
```

### 5. Use Semantic HTML

```typescript
export function Modal({ children }: { children: React.ReactNode }) {
  return (
    <dialog open className="modal">
      <div role="document">
        {children}
      </div>
    </dialog>
  )
}
```

### 6. Maintain Accessibility

```typescript
export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <div
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === 'Escape') router.back()
      }}
    >
      {children}
    </div>
  )
}
```

## Common Pitfalls

### 1. Wrong Interception Level

```
❌ Wrong level
app/
  products/
    page.tsx
    (.)product/[id]/    # Should be (..) if product/ is sibling

✅ Correct
app/
  products/
    page.tsx
  product/[id]/
    page.tsx
  @modal/
    (.)product/[id]/    # Correct for root level
```

### 2. Missing Parallel Route

```
❌ No parallel route
app/
  (.)photo/[id]/page.tsx    # Won't work alone

✅ With parallel route
app/
  @modal/
    (.)photo/[id]/page.tsx  # Works in parallel route
```

### 3. Not Handling Direct Access

```
❌ Modal only
# User refreshes /photo/123 → Error!

✅ Both views
app/
  @modal/(.)photo/[id]/page.tsx   # Modal
  photo/[id]/page.tsx             # Full page
```

### 4. Incorrect Route Group Usage

```
Intercepting: (.)  - Period inside
Route Group: (marketing) - No period
```

## Troubleshooting

### Modal Not Showing

Check:
1. Parallel route is set up correctly
2. Layout receives and renders modal prop
3. default.tsx returns null
4. Navigation is client-side (using Link or router.push)

### Full Page Shows Instead of Modal

This happens on:
- Direct URL access (expected behavior)
- Page refresh (expected behavior)
- Wrong interception matcher (check levels)

### Modal Doesn't Close

Ensure:
- router.back() is called on close
- Backdrop click handler is set up
- Escape key handler (optional)

## Summary

Intercepting routes enable powerful modal and overlay patterns:

- **Matchers**: `(.)` same level, `(..)` one up, `(...)` root
- **Pattern**: Combine with parallel routes (`@modal`)
- **Dual Views**: Always provide full page alternative
- **Navigation**: Modal on client nav, full page on direct access
- **Accessibility**: Handle keyboard, focus, and screen readers
- **Use Cases**: Image galleries, login, quick views, drawers

Intercepting routes maintain URL state while providing contextual UI, creating smooth user experiences with shareable, refreshable URLs.
