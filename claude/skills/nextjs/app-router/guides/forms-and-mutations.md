# Forms and Mutations in Next.js App Router

Comprehensive guide for handling forms, data mutations, validation, and optimistic updates using Server Actions.

## Table of Contents
- [Basic Server Actions](#basic-server-actions)
- [Form Validation](#form-validation)
- [Optimistic Updates](#optimistic-updates)
- [File Uploads in Forms](#file-uploads-in-forms)
- [Error Handling](#error-handling)
- [Progressive Enhancement](#progressive-enhancement)

## Basic Server Actions

### Simple Form with Server Action

```tsx
// app/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  // Save to database
  await db.post.create({
    data: { title, content }
  })

  revalidatePath('/posts')
  redirect('/posts')
}
```

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

### Server Action with useFormState

```tsx
// app/actions.ts
'use server'

import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export async function register(prevState: any, formData: FormData) {
  const validatedFields = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password')
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  // Create user
  const user = await createUser(validatedFields.data)

  return { success: true, user }
}
```

```tsx
// app/register/page.tsx
'use client'

import { useFormState } from 'react-dom'
import { register } from '@/app/actions'

const initialState = { errors: {} }

export default function RegisterPage() {
  const [state, formAction] = useFormState(register, initialState)

  return (
    <form action={formAction}>
      <div>
        <input type="email" name="email" />
        {state.errors?.email && (
          <p className="error">{state.errors.email}</p>
        )}
      </div>

      <div>
        <input type="password" name="password" />
        {state.errors?.password && (
          <p className="error">{state.errors.password}</p>
        )}
      </div>

      <button type="submit">Register</button>
    </form>
  )
}
```

## Form Validation

### Zod Validation with Detailed Errors

```tsx
// lib/validations.ts
import { z } from 'zod'

export const postSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  published: z.boolean().default(false),
  tags: z.array(z.string()).max(5, 'Maximum 5 tags allowed')
})

export type PostFormData = z.infer<typeof postSchema>
```

```tsx
// app/actions.ts
'use server'

import { postSchema } from '@/lib/validations'

export async function createPost(prevState: any, formData: FormData) {
  const rawData = {
    title: formData.get('title'),
    content: formData.get('content'),
    published: formData.get('published') === 'on',
    tags: formData.getAll('tags')
  }

  const validated = postSchema.safeParse(rawData)

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'Validation failed'
    }
  }

  try {
    const post = await db.post.create({
      data: validated.data
    })

    revalidatePath('/posts')
    return { success: true, post }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to create post'
    }
  }
}
```

### Client-Side Validation Hook

```tsx
// hooks/useFormValidation.ts
'use client'

import { useState } from 'react'
import { z } from 'zod'

export function useFormValidation<T extends z.ZodType>(schema: T) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (data: unknown) => {
    const result = schema.safeParse(data)

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors
      setErrors(
        Object.entries(fieldErrors).reduce((acc, [key, value]) => {
          acc[key] = value?.[0] || ''
          return acc
        }, {} as Record<string, string>)
      )
      return false
    }

    setErrors({})
    return true
  }

  return { errors, validate, setErrors }
}
```

## Optimistic Updates

### Optimistic UI with useOptimistic

```tsx
// app/posts/[id]/page.tsx
'use client'

import { useOptimistic } from 'react'
import { likePost } from '@/app/actions'

export default function Post({ post }: { post: Post }) {
  const [optimisticLikes, setOptimisticLikes] = useOptimistic(
    post.likes,
    (currentLikes, amount: number) => currentLikes + amount
  )

  async function handleLike() {
    setOptimisticLikes(1)
    await likePost(post.id)
  }

  return (
    <div>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      <button onClick={handleLike}>
        Like ({optimisticLikes})
      </button>
    </div>
  )
}
```

### Optimistic List Updates

```tsx
// app/todos/page.tsx
'use client'

import { useOptimistic } from 'react'
import { addTodo, deleteTodo, toggleTodo } from '@/app/actions'

type Todo = {
  id: string
  text: string
  completed: boolean
}

export default function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [optimisticTodos, updateOptimisticTodos] = useOptimistic(
    initialTodos,
    (state, action: { type: string; payload: any }) => {
      switch (action.type) {
        case 'add':
          return [...state, action.payload]
        case 'delete':
          return state.filter(todo => todo.id !== action.payload)
        case 'toggle':
          return state.map(todo =>
            todo.id === action.payload
              ? { ...todo, completed: !todo.completed }
              : todo
          )
        default:
          return state
      }
    }
  )

  async function handleAdd(formData: FormData) {
    const text = formData.get('text') as string
    const tempId = `temp-${Date.now()}`

    updateOptimisticTodos({
      type: 'add',
      payload: { id: tempId, text, completed: false }
    })

    await addTodo(text)
  }

  async function handleToggle(id: string) {
    updateOptimisticTodos({ type: 'toggle', payload: id })
    await toggleTodo(id)
  }

  async function handleDelete(id: string) {
    updateOptimisticTodos({ type: 'delete', payload: id })
    await deleteTodo(id)
  }

  return (
    <div>
      <form action={handleAdd}>
        <input name="text" required />
        <button type="submit">Add</button>
      </form>

      <ul>
        {optimisticTodos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggle(todo.id)}
            />
            <span>{todo.text}</span>
            <button onClick={() => handleDelete(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

## File Uploads in Forms

### Simple File Upload with Server Action

```tsx
// app/actions.ts
'use server'

export async function uploadFile(formData: FormData) {
  const file = formData.get('file') as File

  if (!file) {
    return { success: false, message: 'No file provided' }
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Save to disk or upload to cloud storage
  const path = `/uploads/${file.name}`
  await writeFile(path, buffer)

  return { success: true, path }
}
```

```tsx
// components/FileUploadForm.tsx
'use client'

import { uploadFile } from '@/app/actions'
import { useFormState } from 'react-dom'

export function FileUploadForm() {
  const [state, formAction] = useFormState(uploadFile, null)

  return (
    <form action={formAction}>
      <input type="file" name="file" required />
      <button type="submit">Upload</button>
      {state?.success && <p>File uploaded: {state.path}</p>}
      {state?.success === false && <p>Error: {state.message}</p>}
    </form>
  )
}
```

## Error Handling

### Comprehensive Error Handling Pattern

```tsx
// app/actions.ts
'use server'

import { ZodError } from 'zod'

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

export async function createPost(formData: FormData): Promise<ActionResult<Post>> {
  try {
    const validated = postSchema.parse({
      title: formData.get('title'),
      content: formData.get('content')
    })

    const post = await db.post.create({ data: validated })

    revalidatePath('/posts')
    return { success: true, data: post }

  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: error.flatten().fieldErrors
      }
    }

    console.error('Failed to create post:', error)
    return {
      success: false,
      error: 'An unexpected error occurred'
    }
  }
}
```

## Progressive Enhancement

### Form that Works Without JavaScript

```tsx
// app/posts/new/page.tsx
import { createPost } from '@/app/actions'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input type="text" name="title" required />
      <textarea name="content" required />

      {/* This button works even without JS */}
      <button type="submit">Create Post</button>

      {/* Enhanced with client-side validation */}
      <noscript>
        <p>JavaScript is disabled. Form will work but without real-time validation.</p>
      </noscript>
    </form>
  )
}
```

### Enhanced Form with useFormStatus

```tsx
// components/SubmitButton.tsx
'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : children}
    </button>
  )
}
```

```tsx
// app/posts/new/page.tsx
import { createPost } from '@/app/actions'
import { SubmitButton } from '@/components/SubmitButton'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input type="text" name="title" required />
      <textarea name="content" required />
      <SubmitButton>Create Post</SubmitButton>
    </form>
  )
}
```

## Best Practices

1. **Always validate on the server** - Client validation is for UX, not security
2. **Use TypeScript with Zod** - Type-safe validation schemas
3. **Handle errors gracefully** - Return structured error objects
4. **Revalidate after mutations** - Use `revalidatePath()` or `revalidateTag()`
5. **Use optimistic updates** - Improve perceived performance
6. **Progressive enhancement** - Forms should work without JavaScript
7. **Pending states** - Use `useFormStatus()` for loading indicators
8. **Avoid mutations in GET requests** - Use Server Actions for mutations only

## Common Patterns

### Multi-Step Form

```tsx
// app/onboarding/page.tsx
'use client'

import { useState } from 'react'
import { completeOnboarding } from '@/app/actions'

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data = new FormData(e.target as HTMLFormElement)

    if (step < 3) {
      setFormData(prev => ({ ...prev, ...Object.fromEntries(data) }))
      setStep(step + 1)
    } else {
      const finalData = { ...formData, ...Object.fromEntries(data) }
      await completeOnboarding(finalData)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {step === 1 && <Step1Fields />}
      {step === 2 && <Step2Fields />}
      {step === 3 && <Step3Fields />}

      <button type="submit">
        {step < 3 ? 'Next' : 'Complete'}
      </button>
    </form>
  )
}
```

### Debounced Auto-Save

```tsx
// hooks/useAutoSave.ts
'use client'

import { useEffect, useRef } from 'react'
import { useDebounce } from '@/hooks/useDebounce'

export function useAutoSave(data: any, saveFunction: (data: any) => Promise<void>) {
  const debouncedData = useDebounce(data, 1000)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    saveFunction(debouncedData)
  }, [debouncedData, saveFunction])
}
```

## Resources

- [Next.js Server Actions Documentation](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [React useOptimistic Hook](https://react.dev/reference/react/useOptimistic)
- [Zod Validation Library](https://zod.dev/)
