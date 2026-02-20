# Testing Next.js with Vitest

Vitest is a modern, fast testing framework with native ESM support, making it ideal for Next.js applications. It provides excellent performance, a Jest-compatible API, and seamless integration with Vite-based tooling.

## Why Vitest for Next.js?

- **Fast**: Native ESM support and smart caching
- **Modern**: Built for modern JavaScript/TypeScript
- **Compatible**: Jest-compatible API for easy migration
- **Developer Experience**: Hot module reload, UI mode, and excellent debugging
- **TypeScript**: First-class TypeScript support

## Installation

```bash
npm install -D vitest @vitejs/plugin-react
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D jsdom
```

## Configuration

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/.next',
      ],
    },
    // Ignore E2E tests
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/app': path.resolve(__dirname, './app'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib'),
    },
  },
})
```

### tests/setup.ts

```typescript
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
  useParams() {
    return {}
  },
  notFound: vi.fn(),
  redirect: vi.fn(),
}))

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />
  },
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
} as any
```

### package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:run": "vitest run"
  }
}
```

## Testing Server Components

Server Components run on the server and don't have access to browser APIs. Test them by rendering and verifying the output.

### Basic Server Component Test

```typescript
// app/components/UserProfile.tsx
import { User } from '@/lib/types'

interface UserProfileProps {
  user: User
}

export default function UserProfile({ user }: UserProfileProps) {
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <p>Role: {user.role}</p>
    </div>
  )
}
```

```typescript
// app/components/__tests__/UserProfile.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import UserProfile from '../UserProfile'

describe('UserProfile', () => {
  const mockUser = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
  }

  it('renders user information', () => {
    render(<UserProfile user={mockUser} />)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
    expect(screen.getByText('Role: admin')).toBeInTheDocument()
  })

  it('displays correct heading level', () => {
    render(<UserProfile user={mockUser} />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('John Doe')
  })
})
```

### Testing Server Component with Data Fetching

```typescript
// app/components/PostsList.tsx
import { getPosts } from '@/lib/api'

export default async function PostsList() {
  const posts = await getPosts()

  if (posts.length === 0) {
    return <p>No posts available</p>
  }

  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </li>
      ))}
    </ul>
  )
}
```

```typescript
// app/components/__tests__/PostsList.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PostsList from '../PostsList'

// Mock the API module
vi.mock('@/lib/api', () => ({
  getPosts: vi.fn(),
}))

import { getPosts } from '@/lib/api'

describe('PostsList', () => {
  it('renders posts when data is available', async () => {
    const mockPosts = [
      { id: '1', title: 'First Post', excerpt: 'First excerpt' },
      { id: '2', title: 'Second Post', excerpt: 'Second excerpt' },
    ]

    vi.mocked(getPosts).mockResolvedValue(mockPosts)

    const component = await PostsList()
    render(component)

    expect(screen.getByText('First Post')).toBeInTheDocument()
    expect(screen.getByText('Second Post')).toBeInTheDocument()
  })

  it('shows empty state when no posts', async () => {
    vi.mocked(getPosts).mockResolvedValue([])

    const component = await PostsList()
    render(component)

    expect(screen.getByText('No posts available')).toBeInTheDocument()
  })
})
```

## Testing Client Components

Client Components use browser APIs and have interactive features. Use user-event for realistic user interactions.

### Interactive Component Test

```typescript
// app/components/Counter.tsx
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  )
}
```

```typescript
// app/components/__tests__/Counter.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import Counter from '../Counter'

describe('Counter', () => {
  it('starts at zero', () => {
    render(<Counter />)
    expect(screen.getByText('Count: 0')).toBeInTheDocument()
  })

  it('increments count when increment button is clicked', async () => {
    const user = userEvent.setup()
    render(<Counter />)

    await user.click(screen.getByRole('button', { name: 'Increment' }))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Increment' }))
    expect(screen.getByText('Count: 2')).toBeInTheDocument()
  })

  it('decrements count when decrement button is clicked', async () => {
    const user = userEvent.setup()
    render(<Counter />)

    await user.click(screen.getByRole('button', { name: 'Decrement' }))
    expect(screen.getByText('Count: -1')).toBeInTheDocument()
  })

  it('resets count to zero', async () => {
    const user = userEvent.setup()
    render(<Counter />)

    await user.click(screen.getByRole('button', { name: 'Increment' }))
    await user.click(screen.getByRole('button', { name: 'Increment' }))
    expect(screen.getByText('Count: 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByText('Count: 0')).toBeInTheDocument()
  })
})
```

### Form Component Test

```typescript
// app/components/LoginForm.tsx
'use client'

import { useState } from 'react'

export default function LoginForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      setError('All fields are required')
      return
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Invalid email address')
      return
    }

    setError('')
    onSubmit({ email, password })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <button type="submit">Log In</button>
    </form>
  )
}
```

```typescript
// app/components/__tests__/LoginForm.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import LoginForm from '../LoginForm'

describe('LoginForm', () => {
  it('renders form fields', () => {
    render(<LoginForm onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument()
  })

  it('shows error when fields are empty', async () => {
    const user = userEvent.setup()
    render(<LoginForm onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Log In' }))

    expect(screen.getByRole('alert')).toHaveTextContent('All fields are required')
  })

  it('shows error for invalid email', async () => {
    const user = userEvent.setup()
    render(<LoginForm onSubmit={vi.fn()} />)

    await user.type(screen.getByLabelText('Email'), 'invalid-email')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Log In' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email address')
  })

  it('calls onSubmit with form data when valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Log In' }))

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
```

## Mocking Strategies

### Mocking Next.js Modules

```typescript
import { vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/current-path',
  useSearchParams: () => new URLSearchParams('?key=value'),
}))

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
  }),
  headers: () => new Headers(),
}))

// Mock Server Actions
vi.mock('@/app/actions', () => ({
  submitForm: vi.fn(),
  deleteItem: vi.fn(),
}))
```

### Mocking Fetch Requests

```typescript
import { vi, beforeEach, afterEach } from 'vitest'

describe('API tests', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches user data', async () => {
    const mockUser = { id: 1, name: 'John' }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    } as Response)

    const response = await fetch('/api/user')
    const data = await response.json()

    expect(data).toEqual(mockUser)
    expect(fetch).toHaveBeenCalledWith('/api/user')
  })
})
```

### Mocking External Libraries

```typescript
// Mock a database client
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

// Mock authentication
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(() => Promise.resolve({
    user: { id: '1', email: 'test@example.com' },
  })),
  requireAuth: vi.fn(),
}))
```

## Testing Hooks

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useUser } from '@/lib/hooks/useUser'

describe('useUser', () => {
  it('fetches user data', async () => {
    const mockUser = { id: '1', name: 'John' }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUser,
    })

    const { result } = renderHook(() => useUser('1'))

    await waitFor(() => {
      expect(result.current.data).toEqual(mockUser)
    })
  })

  it('handles loading state', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))

    const { result } = renderHook(() => useUser('1'))

    expect(result.current.isLoading).toBe(true)
  })

  it('handles error state', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'))

    const { result } = renderHook(() => useUser('1'))

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })
  })
})
```

## Snapshot Testing

```typescript
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Button from '../Button'

describe('Button', () => {
  it('matches snapshot', () => {
    const { container } = render(<Button>Click me</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot with variant', () => {
    const { container } = render(<Button variant="primary">Click me</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })
})
```

## Coverage Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      all: true,
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
      exclude: [
        'app/layout.tsx',
        'app/**/layout.tsx',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        '**/__tests__/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Best Practices

1. **Use describe blocks** for organization
2. **One assertion per test** when possible
3. **Use semantic queries** (getByRole, getByLabelText)
4. **Mock external dependencies** consistently
5. **Test user behavior**, not implementation
6. **Use async/await** with user-event
7. **Clean up after tests** (auto-cleanup configured)
8. **Use TypeScript** for type safety
9. **Keep tests focused** and isolated
10. **Use meaningful test names**

## Debugging

```bash
# Run with UI mode
npm run test:ui

# Debug specific test
npm run test -- -t "test name"

# Run in watch mode
npm run test:watch

# View coverage
npm run test:coverage
open coverage/index.html
```

## Common Patterns

See [Testing Patterns](./testing-patterns.md) for comprehensive examples of:
- Server Component testing
- Client Component testing
- Server Actions testing
- API Route testing
- Middleware testing
- Form testing
- Authentication testing

## Resources

- [Vitest Documentation](https://vitest.dev)
- [Testing Library](https://testing-library.com/react)
- [Next.js Testing](https://nextjs.org/docs/app/building-your-application/testing/vitest)
