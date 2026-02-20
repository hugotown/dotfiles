---
name: testing-nextjs-applications
description: Documents testing strategies for Next.js including unit testing with Vitest/Jest, E2E testing with Playwright/Cypress, and component testing patterns. Use when setting up tests, writing test cases, or implementing testing workflows.
---

# Testing Next.js Applications

This skill provides comprehensive testing strategies and patterns for Next.js applications, covering unit testing, integration testing, E2E testing, and component testing.

## Overview

Testing Next.js applications requires understanding the unique characteristics of:
- Server Components vs Client Components
- Server Actions and API Routes
- Middleware and Route Handlers
- Static and Dynamic rendering
- Data fetching patterns

## Testing Tools & Frameworks

### Unit & Integration Testing
- **[Vitest](./vitest.md)** - Fast, modern testing framework with native ESM support
- **[Jest](./jest.md)** - Battle-tested framework with extensive ecosystem

### End-to-End Testing
- **[Playwright](./playwright.md)** - Modern E2E testing with excellent Next.js support
- **[Cypress](./cypress.md)** - Popular E2E framework with component testing capabilities

### Testing Patterns
- **[Testing Patterns](./testing-patterns.md)** - Common patterns for testing Next.js features

## Quick Start

### Choose Your Testing Stack

**Recommended Modern Stack:**
```bash
# Vitest for unit/integration tests
npm install -D vitest @vitejs/plugin-react

# Playwright for E2E tests
npm install -D @playwright/test

# React Testing Library
npm install -D @testing-library/react @testing-library/jest-dom
```

**Traditional Stack:**
```bash
# Jest for unit/integration tests
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom

# Cypress for E2E tests
npm install -D cypress
```

## Testing Strategy

### Test Pyramid

```
       /\
      /E2E\        <- Few, critical user flows (Playwright/Cypress)
     /------\
    /Integr-\     <- API routes, Server Actions, data flows
   /----------\
  /  Unit Tests \  <- Components, utilities, pure functions
 /--------------\
```

### What to Test

**Server Components:**
- Data fetching logic
- Error states and boundaries
- Loading states
- Props and rendering

**Client Components:**
- User interactions
- State management
- Event handlers
- Side effects

**API Routes & Server Actions:**
- Request/response handling
- Authentication/authorization
- Data validation
- Error handling

**Middleware:**
- Routing logic
- Authentication checks
- Redirects and rewrites

## File Organization

```
your-app/
├── app/
│   ├── (routes)/
│   └── api/
├── __tests__/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── components/
│   └── __tests__/
├── lib/
│   └── __tests__/
└── tests/
    ├── setup.ts
    ├── fixtures/
    └── mocks/
```

## Configuration Files

### Vitest Configuration
See [vitest.md](./vitest.md#configuration) for detailed setup.

### Jest Configuration
See [jest.md](./jest.md#configuration) for detailed setup.

### Playwright Configuration
See [playwright.md](./playwright.md#configuration) for detailed setup.

### Cypress Configuration
See [cypress.md](./cypress.md#configuration) for detailed setup.

## Best Practices

### 1. Test User Behavior, Not Implementation
```typescript
// Good: Test what users see/do
test('displays error when form submission fails', async () => {
  render(<ContactForm />)
  await userEvent.type(screen.getByLabelText('Email'), 'invalid')
  await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
  expect(screen.getByText('Invalid email address')).toBeInTheDocument()
})

// Avoid: Testing implementation details
test('sets error state on validation failure', () => {
  const { result } = renderHook(() => useFormValidation())
  act(() => result.current.validate('invalid'))
  expect(result.current.errors).toHaveLength(1)
})
```

### 2. Mock External Dependencies
```typescript
// Mock fetch for Server Components
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))
```

### 3. Use Data-Testid Sparingly
```typescript
// Good: Use semantic queries
screen.getByRole('button', { name: 'Submit' })
screen.getByLabelText('Email')
screen.getByText('Welcome back')

// Use data-testid only when necessary
screen.getByTestId('complex-dynamic-component')
```

### 4. Test Accessibility
```typescript
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

test('page has no accessibility violations', async () => {
  const { container } = render(<HomePage />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

## Running Tests

```bash
# Unit tests with Vitest
npm run test
npm run test:watch
npm run test:coverage

# Unit tests with Jest
npm run test
npm run test:watch
npm run test:coverage

# E2E tests with Playwright
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:debug

# E2E tests with Cypress
npm run cypress:open
npm run cypress:run
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Common Testing Scenarios

- **Server Components**: [Testing Patterns - Server Components](./testing-patterns.md#server-components)
- **Client Components**: [Testing Patterns - Client Components](./testing-patterns.md#client-components)
- **Server Actions**: [Testing Patterns - Server Actions](./testing-patterns.md#server-actions)
- **API Routes**: [Testing Patterns - API Routes](./testing-patterns.md#api-routes)
- **Middleware**: [Testing Patterns - Middleware](./testing-patterns.md#middleware)
- **Form Submissions**: [Testing Patterns - Forms](./testing-patterns.md#forms)

## Debugging Tests

### Vitest
```bash
# Debug mode
npm run test -- --inspect-brk

# UI mode
npm run test -- --ui

# Run specific test
npm run test -- path/to/test.test.ts
```

### Playwright
```bash
# Debug mode
npx playwright test --debug

# UI mode
npx playwright test --ui

# Headed mode
npx playwright test --headed
```

## Coverage Reports

```bash
# Generate coverage with Vitest
npm run test:coverage

# Generate coverage with Jest
npm run test -- --coverage

# View HTML report
open coverage/index.html
```

## Resources

- [Next.js Testing Documentation](https://nextjs.org/docs/app/building-your-application/testing)
- [React Testing Library](https://testing-library.com/react)
- [Vitest Documentation](https://vitest.dev)
- [Jest Documentation](https://jestjs.io)
- [Playwright Documentation](https://playwright.dev)
- [Cypress Documentation](https://www.cypress.io)

## Related Skills

- [Server Components](../app-router/rendering/server-components.md)
- [Client Components](../app-router/rendering/client-components.md)
- [Server Actions](../app-router/data-fetching/server-actions.md)
- [Route Handlers](../app-router/routing/route-handlers.md)
- [Middleware](../app-router/routing/middleware.md)
