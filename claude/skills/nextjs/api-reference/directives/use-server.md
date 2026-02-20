# use server

The `'use server'` directive marks functions as Server Actions, enabling secure server-side code execution that can be called directly from Client Components. Server Actions are ideal for mutations, form handling, and operations requiring server-side security.

## Syntax

```typescript
'use server'
```

Can be placed at:
1. **Top of a file** - Makes all exported functions Server Actions
2. **Top of a function** - Makes only that function a Server Action

## Use Cases

### 1. Form Handling

Handle form submissions with progressive enhancement.

```typescript
// app/actions/auth.ts
'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2)
})

export async function signup(formData: FormData) {
  // Validate input
  const result = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name')
  })

  if (!result.success) {
    return {
      error: 'Invalid input',
      issues: result.error.flatten()
    }
  }

  const { email, password, name } = result.data

  // Hash password (server-side only)
  const hashedPassword = await hashPassword(password)

  // Create user in database
  const user = await db.user.create({
    data: {
      email,
      password: hashedPassword,
      name
    }
  })

  // Create session
  await createSession(user.id)

  // Redirect to dashboard
  redirect('/dashboard')
}
```

```typescript
// app/signup/page.tsx
'use client'

import { signup } from '../actions/auth'
import { useFormState, useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Creating account...' : 'Sign up'}
    </button>
  )
}

export default function SignupPage() {
  const [state, formAction] = useFormState(signup, null)

  return (
    <form action={formAction}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />

      {state?.error && <p className="error">{state.error}</p>}

      <SubmitButton />
    </form>
  )
}
```

### 2. Data Mutations

Secure server-side database operations.

```typescript
// app/actions/posts.ts
'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'

export async function createPost(formData: FormData) {
  // Authenticate user
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const title = formData.get('title') as string
  const content = formData.get('content') as string

  // Validate
  if (!title || !content) {
    return { error: 'Title and content are required' }
  }

  // Create post
  const post = await db.post.create({
    data: {
      title,
      content,
      authorId: session.user.id,
      published: false
    }
  })

  // Revalidate the posts page
  revalidatePath('/posts')

  return { success: true, postId: post.id }
}

export async function updatePost(postId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  // Verify ownership
  const post = await db.post.findUnique({
    where: { id: postId }
  })

  if (post?.authorId !== session.user.id) {
    throw new Error('Forbidden')
  }

  // Update
  const updated = await db.post.update({
    where: { id: postId },
    data: {
      title: formData.get('title') as string,
      content: formData.get('content') as string
    }
  })

  revalidatePath(`/posts/${postId}`)
  revalidatePath('/posts')

  return { success: true }
}

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const post = await db.post.findUnique({
    where: { id: postId }
  })

  if (post?.authorId !== session.user.id) {
    throw new Error('Forbidden')
  }

  await db.post.delete({
    where: { id: postId }
  })

  revalidatePath('/posts')
  redirect('/posts')
}
```

### 3. Inline Server Actions

Define Server Actions directly in Server Components.

```typescript
// app/posts/[id]/page.tsx
import { revalidatePath } from 'next/cache'

export default async function PostPage({ params }: { params: { id: string } }) {
  const post = await db.post.findUnique({
    where: { id: params.id }
  })

  // Inline Server Action
  async function likePost() {
    'use server'

    await db.post.update({
      where: { id: params.id },
      data: { likes: { increment: 1 } }
    })

    revalidatePath(`/posts/${params.id}`)
  }

  return (
    <div>
      <h1>{post?.title}</h1>
      <p>{post?.content}</p>
      <form action={likePost}>
        <button type="submit">
          Like ({post?.likes || 0})
        </button>
      </form>
    </div>
  )
}
```

### 4. File Uploads

Handle file uploads securely on the server.

```typescript
// app/actions/upload.ts
'use server'

import { writeFile } from 'fs/promises'
import { join } from 'path'
import { auth } from '@/lib/auth'

export async function uploadAvatar(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const file = formData.get('avatar') as File

  if (!file) {
    return { error: 'No file provided' }
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type' }
  }

  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    return { error: 'File too large' }
  }

  // Generate unique filename
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const filename = `${session.user.id}-${Date.now()}.${file.type.split('/')[1]}`
  const filepath = join(process.cwd(), 'public', 'avatars', filename)

  // Save file
  await writeFile(filepath, buffer)

  // Update user avatar in database
  await db.user.update({
    where: { id: session.user.id },
    data: { avatar: `/avatars/${filename}` }
  })

  revalidatePath('/profile')

  return { success: true, url: `/avatars/${filename}` }
}
```

### 5. Background Jobs and Long-Running Tasks

Trigger background processing from Server Actions.

```typescript
// app/actions/export.ts
'use server'

import { auth } from '@/lib/auth'
import { queue } from '@/lib/queue'

export async function exportUserData() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  // Queue background job
  const job = await queue.add('export-user-data', {
    userId: session.user.id,
    requestedAt: new Date()
  })

  // Create export record
  const exportRecord = await db.export.create({
    data: {
      userId: session.user.id,
      status: 'pending',
      jobId: job.id
    }
  })

  return {
    success: true,
    exportId: exportRecord.id,
    message: 'Export started. You will receive an email when ready.'
  }
}

export async function sendBulkEmails(recipients: string[], message: string) {
  const session = await auth()
  if (!session?.user?.isAdmin) {
    throw new Error('Admin access required')
  }

  // Queue each email
  for (const email of recipients) {
    await queue.add('send-email', {
      to: email,
      subject: 'Announcement',
      body: message,
      from: session.user.email
    })
  }

  return { success: true, queued: recipients.length }
}
```

## Best Practices

### 1. Always Validate and Sanitize Input

```typescript
'use server'

import { z } from 'zod'

const updateProfileSchema = z.object({
  name: z.string().min(2).max(50),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional()
})

export async function updateProfile(formData: FormData) {
  // Validate
  const result = updateProfileSchema.safeParse({
    name: formData.get('name'),
    bio: formData.get('bio'),
    website: formData.get('website')
  })

  if (!result.success) {
    return {
      error: 'Validation failed',
      issues: result.error.format()
    }
  }

  // Proceed with validated data
  const { name, bio, website } = result.data
  // ...
}
```

### 2. Implement Proper Authentication and Authorization

```typescript
'use server'

import { auth } from '@/lib/auth'

export async function deleteUser(userId: string) {
  const session = await auth()

  // Authentication check
  if (!session?.user) {
    throw new Error('Not authenticated')
  }

  // Authorization check
  if (session.user.id !== userId && !session.user.isAdmin) {
    throw new Error('Not authorized')
  }

  // Proceed with deletion
  await db.user.delete({ where: { id: userId } })

  revalidatePath('/users')
}
```

### 3. Use Optimistic Updates with Client Components

```typescript
// actions.ts
'use server'

export async function toggleTodo(id: string) {
  const todo = await db.todo.findUnique({ where: { id } })

  await db.todo.update({
    where: { id },
    data: { completed: !todo?.completed }
  })

  revalidatePath('/todos')

  return { completed: !todo?.completed }
}

// TodoItem.tsx
'use client'

import { toggleTodo } from './actions'
import { useOptimistic } from 'react'

export function TodoItem({ todo }: { todo: Todo }) {
  const [optimisticTodo, setOptimisticTodo] = useOptimistic(
    todo,
    (state, completed: boolean) => ({ ...state, completed })
  )

  const handleToggle = async () => {
    setOptimisticTodo(!optimisticTodo.completed)
    await toggleTodo(todo.id)
  }

  return (
    <div>
      <input
        type="checkbox"
        checked={optimisticTodo.completed}
        onChange={handleToggle}
      />
      <span>{optimisticTodo.title}</span>
    </div>
  )
}
```

### 4. Handle Errors Gracefully

```typescript
'use server'

export async function createInvoice(formData: FormData) {
  try {
    const invoice = await db.invoice.create({
      data: {
        amount: Number(formData.get('amount')),
        customerId: formData.get('customerId') as string
      }
    })

    // Send email notification
    await sendInvoiceEmail(invoice)

    revalidatePath('/invoices')

    return { success: true, invoiceId: invoice.id }

  } catch (error) {
    console.error('Failed to create invoice:', error)

    if (error instanceof z.ZodError) {
      return { error: 'Invalid input', details: error.format() }
    }

    if (error.code === 'P2002') {
      return { error: 'Invoice already exists' }
    }

    return { error: 'Failed to create invoice' }
  }
}
```

### 5. Revalidate Cache Appropriately

```typescript
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

export async function updateProduct(productId: string, data: ProductData) {
  await db.product.update({
    where: { id: productId },
    data
  })

  // Revalidate specific paths
  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)

  // Or use tags for more granular control
  revalidateTag(`product-${productId}`)
  revalidateTag('products-list')

  return { success: true }
}
```

## Common Pitfalls to Avoid

### 1. Don't Expose Sensitive Operations

```typescript
// Bad - anyone can call this
'use server'

export async function deleteAllUsers() {
  await db.user.deleteMany()
}

// Good - protected with authorization
'use server'

export async function deleteAllUsers() {
  const session = await auth()

  if (!session?.user?.isAdmin) {
    throw new Error('Admin access required')
  }

  await db.user.deleteMany()
}
```

### 2. Don't Return Sensitive Data

```typescript
// Bad - exposes password hash
'use server'

export async function getUser(id: string) {
  return await db.user.findUnique({ where: { id } })
}

// Good - filter sensitive fields
'use server'

export async function getUser(id: string) {
  return await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true
      // password: false (excluded)
    }
  })
}
```

### 3. Avoid Heavy Computations Without Rate Limiting

```typescript
// Bad - no rate limiting
'use server'

export async function generateReport() {
  return await heavyComputation()
}

// Good - implement rate limiting
'use server'

import { rateLimit } from '@/lib/rate-limit'

export async function generateReport() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  // Check rate limit
  const { success } = await rateLimit.check(session.user.id, 'generate-report')
  if (!success) {
    throw new Error('Rate limit exceeded. Try again later.')
  }

  return await heavyComputation()
}
```

### 4. Don't Forget CSRF Protection

Next.js automatically includes CSRF protection for Server Actions, but be aware:

```typescript
// Server Actions are protected by default
'use server'

export async function sensitiveAction() {
  // CSRF token is automatically validated
  // Action only works when called from your application
}
```

## Progressive Enhancement

Server Actions work without JavaScript:

```typescript
// app/search/page.tsx
async function search(formData: FormData) {
  'use server'

  const query = formData.get('q') as string
  redirect(`/search?q=${encodeURIComponent(query)}`)
}

export default function SearchPage() {
  return (
    <form action={search}>
      <input name="q" placeholder="Search..." required />
      <button type="submit">Search</button>
    </form>
  )
}

// Works without JavaScript! Form submits as regular POST request
```

## TypeScript Support

```typescript
'use server'

interface CreatePostInput {
  title: string
  content: string
  tags?: string[]
}

interface CreatePostResult {
  success: boolean
  postId?: string
  error?: string
}

export async function createPost(
  input: CreatePostInput
): Promise<CreatePostResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const post = await db.post.create({
      data: {
        ...input,
        authorId: session.user.id
      }
    })

    return { success: true, postId: post.id }

  } catch (error) {
    return { success: false, error: 'Failed to create post' }
  }
}
```

## Security Considerations

1. **Always validate input** - Never trust client data
2. **Authenticate requests** - Check user sessions
3. **Authorize actions** - Verify permissions
4. **Sanitize data** - Prevent injection attacks
5. **Rate limit** - Prevent abuse
6. **Log actions** - Audit trail for sensitive operations
7. **Use HTTPS** - Server Actions only work over secure connections

## Related Directives

- [use client](./use-client.md) - Client Components that can call Server Actions
- [use cache](./use-cache.md) - Should not be combined with Server Actions
