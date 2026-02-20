# Server Actions

Server Actions are asynchronous server-side functions that can be called from Client or Server Components. They enable powerful data mutations and form handling with progressive enhancement.

## Basic Server Action

### Defining a Server Action

```tsx
// app/actions.ts
'use server'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  // Perform database operation
  await db.post.create({
    data: { title, content }
  })

  revalidatePath('/posts')
}
```

### Using in a Form

```tsx
// app/posts/new/page.tsx
import { createPost } from '@/app/actions'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input type="text" name="title" required />
      <textarea name="content" required />
      <button type="submit">Create Post</button>
    </form>
  )
}
```

## Inline Server Actions

Define actions directly in Server Components:

```tsx
export default function Page() {
  async function createUser(formData: FormData) {
    'use server'

    const name = formData.get('name') as string
    const email = formData.get('email') as string

    await db.user.create({
      data: { name, email }
    })

    revalidatePath('/users')
  }

  return (
    <form action={createUser}>
      <input type="text" name="name" required />
      <input type="email" name="email" required />
      <button type="submit">Create User</button>
    </form>
  )
}
```

## Server Actions with Arguments

Pass additional arguments beyond formData:

```tsx
// app/actions.ts
'use server'

export async function updatePost(id: number, formData: FormData) {
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  await db.post.update({
    where: { id },
    data: { title, content }
  })

  revalidatePath('/posts')
  revalidatePath(`/posts/${id}`)
}
```

```tsx
// app/posts/[id]/edit/page.tsx
import { updatePost } from '@/app/actions'

export default function EditPostPage({ params }: { params: { id: string } }) {
  const updatePostWithId = updatePost.bind(null, Number(params.id))

  return (
    <form action={updatePostWithId}>
      <input type="text" name="title" required />
      <textarea name="content" required />
      <button type="submit">Update Post</button>
    </form>
  )
}
```

## Calling Server Actions from Client Components

```tsx
'use client'

import { createPost } from '@/app/actions'
import { useTransition } from 'react'

export default function CreatePostForm() {
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createPost(formData)
    })
  }

  return (
    <form action={handleSubmit}>
      <input type="text" name="title" required />
      <textarea name="content" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create Post'}
      </button>
    </form>
  )
}
```

## Error Handling

### Return Errors from Server Actions

```tsx
// app/actions.ts
'use server'

import { z } from 'zod'

const PostSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1),
})

export async function createPost(formData: FormData) {
  // Validate input
  const validatedFields = PostSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  // Create post
  try {
    await db.post.create({
      data: validatedFields.data
    })
  } catch (error) {
    return {
      errors: {
        _form: ['Failed to create post']
      }
    }
  }

  revalidatePath('/posts')
  redirect('/posts')
}
```

### Handle Errors in Client Component

```tsx
'use client'

import { useFormState } from 'react-dom'
import { createPost } from '@/app/actions'

const initialState = {
  errors: {},
}

export default function CreatePostForm() {
  const [state, formAction] = useFormState(createPost, initialState)

  return (
    <form action={formAction}>
      <div>
        <input type="text" name="title" />
        {state.errors?.title && (
          <p className="text-red-500">{state.errors.title[0]}</p>
        )}
      </div>

      <div>
        <textarea name="content" />
        {state.errors?.content && (
          <p className="text-red-500">{state.errors.content[0]}</p>
        )}
      </div>

      {state.errors?._form && (
        <p className="text-red-500">{state.errors._form[0]}</p>
      )}

      <button type="submit">Create Post</button>
    </form>
  )
}
```

## Authentication and Authorization

```tsx
'use server'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function deletePost(postId: number) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  // Check if user owns the post
  const post = await db.post.findUnique({
    where: { id: postId }
  })

  if (post.authorId !== session.user.id) {
    throw new Error('Unauthorized')
  }

  await db.post.delete({
    where: { id: postId }
  })

  revalidatePath('/posts')
}
```

## Optimistic Updates

```tsx
'use client'

import { useOptimistic } from 'react'
import { addTodo } from '@/app/actions'

export default function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, newTodo]
  )

  async function handleSubmit(formData: FormData) {
    const title = formData.get('title') as string

    // Optimistically add the todo
    addOptimisticTodo({ id: Date.now(), title, completed: false })

    // Actually add the todo on the server
    await addTodo(formData)
  }

  return (
    <div>
      <form action={handleSubmit}>
        <input type="text" name="title" required />
        <button type="submit">Add Todo</button>
      </form>

      <ul>
        {optimisticTodos.map(todo => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

## Revalidation

### Revalidate Paths

```tsx
'use server'

import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  // Create post...

  // Revalidate specific paths
  revalidatePath('/posts')           // Revalidate posts list
  revalidatePath(`/posts/${post.id}`) // Revalidate the new post page
  revalidatePath('/dashboard')        // Revalidate dashboard
}
```

### Revalidate Tags

```tsx
'use server'

import { revalidateTag } from 'next/cache'

export async function updateUser(userId: number, formData: FormData) {
  // Update user...

  // Revalidate all requests tagged with 'users'
  revalidateTag('users')
  revalidateTag(`user-${userId}`)
}
```

## Progressive Enhancement

Server Actions work without JavaScript enabled:

```tsx
// This form works even without JavaScript
export default function Page() {
  async function createMessage(formData: FormData) {
    'use server'

    const message = formData.get('message') as string
    await db.message.create({ data: { message } })

    revalidatePath('/')
  }

  return (
    <form action={createMessage}>
      <input type="text" name="message" required />
      <button type="submit">Send</button>
    </form>
  )
}
```

## File Uploads

```tsx
'use server'

import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function uploadFile(formData: FormData) {
  const file = formData.get('file') as File

  if (!file) {
    throw new Error('No file provided')
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Save to disk
  const path = join(process.cwd(), 'uploads', file.name)
  await writeFile(path, buffer)

  // Or upload to cloud storage
  // await uploadToS3(buffer, file.name)

  revalidatePath('/files')

  return { success: true }
}
```

```tsx
'use client'

import { uploadFile } from '@/app/actions'

export default function UploadForm() {
  return (
    <form action={uploadFile}>
      <input type="file" name="file" required />
      <button type="submit">Upload</button>
    </form>
  )
}
```

## Non-Form Actions

Server Actions can be called outside of forms:

```tsx
'use client'

import { likePost } from '@/app/actions'
import { useTransition } from 'react'

export default function LikeButton({ postId }: { postId: number }) {
  const [isPending, startTransition] = useTransition()

  function handleLike() {
    startTransition(async () => {
      await likePost(postId)
    })
  }

  return (
    <button onClick={handleLike} disabled={isPending}>
      {isPending ? 'Liking...' : 'Like'}
    </button>
  )
}
```

```tsx
// app/actions.ts
'use server'

export async function likePost(postId: number) {
  const session = await auth()

  if (!session) {
    throw new Error('Must be logged in to like posts')
  }

  await db.like.create({
    data: {
      postId,
      userId: session.user.id
    }
  })

  revalidatePath('/posts')
  revalidatePath(`/posts/${postId}`)
}
```

## Returning Data from Server Actions

```tsx
'use server'

export async function searchPosts(query: string) {
  const posts = await db.post.findMany({
    where: {
      OR: [
        { title: { contains: query } },
        { content: { contains: query } }
      ]
    }
  })

  return posts
}
```

```tsx
'use client'

import { searchPosts } from '@/app/actions'
import { useState, useTransition } from 'react'

export default function SearchForm() {
  const [results, setResults] = useState([])
  const [isPending, startTransition] = useTransition()

  async function handleSearch(formData: FormData) {
    const query = formData.get('query') as string

    startTransition(async () => {
      const posts = await searchPosts(query)
      setResults(posts)
    })
  }

  return (
    <div>
      <form action={handleSearch}>
        <input type="search" name="query" />
        <button type="submit">Search</button>
      </form>

      {isPending && <p>Searching...</p>}

      <ul>
        {results.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

## Security Considerations

1. **Always validate input** - Never trust client data
2. **Use authentication** - Check user session in sensitive actions
3. **Use authorization** - Verify user permissions
4. **Sanitize data** - Clean user input before storing
5. **Use CSRF protection** - Next.js provides this automatically
6. **Rate limit** - Prevent abuse of server actions
7. **Validate file uploads** - Check file types and sizes
8. **Use environment variables** - Keep secrets secure
9. **Log actions** - Track mutations for audit trails
10. **Handle errors gracefully** - Don't expose sensitive error details

## Best Practices

1. **Use TypeScript** - Type your actions for safety
2. **Validate with Zod** - Schema validation for inputs
3. **Keep actions focused** - One action, one responsibility
4. **Use try-catch** - Handle errors appropriately
5. **Revalidate strategically** - Only revalidate what changed
6. **Use useTransition** - For pending states in client components
7. **Return meaningful errors** - Help users fix issues
8. **Test your actions** - Unit test server actions
9. **Use progressive enhancement** - Work without JavaScript
10. **Monitor performance** - Track slow actions

## Common Patterns

### CRUD Operations

```tsx
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Create
export async function createPost(formData: FormData) {
  const post = await db.post.create({
    data: {
      title: formData.get('title') as string,
      content: formData.get('content') as string,
    }
  })
  revalidatePath('/posts')
  redirect(`/posts/${post.id}`)
}

// Read (typically done in Server Components, not actions)

// Update
export async function updatePost(id: number, formData: FormData) {
  await db.post.update({
    where: { id },
    data: {
      title: formData.get('title') as string,
      content: formData.get('content') as string,
    }
  })
  revalidatePath('/posts')
  revalidatePath(`/posts/${id}`)
}

// Delete
export async function deletePost(id: number) {
  await db.post.delete({ where: { id } })
  revalidatePath('/posts')
  redirect('/posts')
}
```

### Batch Operations

```tsx
'use server'

export async function deletePosts(postIds: number[]) {
  await db.post.deleteMany({
    where: {
      id: { in: postIds }
    }
  })

  revalidatePath('/posts')
}
```

### Transaction Pattern

```tsx
'use server'

export async function transferOwnership(postId: number, newOwnerId: number) {
  const result = await db.$transaction(async (tx) => {
    const post = await tx.post.update({
      where: { id: postId },
      data: { authorId: newOwnerId }
    })

    await tx.notification.create({
      data: {
        userId: newOwnerId,
        message: `You are now the owner of "${post.title}"`
      }
    })

    return post
  })

  revalidatePath('/posts')
  return result
}
```
