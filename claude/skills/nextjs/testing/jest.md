# Testing Next.js with Jest

Jest is a battle-tested JavaScript testing framework with extensive ecosystem support. It's a reliable choice for Next.js applications with comprehensive mocking capabilities and excellent IDE integration.

## Why Jest for Next.js?

- **Mature ecosystem**: Extensive plugins and community support
- **Zero config**: Works out of the box with sensible defaults
- **Powerful mocking**: Advanced mocking capabilities for complex scenarios
- **Snapshot testing**: Built-in snapshot testing support
- **Wide adoption**: Large community and extensive documentation

## Installation

```bash
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

## Configuration

### jest.config.js

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/jest.config.js',
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/e2e/'],
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
```

### jest.setup.js

```javascript
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
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
  notFound: jest.fn(),
  redirect: jest.fn(),
}))

// Mock Next.js Image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...props} />
  },
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
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
}

// Mock scrollTo
global.scrollTo = jest.fn()
```

### package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

## Testing Server Components

### Basic Server Component Test

```typescript
// app/components/ProductCard.tsx
import { Product } from '@/lib/types'

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <article>
      <h2>{product.name}</h2>
      <p>{product.description}</p>
      <p>${product.price.toFixed(2)}</p>
      <p>Stock: {product.stock}</p>
    </article>
  )
}
```

```typescript
// app/components/__tests__/ProductCard.test.tsx
import { render, screen } from '@testing-library/react'
import ProductCard from '../ProductCard'

describe('ProductCard', () => {
  const mockProduct = {
    id: '1',
    name: 'Test Product',
    description: 'A test product',
    price: 99.99,
    stock: 10,
  }

  it('renders product information', () => {
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText('Test Product')).toBeInTheDocument()
    expect(screen.getByText('A test product')).toBeInTheDocument()
    expect(screen.getByText('$99.99')).toBeInTheDocument()
    expect(screen.getByText('Stock: 10')).toBeInTheDocument()
  })

  it('formats price with two decimal places', () => {
    const product = { ...mockProduct, price: 10 }
    render(<ProductCard product={product} />)

    expect(screen.getByText('$10.00')).toBeInTheDocument()
  })

  it('uses semantic HTML', () => {
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByRole('article')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Test Product')
  })
})
```

### Testing Server Component with Async Data

```typescript
// app/components/UserList.tsx
import { getUsers } from '@/lib/api'

export default async function UserList() {
  const users = await getUsers()

  if (!users || users.length === 0) {
    return <p>No users found</p>
  }

  return (
    <ul role="list">
      {users.map(user => (
        <li key={user.id}>
          <strong>{user.name}</strong> - {user.email}
        </li>
      ))}
    </ul>
  )
}
```

```typescript
// app/components/__tests__/UserList.test.tsx
import { render, screen } from '@testing-library/react'
import UserList from '../UserList'

// Mock the API module
jest.mock('@/lib/api', () => ({
  getUsers: jest.fn(),
}))

import { getUsers } from '@/lib/api'

describe('UserList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders list of users', async () => {
    const mockUsers = [
      { id: '1', name: 'John Doe', email: 'john@example.com' },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
    ]

    ;(getUsers as jest.Mock).mockResolvedValue(mockUsers)

    const component = await UserList()
    render(component)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
  })

  it('shows empty state when no users', async () => {
    ;(getUsers as jest.Mock).mockResolvedValue([])

    const component = await UserList()
    render(component)

    expect(screen.getByText('No users found')).toBeInTheDocument()
  })

  it('handles null response', async () => {
    ;(getUsers as jest.Mock).mockResolvedValue(null)

    const component = await UserList()
    render(component)

    expect(screen.getByText('No users found')).toBeInTheDocument()
  })
})
```

## Testing Client Components

### Interactive Component Test

```typescript
// app/components/SearchBar.tsx
'use client'

import { useState } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
}

export default function SearchBar({ onSearch, placeholder = 'Search...' }: SearchBarProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} role="search">
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
      />
      <button type="submit">Search</button>
    </form>
  )
}
```

```typescript
// app/components/__tests__/SearchBar.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchBar from '../SearchBar'

describe('SearchBar', () => {
  it('renders with default placeholder', () => {
    render(<SearchBar onSearch={jest.fn()} />)

    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('renders with custom placeholder', () => {
    render(<SearchBar onSearch={jest.fn()} placeholder="Find products..." />)

    expect(screen.getByPlaceholderText('Find products...')).toBeInTheDocument()
  })

  it('calls onSearch with trimmed query on submit', async () => {
    const user = userEvent.setup()
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} />)

    const input = screen.getByLabelText('Search')
    await user.type(input, '  test query  ')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(onSearch).toHaveBeenCalledWith('test query')
  })

  it('does not call onSearch with empty query', async () => {
    const user = userEvent.setup()
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} />)

    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(onSearch).not.toHaveBeenCalled()
  })

  it('updates input value as user types', async () => {
    const user = userEvent.setup()
    render(<SearchBar onSearch={jest.fn()} />)

    const input = screen.getByLabelText('Search')
    await user.type(input, 'test')

    expect(input).toHaveValue('test')
  })
})
```

## Mocking Next.js Router

### Basic Router Mock

```typescript
import { useRouter } from 'next/navigation'

// In your test file
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

describe('Component with routing', () => {
  it('navigates on button click', async () => {
    const push = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ push })

    const user = userEvent.setup()
    render(<MyComponent />)

    await user.click(screen.getByRole('button', { name: 'Go to Profile' }))

    expect(push).toHaveBeenCalledWith('/profile')
  })
})
```

### Advanced Router Mock

```typescript
// tests/mocks/next-navigation.ts
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
}

export const mockUseRouter = () => mockRouter

export const mockUsePathname = () => '/'

export const mockUseSearchParams = () => new URLSearchParams()

// In your test
import { mockRouter } from '@/tests/mocks/next-navigation'

beforeEach(() => {
  jest.clearAllMocks()
  mockRouter.push.mockClear()
})

it('handles navigation', async () => {
  render(<MyComponent />)
  await userEvent.click(screen.getByText('Click me'))
  expect(mockRouter.push).toHaveBeenCalledWith('/expected-path')
})
```

## Mocking API Calls

### Mocking Fetch

```typescript
describe('API tests', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('fetches data successfully', async () => {
    const mockData = { id: 1, name: 'Test' }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    })

    const result = await fetchUser(1)

    expect(result).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledWith('/api/users/1')
  })

  it('handles fetch error', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    await expect(fetchUser(1)).rejects.toThrow('Network error')
  })

  it('handles non-ok response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    await expect(fetchUser(999)).rejects.toThrow()
  })
})
```

### Mocking Server Actions

```typescript
// app/actions.ts
'use server'

export async function createPost(formData: FormData) {
  const title = formData.get('title')
  const content = formData.get('content')

  // Database operation
  return { id: '1', title, content }
}

// __tests__/actions.test.ts
jest.mock('@/app/actions', () => ({
  createPost: jest.fn(),
}))

import { createPost } from '@/app/actions'

describe('Server Actions', () => {
  it('creates a post', async () => {
    const mockPost = { id: '1', title: 'Test', content: 'Content' }
    ;(createPost as jest.Mock).mockResolvedValue(mockPost)

    const formData = new FormData()
    formData.append('title', 'Test')
    formData.append('content', 'Content')

    const result = await createPost(formData)

    expect(result).toEqual(mockPost)
  })
})
```

## Snapshot Testing

### Component Snapshots

```typescript
import { render } from '@testing-library/react'
import Button from '../Button'

describe('Button snapshots', () => {
  it('matches snapshot for default button', () => {
    const { container } = render(<Button>Click me</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot for primary variant', () => {
    const { container } = render(<Button variant="primary">Click me</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot for disabled state', () => {
    const { container } = render(<Button disabled>Click me</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })
})
```

### Inline Snapshots

```typescript
it('renders correctly', () => {
  const { container } = render(<Badge count={5} />)
  expect(container.firstChild).toMatchInlineSnapshot(`
    <span class="badge">
      5
    </span>
  `)
})
```

### Updating Snapshots

```bash
# Update all snapshots
npm test -- -u

# Update snapshots for specific file
npm test -- -u Button.test.tsx

# Interactive snapshot update
npm test -- --watch
# Press 'u' to update failing snapshots
```

## Testing Hooks

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useDebounce } from '@/lib/hooks/useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 500))

    expect(result.current).toBe('test')
  })

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    expect(result.current).toBe('initial')

    rerender({ value: 'updated', delay: 500 })
    expect(result.current).toBe('initial')

    jest.advanceTimersByTime(500)
    expect(result.current).toBe('updated')
  })
})
```

## Testing Context Providers

```typescript
// lib/context/ThemeContext.tsx
'use client'

import { createContext, useContext, useState } from 'react'

const ThemeContext = createContext<any>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('light')

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

// __tests__/ThemeContext.test.tsx
import { renderHook, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from '@/lib/context/ThemeContext'

describe('ThemeContext', () => {
  it('provides default theme', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    })

    expect(result.current.theme).toBe('light')
  })

  it('allows theme to be changed', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    })

    act(() => {
      result.current.setTheme('dark')
    })

    expect(result.current.theme).toBe('dark')
  })
})
```

## Coverage Configuration

### jest.config.js Coverage Settings

```javascript
module.exports = {
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './app/': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:ci

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
```

## Best Practices

1. **Clear test names**: Describe what the test does
2. **Arrange-Act-Assert**: Structure tests clearly
3. **One concept per test**: Keep tests focused
4. **Mock external dependencies**: Isolate units under test
5. **Use semantic queries**: Prefer getByRole, getByLabelText
6. **Clean up**: Use beforeEach/afterEach for setup/teardown
7. **Test user behavior**: Not implementation details
8. **Use async/await**: With user-event and async operations
9. **Type your tests**: Use TypeScript for type safety
10. **Keep tests maintainable**: DRY principle with helper functions

## Debugging Tests

```bash
# Run specific test file
npm test -- UserProfile.test.tsx

# Run tests matching pattern
npm test -- -t "should render"

# Run with coverage
npm test -- --coverage --watchAll=false

# Debug in VS Code
# Add to .vscode/launch.json:
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Common Patterns

See [Testing Patterns](./testing-patterns.md) for comprehensive examples of:
- Server Component testing
- Client Component testing
- Server Actions testing
- API Route testing
- Form validation testing
- Authentication flows

## Resources

- [Jest Documentation](https://jestjs.io)
- [Testing Library](https://testing-library.com)
- [Next.js Testing with Jest](https://nextjs.org/docs/app/building-your-application/testing/jest)
