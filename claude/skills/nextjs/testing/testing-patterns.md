# Next.js Testing Patterns

This guide provides comprehensive testing patterns for common Next.js scenarios including Server Components, Client Components, Server Actions, API Routes, Middleware, and more.

## Table of Contents

- [Server Components](#server-components)
- [Client Components](#client-components)
- [Server Actions](#server-actions)
- [API Routes](#api-routes)
- [Middleware](#middleware)
- [Forms](#forms)
- [Authentication](#authentication)
- [Data Fetching](#data-fetching)
- [Error Handling](#error-handling)
- [Parallel Routes](#parallel-routes)
- [Route Handlers](#route-handlers)

## Server Components

Server Components run on the server and can directly access backend resources. Test them by mocking data sources and verifying rendered output.

### Basic Server Component

```typescript
// app/components/ArticleList.tsx
import { getArticles } from '@/lib/api'

export default async function ArticleList({ category }: { category?: string }) {
  const articles = await getArticles(category)

  if (!articles.length) {
    return <p>No articles found</p>
  }

  return (
    <div>
      <h1>Articles</h1>
      <ul>
        {articles.map(article => (
          <li key={article.id}>
            <h2>{article.title}</h2>
            <p>{article.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

```typescript
// app/components/__tests__/ArticleList.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ArticleList from '../ArticleList'

vi.mock('@/lib/api', () => ({
  getArticles: vi.fn(),
}))

import { getArticles } from '@/lib/api'

describe('ArticleList', () => {
  it('renders articles', async () => {
    const mockArticles = [
      { id: '1', title: 'Article 1', summary: 'Summary 1' },
      { id: '2', title: 'Article 2', summary: 'Summary 2' },
    ]

    vi.mocked(getArticles).mockResolvedValue(mockArticles)

    const component = await ArticleList({})
    render(component)

    expect(screen.getByText('Article 1')).toBeInTheDocument()
    expect(screen.getByText('Article 2')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    vi.mocked(getArticles).mockResolvedValue([])

    const component = await ArticleList({})
    render(component)

    expect(screen.getByText('No articles found')).toBeInTheDocument()
  })

  it('filters by category', async () => {
    vi.mocked(getArticles).mockResolvedValue([])

    await ArticleList({ category: 'tech' })

    expect(getArticles).toHaveBeenCalledWith('tech')
  })
})
```

### Server Component with Error Handling

```typescript
// app/components/WeatherWidget.tsx
import { getWeather } from '@/lib/weather'

export default async function WeatherWidget({ city }: { city: string }) {
  try {
    const weather = await getWeather(city)

    return (
      <div>
        <h2>Weather in {city}</h2>
        <p>Temperature: {weather.temp}°F</p>
        <p>Conditions: {weather.conditions}</p>
      </div>
    )
  } catch (error) {
    return (
      <div>
        <h2>Weather Unavailable</h2>
        <p>Could not fetch weather data for {city}</p>
      </div>
    )
  }
}
```

```typescript
// app/components/__tests__/WeatherWidget.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import WeatherWidget from '../WeatherWidget'

vi.mock('@/lib/weather', () => ({
  getWeather: vi.fn(),
}))

import { getWeather } from '@/lib/weather'

describe('WeatherWidget', () => {
  it('displays weather data', async () => {
    vi.mocked(getWeather).mockResolvedValue({
      temp: 72,
      conditions: 'Sunny',
    })

    const component = await WeatherWidget({ city: 'San Francisco' })
    render(component)

    expect(screen.getByText('Weather in San Francisco')).toBeInTheDocument()
    expect(screen.getByText('Temperature: 72°F')).toBeInTheDocument()
    expect(screen.getByText('Conditions: Sunny')).toBeInTheDocument()
  })

  it('handles errors gracefully', async () => {
    vi.mocked(getWeather).mockRejectedValue(new Error('API error'))

    const component = await WeatherWidget({ city: 'San Francisco' })
    render(component)

    expect(screen.getByText('Weather Unavailable')).toBeInTheDocument()
    expect(screen.getByText(/Could not fetch weather data/)).toBeInTheDocument()
  })
})
```

## Client Components

Client Components handle interactivity and browser APIs. Test them with user events and state changes.

### Interactive Component with State

```typescript
// app/components/TodoList.tsx
'use client'

import { useState } from 'react'

interface Todo {
  id: string
  text: string
  completed: boolean
}

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [input, setInput] = useState('')

  const addTodo = () => {
    if (!input.trim()) return

    const newTodo: Todo = {
      id: Date.now().toString(),
      text: input,
      completed: false,
    }

    setTodos([...todos, newTodo])
    setInput('')
  }

  const toggleTodo = (id: string) => {
    setTodos(
      todos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    )
  }

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  return (
    <div>
      <h1>Todo List</h1>
      <div>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTodo()}
          placeholder="Add a todo"
          aria-label="New todo"
        />
        <button onClick={addTodo}>Add</button>
      </div>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
              aria-label={`Toggle ${todo.text}`}
            />
            <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
              {todo.text}
            </span>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

```typescript
// app/components/__tests__/TodoList.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import TodoList from '../TodoList'

describe('TodoList', () => {
  it('adds a new todo', async () => {
    const user = userEvent.setup()
    render(<TodoList />)

    const input = screen.getByLabelText('New todo')
    await user.type(input, 'Buy groceries')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByText('Buy groceries')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('adds todo on Enter key', async () => {
    const user = userEvent.setup()
    render(<TodoList />)

    const input = screen.getByLabelText('New todo')
    await user.type(input, 'Read book{Enter}')

    expect(screen.getByText('Read book')).toBeInTheDocument()
  })

  it('does not add empty todo', async () => {
    const user = userEvent.setup()
    render(<TodoList />)

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('toggles todo completion', async () => {
    const user = userEvent.setup()
    render(<TodoList />)

    // Add a todo
    await user.type(screen.getByLabelText('New todo'), 'Test task')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const checkbox = screen.getByLabelText('Toggle Test task')
    const todoText = screen.getByText('Test task')

    // Complete todo
    await user.click(checkbox)
    expect(todoText).toHaveStyle({ textDecoration: 'line-through' })

    // Uncomplete todo
    await user.click(checkbox)
    expect(todoText).toHaveStyle({ textDecoration: 'none' })
  })

  it('deletes a todo', async () => {
    const user = userEvent.setup()
    render(<TodoList />)

    await user.type(screen.getByLabelText('New todo'), 'Task to delete')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByText('Task to delete')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.queryByText('Task to delete')).not.toBeInTheDocument()
  })

  it('manages multiple todos', async () => {
    const user = userEvent.setup()
    render(<TodoList />)

    // Add multiple todos
    for (const task of ['Task 1', 'Task 2', 'Task 3']) {
      await user.type(screen.getByLabelText('New todo'), task)
      await user.click(screen.getByRole('button', { name: 'Add' }))
    }

    expect(screen.getByText('Task 1')).toBeInTheDocument()
    expect(screen.getByText('Task 2')).toBeInTheDocument()
    expect(screen.getByText('Task 3')).toBeInTheDocument()
  })
})
```

## Server Actions

Server Actions are asynchronous functions that run on the server. Test them by mocking and verifying their behavior.

### Form with Server Action

```typescript
// app/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
})

export async function createPost(formData: FormData) {
  const data = {
    title: formData.get('title'),
    content: formData.get('content'),
  }

  const result = createPostSchema.safeParse(data)

  if (!result.success) {
    return {
      error: result.error.errors[0].message,
    }
  }

  // Save to database (mocked)
  const post = await db.post.create({
    data: result.data,
  })

  revalidatePath('/posts')
  redirect(`/posts/${post.id}`)
}
```

```typescript
// app/components/CreatePostForm.tsx
'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createPost } from '@/app/actions'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Creating...' : 'Create Post'}
    </button>
  )
}

export default function CreatePostForm() {
  const [state, formAction] = useFormState(createPost, { error: null })

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="title">Title</label>
        <input id="title" name="title" required />
      </div>
      <div>
        <label htmlFor="content">Content</label>
        <textarea id="content" name="content" required />
      </div>
      {state?.error && <p role="alert">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}
```

```typescript
// app/components/__tests__/CreatePostForm.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import CreatePostForm from '../CreatePostForm'

vi.mock('@/app/actions', () => ({
  createPost: vi.fn(),
}))

vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom')
  return {
    ...actual,
    useFormState: (action: any, initialState: any) => {
      const [state, setState] = useState(initialState)
      return [state, action]
    },
    useFormStatus: () => ({ pending: false }),
  }
})

import { createPost } from '@/app/actions'

describe('CreatePostForm', () => {
  it('renders form fields', () => {
    render(<CreatePostForm />)

    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Post' })).toBeInTheDocument()
  })

  it('submits form with valid data', async () => {
    const user = userEvent.setup()
    vi.mocked(createPost).mockResolvedValue({ error: null })

    render(<CreatePostForm />)

    await user.type(screen.getByLabelText('Title'), 'New Post')
    await user.type(screen.getByLabelText('Content'), 'This is the content of the new post')
    await user.click(screen.getByRole('button', { name: 'Create Post' }))

    expect(createPost).toHaveBeenCalled()
  })
})
```

## API Routes

Test API routes by simulating requests and verifying responses.

### GET Route Handler

```typescript
// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(params.id)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/users/[id]/__tests__/route.test.ts
import { describe, it, expect, vi } from 'vitest'
import { GET } from '../route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  getUser: vi.fn(),
}))

import { getUser } from '@/lib/db'

describe('GET /api/users/[id]', () => {
  it('returns user data', async () => {
    const mockUser = { id: '1', name: 'John Doe', email: 'john@example.com' }
    vi.mocked(getUser).mockResolvedValue(mockUser)

    const request = new NextRequest('http://localhost:3000/api/users/1')
    const response = await GET(request, { params: { id: '1' } })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual(mockUser)
  })

  it('returns 404 when user not found', async () => {
    vi.mocked(getUser).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/users/999')
    const response = await GET(request, { params: { id: '999' } })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data).toEqual({ error: 'User not found' })
  })

  it('returns 500 on error', async () => {
    vi.mocked(getUser).mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/users/1')
    const response = await GET(request, { params: { id: '1' } })

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data).toEqual({ error: 'Internal server error' })
  })
})
```

### POST Route Handler

```typescript
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const postSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(10),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = postSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
    }

    const post = await createPost(result.data)

    return NextResponse.json(post, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/posts/__tests__/route.test.ts
import { describe, it, expect, vi } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'

describe('POST /api/posts', () => {
  it('creates post with valid data', async () => {
    const mockPost = { id: '1', title: 'Test', content: 'Test content' }

    const request = new NextRequest('http://localhost:3000/api/posts', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', content: 'Test content here' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(201)
  })

  it('returns 400 for invalid data', async () => {
    const request = new NextRequest('http://localhost:3000/api/posts', {
      method: 'POST',
      body: JSON.stringify({ title: '', content: 'short' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })
})
```

## Middleware

Test middleware by simulating requests and verifying redirects or modifications.

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check authentication
  const token = request.cookies.get('auth-token')

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Add custom header
  const response = NextResponse.next()
  response.headers.set('x-custom-header', 'custom-value')

  return response
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

```typescript
// __tests__/middleware.test.ts
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

describe('Middleware', () => {
  it('redirects to login when not authenticated', () => {
    const request = new NextRequest('http://localhost:3000/dashboard')

    const response = middleware(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login')
  })

  it('allows access when authenticated', () => {
    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: 'auth-token=valid-token',
      },
    })

    const response = middleware(request)

    expect(response.status).toBe(200)
  })

  it('adds custom header', () => {
    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: 'auth-token=valid-token',
      },
    })

    const response = middleware(request)

    expect(response.headers.get('x-custom-header')).toBe('custom-value')
  })
})
```

## Forms

### Complex Form with Validation

```typescript
// app/components/RegistrationForm.tsx
'use client'

import { useState } from 'react'
import { z } from 'zod'

const schema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export default function RegistrationForm() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const result = schema.safeParse(formData)

    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(error => {
        if (error.path[0]) {
          fieldErrors[error.path[0] as string] = error.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    // Submit form
    console.log('Form submitted:', result.data)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          value={formData.username}
          onChange={handleChange}
        />
        {errors.username && <span role="alert">{errors.username}</span>}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
        />
        {errors.email && <span role="alert">{errors.email}</span>}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
        />
        {errors.password && <span role="alert">{errors.password}</span>}
      </div>

      <div>
        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
        />
        {errors.confirmPassword && <span role="alert">{errors.confirmPassword}</span>}
      </div>

      <button type="submit">Register</button>
    </form>
  )
}
```

```typescript
// app/components/__tests__/RegistrationForm.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import RegistrationForm from '../RegistrationForm'

describe('RegistrationForm', () => {
  it('validates username length', async () => {
    const user = userEvent.setup()
    render(<RegistrationForm />)

    await user.type(screen.getByLabelText('Username'), 'ab')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument()
  })

  it('validates email format', async () => {
    const user = userEvent.setup()
    render(<RegistrationForm />)

    await user.type(screen.getByLabelText('Email'), 'invalid-email')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(screen.getByText('Invalid email address')).toBeInTheDocument()
  })

  it('validates password length', async () => {
    const user = userEvent.setup()
    render(<RegistrationForm />)

    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
  })

  it('validates password match', async () => {
    const user = userEvent.setup()
    render(<RegistrationForm />)

    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm Password'), 'password456')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(screen.getByText("Passwords don't match")).toBeInTheDocument()
  })

  it('submits form with valid data', async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, 'log')

    render(<RegistrationForm />)

    await user.type(screen.getByLabelText('Username'), 'johndoe')
    await user.type(screen.getByLabelText('Email'), 'john@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(consoleSpy).toHaveBeenCalledWith(
      'Form submitted:',
      expect.objectContaining({
        username: 'johndoe',
        email: 'john@example.com',
      })
    )
  })
})
```

## Authentication

### Complete Authentication Flow (E2E with Playwright)

```typescript
// tests/e2e/auth-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('complete user journey from signup to logout', async ({ page }) => {
    // 1. Signup
    await page.goto('/signup')
    await page.getByLabel('Email').fill('newuser@example.com')
    await page.getByLabel('Password').fill('SecurePass123!')
    await page.getByLabel('Confirm Password').fill('SecurePass123!')
    await page.getByRole('button', { name: 'Sign Up' }).click()

    // 2. Verify redirect to onboarding
    await expect(page).toHaveURL('/onboarding')

    // 3. Complete onboarding
    await page.getByLabel('Display Name').fill('New User')
    await page.getByRole('button', { name: 'Continue' }).click()

    // 4. Access dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('Welcome, New User')).toBeVisible()

    // 5. Logout
    await page.getByRole('button', { name: 'Account' }).click()
    await page.getByRole('menuitem', { name: 'Logout' }).click()

    // 6. Verify redirect to login
    await expect(page).toHaveURL('/login')
  })
})
```

## Data Fetching

### Testing with Loading States

See the comprehensive examples in [vitest.md](./vitest.md), [jest.md](./jest.md), [playwright.md](./playwright.md), and [cypress.md](./cypress.md) for detailed patterns on testing data fetching scenarios.

## Resources

- [Vitest Testing Patterns](./vitest.md)
- [Jest Testing Patterns](./jest.md)
- [Playwright E2E Patterns](./playwright.md)
- [Cypress E2E Patterns](./cypress.md)
- [Next.js Testing Documentation](https://nextjs.org/docs/app/building-your-application/testing)
