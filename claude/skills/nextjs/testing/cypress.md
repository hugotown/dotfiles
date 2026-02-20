# E2E Testing Next.js with Cypress

Cypress is a powerful end-to-end testing framework with excellent developer experience and debugging capabilities. It provides both E2E and component testing features that work well with Next.js applications.

## Why Cypress for Next.js?

- **Developer-friendly**: Interactive test runner with time-travel debugging
- **Real-time reloads**: Tests automatically re-run on changes
- **Automatic waiting**: Smart waiting for elements and assertions
- **Network control**: Powerful request stubbing and mocking
- **Component testing**: Test React components in isolation
- **Screenshots & videos**: Automatic capture on failures

## Installation

```bash
npm install -D cypress
npx cypress open
```

## Configuration

### cypress.config.ts

```typescript
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
  },
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
  },
})
```

### cypress/support/e2e.ts

```typescript
// Import commands
import './commands'

// Hide fetch/XHR requests in command log (optional)
Cypress.on('window:before:load', (win) => {
  win.fetch = null
})

// Add custom assertions
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>
      logout(): Chainable<void>
      getBySel(dataTestId: string): Chainable<JQuery<HTMLElement>>
      getBySelLike(dataTestId: string): Chainable<JQuery<HTMLElement>>
    }
  }
}
```

### cypress/support/commands.ts

```typescript
// Custom login command
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login')
    cy.get('input[name="email"]').type(email)
    cy.get('input[name="password"]').type(password)
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/dashboard')
  })
})

// Custom logout command
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click()
  cy.get('[data-testid="logout-button"]').click()
})

// Custom commands for data-testid selectors
Cypress.Commands.add('getBySel', (selector: string) => {
  return cy.get(`[data-testid="${selector}"]`)
})

Cypress.Commands.add('getBySelLike', (selector: string) => {
  return cy.get(`[data-testid*="${selector}"]`)
})
```

### package.json Scripts

```json
{
  "scripts": {
    "cypress:open": "cypress open",
    "cypress:run": "cypress run",
    "cypress:run:chrome": "cypress run --browser chrome",
    "cypress:run:firefox": "cypress run --browser firefox",
    "cypress:component": "cypress open --component"
  }
}
```

## E2E Testing

### Basic E2E Test

```typescript
// cypress/e2e/homepage.cy.ts
describe('Homepage', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should display the homepage', () => {
    cy.contains('h1', 'Welcome to Next.js')
    cy.get('nav').should('be.visible')
  })

  it('should navigate to about page', () => {
    cy.contains('a', 'About').click()
    cy.url().should('include', '/about')
    cy.contains('h1', 'About Us')
  })

  it('should have correct meta tags', () => {
    cy.title().should('include', 'My Next.js App')
    cy.get('head meta[name="description"]')
      .should('have.attr', 'content')
      .and('include', 'Next.js application')
  })
})
```

### Testing Forms

```typescript
// cypress/e2e/contact-form.cy.ts
describe('Contact Form', () => {
  beforeEach(() => {
    cy.visit('/contact')
  })

  it('should submit form with valid data', () => {
    cy.get('input[name="name"]').type('John Doe')
    cy.get('input[name="email"]').type('john@example.com')
    cy.get('textarea[name="message"]').type('This is a test message')

    cy.get('button[type="submit"]').click()

    cy.contains('Message sent successfully').should('be.visible')
  })

  it('should show validation errors for empty fields', () => {
    cy.get('button[type="submit"]').click()

    cy.contains('Name is required').should('be.visible')
    cy.contains('Email is required').should('be.visible')
    cy.contains('Message is required').should('be.visible')
  })

  it('should validate email format', () => {
    cy.get('input[name="email"]').type('invalid-email')
    cy.get('button[type="submit"]').click()

    cy.contains('Invalid email address').should('be.visible')
  })

  it('should clear form after successful submission', () => {
    cy.get('input[name="name"]').type('John Doe')
    cy.get('input[name="email"]').type('john@example.com')
    cy.get('textarea[name="message"]').type('Test message')

    cy.get('button[type="submit"]').click()

    cy.get('input[name="name"]').should('have.value', '')
    cy.get('input[name="email"]').should('have.value', '')
    cy.get('textarea[name="message"]').should('have.value', '')
  })
})
```

### API Mocking with cy.intercept()

```typescript
// cypress/e2e/posts.cy.ts
describe('Posts Page', () => {
  beforeEach(() => {
    // Mock API response
    cy.intercept('GET', '/api/posts', {
      statusCode: 200,
      body: [
        { id: 1, title: 'First Post', content: 'Content 1' },
        { id: 2, title: 'Second Post', content: 'Content 2' },
      ],
    }).as('getPosts')

    cy.visit('/posts')
  })

  it('should display posts from API', () => {
    cy.wait('@getPosts')

    cy.contains('First Post').should('be.visible')
    cy.contains('Second Post').should('be.visible')
  })

  it('should handle API errors', () => {
    cy.intercept('GET', '/api/posts', {
      statusCode: 500,
      body: { error: 'Internal Server Error' },
    }).as('getPostsError')

    cy.visit('/posts')
    cy.wait('@getPostsError')

    cy.contains('Failed to load posts').should('be.visible')
  })

  it('should create new post', () => {
    cy.intercept('POST', '/api/posts', {
      statusCode: 201,
      body: { id: 3, title: 'New Post', content: 'New content' },
    }).as('createPost')

    cy.get('input[name="title"]').type('New Post')
    cy.get('textarea[name="content"]').type('New content')
    cy.get('button[type="submit"]').click()

    cy.wait('@createPost')
    cy.contains('Post created successfully').should('be.visible')
  })
})
```

### Testing Authentication

```typescript
// cypress/e2e/auth.cy.ts
describe('Authentication', () => {
  describe('Login', () => {
    beforeEach(() => {
      cy.visit('/login')
    })

    it('should login with valid credentials', () => {
      cy.get('input[name="email"]').type('test@example.com')
      cy.get('input[name="password"]').type('password123')
      cy.get('button[type="submit"]').click()

      cy.url().should('include', '/dashboard')
      cy.contains('Welcome back').should('be.visible')
    })

    it('should show error with invalid credentials', () => {
      cy.get('input[name="email"]').type('test@example.com')
      cy.get('input[name="password"]').type('wrongpassword')
      cy.get('button[type="submit"]').click()

      cy.contains('Invalid credentials').should('be.visible')
      cy.url().should('include', '/login')
    })

    it('should remember me functionality', () => {
      cy.get('input[name="email"]').type('test@example.com')
      cy.get('input[name="password"]').type('password123')
      cy.get('input[name="remember"]').check()
      cy.get('button[type="submit"]').click()

      // Check cookie is set
      cy.getCookie('remember_token').should('exist')
    })
  })

  describe('Protected Routes', () => {
    it('should redirect to login when not authenticated', () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/login')
    })

    it('should access protected route when authenticated', () => {
      cy.login('test@example.com', 'password123')
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    })
  })

  describe('Logout', () => {
    beforeEach(() => {
      cy.login('test@example.com', 'password123')
      cy.visit('/dashboard')
    })

    it('should logout successfully', () => {
      cy.logout()
      cy.url().should('include', '/login')
      cy.getCookie('session').should('not.exist')
    })
  })
})
```

### Custom Commands

```typescript
// cypress/support/commands.ts

// Data-testid selector
Cypress.Commands.add('getBySel', (selector: string) => {
  return cy.get(`[data-testid="${selector}"]`)
})

// Fill form helper
Cypress.Commands.add('fillForm', (formData: Record<string, string>) => {
  Object.entries(formData).forEach(([name, value]) => {
    cy.get(`[name="${name}"]`).type(value)
  })
})

// Wait for API call
Cypress.Commands.add('waitForApi', (alias: string) => {
  return cy.wait(`@${alias}`)
})

// Check accessibility
Cypress.Commands.add('checkA11y', () => {
  cy.injectAxe()
  cy.checkA11y()
})
```

### Using Custom Commands

```typescript
// cypress/e2e/signup.cy.ts
describe('Signup', () => {
  it('should signup new user', () => {
    cy.visit('/signup')

    cy.fillForm({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    })

    cy.get('button[type="submit"]').click()

    cy.url().should('include', '/welcome')
  })
})
```

## Component Testing

### Setup Component Testing

```typescript
// cypress/component/Button.cy.tsx
import Button from '@/components/Button'

describe('Button Component', () => {
  it('renders with text', () => {
    cy.mount(<Button>Click me</Button>)
    cy.contains('Click me').should('be.visible')
  })

  it('calls onClick handler', () => {
    const onClick = cy.stub().as('onClick')
    cy.mount(<Button onClick={onClick}>Click me</Button>)

    cy.contains('Click me').click()
    cy.get('@onClick').should('have.been.calledOnce')
  })

  it('applies variant styles', () => {
    cy.mount(<Button variant="primary">Primary</Button>)
    cy.contains('Primary').should('have.class', 'btn-primary')
  })

  it('disables button when disabled prop is true', () => {
    cy.mount(<Button disabled>Disabled</Button>)
    cy.contains('Disabled').should('be.disabled')
  })
})
```

### Component Testing with Props

```typescript
// cypress/component/Card.cy.tsx
import Card from '@/components/Card'

describe('Card Component', () => {
  const mockProduct = {
    id: '1',
    title: 'Product 1',
    price: 99.99,
    image: '/product.jpg',
  }

  it('displays product information', () => {
    cy.mount(<Card product={mockProduct} />)

    cy.contains('Product 1').should('be.visible')
    cy.contains('$99.99').should('be.visible')
    cy.get('img').should('have.attr', 'alt', 'Product 1')
  })

  it('emits add to cart event', () => {
    const onAddToCart = cy.stub().as('addToCart')
    cy.mount(<Card product={mockProduct} onAddToCart={onAddToCart} />)

    cy.contains('Add to Cart').click()
    cy.get('@addToCart').should('have.been.calledWith', mockProduct)
  })
})
```

## Testing Workflows

### Multi-step User Journey

```typescript
// cypress/e2e/shopping-flow.cy.ts
describe('Shopping Flow', () => {
  it('should complete full shopping journey', () => {
    // 1. Browse products
    cy.visit('/products')
    cy.contains('Latest Products').should('be.visible')

    // 2. View product details
    cy.contains('Product 1').click()
    cy.url().should('include', '/products/')
    cy.contains('Add to Cart').click()

    // 3. View cart
    cy.getBySel('cart-icon').click()
    cy.url().should('include', '/cart')
    cy.contains('Product 1').should('be.visible')

    // 4. Proceed to checkout
    cy.contains('Proceed to Checkout').click()
    cy.url().should('include', '/checkout')

    // 5. Fill shipping information
    cy.fillForm({
      name: 'John Doe',
      address: '123 Main St',
      city: 'San Francisco',
      zip: '94102',
    })

    // 6. Complete order
    cy.contains('Place Order').click()
    cy.url().should('include', '/order-confirmation')
    cy.contains('Order placed successfully').should('be.visible')
  })
})
```

### File Upload Testing

```typescript
// cypress/e2e/file-upload.cy.ts
describe('File Upload', () => {
  it('should upload single file', () => {
    cy.visit('/upload')

    cy.get('input[type="file"]').selectFile('cypress/fixtures/sample.pdf')

    cy.contains('sample.pdf').should('be.visible')
    cy.get('button[type="submit"]').click()

    cy.contains('File uploaded successfully').should('be.visible')
  })

  it('should upload multiple files', () => {
    cy.visit('/upload-multiple')

    cy.get('input[type="file"]').selectFile([
      'cypress/fixtures/file1.pdf',
      'cypress/fixtures/file2.pdf',
    ])

    cy.contains('2 files selected').should('be.visible')
  })

  it('should validate file type', () => {
    cy.visit('/upload')

    cy.get('input[type="file"]').selectFile('cypress/fixtures/invalid.txt', {
      force: true,
    })

    cy.contains('Invalid file type').should('be.visible')
  })
})
```

## Visual Testing

### Viewport Testing

```typescript
describe('Responsive Design', () => {
  const viewports = [
    { device: 'iphone-x', width: 375, height: 812 },
    { device: 'ipad-2', width: 768, height: 1024 },
    { device: 'macbook-15', width: 1440, height: 900 },
  ]

  viewports.forEach(({ device, width, height }) => {
    it(`should display correctly on ${device}`, () => {
      cy.viewport(width, height)
      cy.visit('/')

      cy.get('nav').should('be.visible')
      cy.matchImageSnapshot(`homepage-${device}`)
    })
  })
})
```

## Testing Server Actions

```typescript
// cypress/e2e/server-actions.cy.ts
describe('Server Actions', () => {
  it('should handle form submission with server action', () => {
    cy.visit('/add-post')

    cy.get('input[name="title"]').type('New Post')
    cy.get('textarea[name="content"]').type('Post content')

    // Intercept the server action
    cy.intercept('POST', '**/api/posts', {
      statusCode: 200,
      body: { success: true, id: '123' },
    }).as('createPost')

    cy.get('button[type="submit"]').click()

    cy.wait('@createPost')
    cy.url().should('include', '/posts/123')
  })

  it('should display server action errors', () => {
    cy.visit('/add-post')

    cy.intercept('POST', '**/api/posts', {
      statusCode: 400,
      body: { error: 'Title is required' },
    }).as('createPostError')

    cy.get('button[type="submit"]').click()

    cy.wait('@createPostError')
    cy.contains('Title is required').should('be.visible')
  })
})
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Cypress Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  cypress:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        browser: [chrome, firefox, edge]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Next.js
        run: npm run build

      - name: Cypress run
        uses: cypress-io/github-action@v6
        with:
          browser: ${{ matrix.browser }}
          start: npm start
          wait-on: 'http://localhost:3000'
          wait-on-timeout: 120

      - name: Upload screenshots
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: cypress-screenshots-${{ matrix.browser }}
          path: cypress/screenshots

      - name: Upload videos
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: cypress-videos-${{ matrix.browser }}
          path: cypress/videos
```

## Best Practices

1. **Use data-testid**: For stable selectors
2. **Keep tests independent**: Each test should work in isolation
3. **Use cy.intercept()**: Control network requests
4. **Custom commands**: Reuse common operations
5. **Page objects**: Organize complex tests
6. **Session management**: Use cy.session() for auth
7. **Automatic waiting**: Let Cypress wait automatically
8. **Screenshots on failure**: Automatic debugging
9. **Test user journeys**: Complete workflows
10. **Component testing**: Test components in isolation

## Debugging

```typescript
// Add debugger
cy.debug()

// Pause execution
cy.pause()

// Log to console
cy.log('Custom message')

// Take screenshot
cy.screenshot('my-screenshot')

// Print element details
cy.get('button').then(($btn) => {
  console.log($btn)
})
```

### Interactive Debugging

```bash
# Open Cypress Test Runner
npm run cypress:open

# Run specific test in headed mode
npx cypress run --headed --spec "cypress/e2e/auth.cy.ts"

# Run with browser console
npx cypress run --browser chrome --headed
```

## Common Patterns

See [Testing Patterns](./testing-patterns.md) for comprehensive examples of:
- Authentication flows
- Form validation
- API integration
- File uploads
- Multi-step processes

## Resources

- [Cypress Documentation](https://docs.cypress.io)
- [Cypress Next.js Guide](https://docs.cypress.io/guides/component-testing/react/quickstart)
- [Cypress Best Practices](https://docs.cypress.io/guides/references/best-practices)
- [Component Testing](https://docs.cypress.io/guides/component-testing/overview)
