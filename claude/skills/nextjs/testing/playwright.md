# E2E Testing Next.js with Playwright

Playwright is a modern end-to-end testing framework that provides reliable, fast testing across all major browsers. It's particularly well-suited for Next.js applications with excellent support for modern web features.

## Why Playwright for Next.js?

- **Multi-browser testing**: Chromium, Firefox, and WebKit
- **Auto-wait**: Automatic waiting for elements to be ready
- **Network interception**: Mock API calls and responses
- **Parallel execution**: Fast test runs with worker threads
- **Built-in tools**: Test generator, trace viewer, UI mode
- **TypeScript-first**: Excellent TypeScript support

## Installation

```bash
npm install -D @playwright/test
npx playwright install
```

## Configuration

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
```

### package.json Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:chromium": "playwright test --project=chromium",
    "test:e2e:report": "playwright show-report"
  }
}
```

## Basic Test Structure

### Simple Page Test

```typescript
// tests/e2e/homepage.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('should display homepage content', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/My Next.js App/)
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()
  })

  test('should navigate to about page', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'About' }).click()

    await expect(page).toHaveURL('/about')
    await expect(page.getByRole('heading', { name: 'About Us' })).toBeVisible()
  })
})
```

### Testing Forms

```typescript
// tests/e2e/contact-form.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact')
  })

  test('should submit contact form successfully', async ({ page }) => {
    // Fill out form
    await page.getByLabel('Name').fill('John Doe')
    await page.getByLabel('Email').fill('john@example.com')
    await page.getByLabel('Message').fill('This is a test message')

    // Submit form
    await page.getByRole('button', { name: 'Send Message' }).click()

    // Verify success message
    await expect(page.getByText('Message sent successfully')).toBeVisible()
  })

  test('should show validation errors', async ({ page }) => {
    // Submit without filling form
    await page.getByRole('button', { name: 'Send Message' }).click()

    // Verify validation errors
    await expect(page.getByText('Name is required')).toBeVisible()
    await expect(page.getByText('Email is required')).toBeVisible()
    await expect(page.getByText('Message is required')).toBeVisible()
  })

  test('should validate email format', async ({ page }) => {
    await page.getByLabel('Name').fill('John Doe')
    await page.getByLabel('Email').fill('invalid-email')
    await page.getByLabel('Message').fill('Test')

    await page.getByRole('button', { name: 'Send Message' }).click()

    await expect(page.getByText('Invalid email address')).toBeVisible()
  })
})
```

## Page Object Model

### Page Object Class

```typescript
// tests/e2e/pages/LoginPage.ts
import { Page, Locator } from '@playwright/test'

export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.getByLabel('Email')
    this.passwordInput = page.getByLabel('Password')
    this.submitButton = page.getByRole('button', { name: 'Log In' })
    this.errorMessage = page.getByRole('alert')
  }

  async goto() {
    await this.page.goto('/login')
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent()
  }
}
```

### Using Page Objects

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

test.describe('Authentication', () => {
  let loginPage: LoginPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    await loginPage.goto()
  })

  test('should login with valid credentials', async ({ page }) => {
    await loginPage.login('user@example.com', 'password123')

    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

  test('should show error with invalid credentials', async () => {
    await loginPage.login('user@example.com', 'wrongpassword')

    const error = await loginPage.getErrorMessage()
    expect(error).toContain('Invalid credentials')
  })
})
```

## Fixtures

### Custom Fixtures

```typescript
// tests/e2e/fixtures.ts
import { test as base } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

type Fixtures = {
  loginPage: LoginPage
  authenticatedPage: Page
}

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page)
    await use(loginPage)
  },

  authenticatedPage: async ({ page }, use) => {
    // Login before test
    await page.goto('/login')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Log In' }).click()
    await page.waitForURL('/dashboard')

    await use(page)

    // Cleanup: logout after test
    await page.getByRole('button', { name: 'Logout' }).click()
  },
})

export { expect } from '@playwright/test'
```

### Using Custom Fixtures

```typescript
// tests/e2e/dashboard.spec.ts
import { test, expect } from './fixtures'

test('authenticated user can access dashboard', async ({ authenticatedPage }) => {
  await expect(authenticatedPage.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})
```

## API Mocking

### Mocking API Responses

```typescript
import { test, expect } from '@playwright/test'

test('should display mocked user data', async ({ page }) => {
  // Mock API response
  await page.route('**/api/user', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '1',
        name: 'Mock User',
        email: 'mock@example.com',
      }),
    })
  })

  await page.goto('/profile')

  await expect(page.getByText('Mock User')).toBeVisible()
  await expect(page.getByText('mock@example.com')).toBeVisible()
})

test('should handle API errors', async ({ page }) => {
  // Mock API error
  await page.route('**/api/posts', async route => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' }),
    })
  })

  await page.goto('/posts')

  await expect(page.getByText('Failed to load posts')).toBeVisible()
})
```

### Intercepting and Modifying Requests

```typescript
test('should modify API request', async ({ page }) => {
  await page.route('**/api/search**', async route => {
    const request = route.request()
    const url = new URL(request.url())

    // Modify query parameters
    url.searchParams.set('limit', '10')

    await route.continue({ url: url.toString() })
  })

  await page.goto('/search?q=test')
})
```

## Visual Testing

### Screenshot Comparison

```typescript
import { test, expect } from '@playwright/test'

test('homepage visual regression', async ({ page }) => {
  await page.goto('/')

  // Take and compare screenshot
  await expect(page).toHaveScreenshot('homepage.png')
})

test('mobile viewport screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/')

  await expect(page).toHaveScreenshot('homepage-mobile.png')
})

test('screenshot specific element', async ({ page }) => {
  await page.goto('/products')

  const productCard = page.getByTestId('product-card').first()
  await expect(productCard).toHaveScreenshot('product-card.png')
})
```

### Updating Screenshots

```bash
# Update all screenshots
npx playwright test --update-snapshots

# Update specific test
npx playwright test homepage.spec.ts --update-snapshots
```

## Testing Different States

### Loading States

```typescript
test('should show loading state', async ({ page }) => {
  // Slow down network to see loading state
  await page.route('**/api/posts', async route => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    await route.fulfill({
      status: 200,
      body: JSON.stringify([]),
    })
  })

  await page.goto('/posts')

  await expect(page.getByText('Loading...')).toBeVisible()
  await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 5000 })
})
```

### Error States

```typescript
test('should display error boundary', async ({ page }) => {
  // Mock an error that triggers error boundary
  await page.route('**/api/data', async route => {
    await route.abort('failed')
  })

  await page.goto('/page-with-error')

  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
```

## Authentication Testing

### Persistent Authentication

```typescript
// tests/e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test'

const authFile = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('Email').fill('test@example.com')
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Log In' }).click()

  await page.waitForURL('/dashboard')

  // Save authentication state
  await page.context().storageState({ path: authFile })
})
```

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
})
```

## Testing File Uploads

```typescript
test('should upload file', async ({ page }) => {
  await page.goto('/upload')

  // Upload file
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('./tests/fixtures/sample.pdf')

  await page.getByRole('button', { name: 'Upload' }).click()

  await expect(page.getByText('File uploaded successfully')).toBeVisible()
})

test('should handle multiple file upload', async ({ page }) => {
  await page.goto('/upload-multiple')

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles([
    './tests/fixtures/file1.pdf',
    './tests/fixtures/file2.pdf',
  ])

  await expect(page.getByText('2 files selected')).toBeVisible()
})
```

## Testing Navigation

### Client-side Navigation

```typescript
test('should navigate using client-side routing', async ({ page }) => {
  await page.goto('/')

  // Click link
  await page.getByRole('link', { name: 'Products' }).click()

  // Verify URL changed without full page reload
  await expect(page).toHaveURL('/products')
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible()
})
```

### Back/Forward Navigation

```typescript
test('should navigate back and forward', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'About' }).click()
  await page.getByRole('link', { name: 'Contact' }).click()

  // Go back
  await page.goBack()
  await expect(page).toHaveURL('/about')

  // Go forward
  await page.goForward()
  await expect(page).toHaveURL('/contact')
})
```

## Parallel Routes Testing

```typescript
test('should display parallel routes', async ({ page }) => {
  await page.goto('/dashboard')

  // Check both parallel routes are rendered
  await expect(page.getByTestId('analytics-slot')).toBeVisible()
  await expect(page.getByTestId('team-slot')).toBeVisible()
})
```

## Debugging

### Debug Mode

```bash
# Run in debug mode
npx playwright test --debug

# Debug specific test
npx playwright test auth.spec.ts --debug

# Debug from specific line
npx playwright test --debug auth.spec.ts:10
```

### Using page.pause()

```typescript
test('debug with pause', async ({ page }) => {
  await page.goto('/')

  // Pause execution - inspector will open
  await page.pause()

  await page.getByRole('button').click()
})
```

### Trace Viewer

```bash
# Record trace
npx playwright test --trace on

# Show trace for last test run
npx playwright show-trace

# Show specific trace
npx playwright show-trace trace.zip
```

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Build Next.js app
        run: npm run build

      - name: Run Playwright tests
        run: npm run test:e2e
        env:
          PLAYWRIGHT_TEST_BASE_URL: http://localhost:3000

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
          retention-days: 30
```

## Best Practices

1. **Use semantic locators**: getByRole, getByLabel, getByText
2. **Auto-waiting**: Let Playwright wait automatically
3. **Page Object Model**: Organize complex tests
4. **Isolate tests**: Each test should be independent
5. **Use fixtures**: For common setup/teardown
6. **Mock when needed**: Control external dependencies
7. **Test user journeys**: End-to-end flows
8. **Visual regression**: Use screenshot comparison
9. **Parallel execution**: Run tests in parallel
10. **Trace on failure**: Enable traces for debugging

## Common Patterns

See [Testing Patterns](./testing-patterns.md) for comprehensive examples of:
- Authentication flows
- Form submissions
- API mocking
- File uploads
- Navigation testing

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Next.js E2E Testing](https://nextjs.org/docs/app/building-your-application/testing/playwright)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Test Generator](https://playwright.dev/docs/codegen)
