# Installation

Learn how to create a new Next.js project with App Router support.

## Automatic Installation (Recommended)

Use `create-next-app` for the fastest setup:

```bash
npx create-next-app@latest
```

### Interactive Prompts

You'll be asked to configure:

```
What is your project named? my-app
Would you like to use TypeScript? Yes
Would you like to use ESLint? Yes
Would you like to use Tailwind CSS? Yes
Would you like to use `src/` directory? No
Would you like to use App Router? Yes
Would you like to customize the default import alias (@/*)? No
```

### Non-Interactive Installation

Skip prompts with flags:

```bash
npx create-next-app@latest my-app --typescript --eslint --tailwind --app --no-src-dir
```

## Manual Installation

For more control over the setup:

### 1. Install Dependencies

```bash
npm install next@latest react@latest react-dom@latest
```

### 2. Configure package.json

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

### 3. Create App Directory

```bash
mkdir app
```

### 4. Create Root Layout

Create `app/layout.js`:

```jsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

### 5. Create Home Page

Create `app/page.js`:

```jsx
export default function Page() {
  return <h1>Hello, Next.js!</h1>
}
```

### 6. Create next.config.js (Optional)

```js
/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig
```

## TypeScript Setup

### Automatic TypeScript Configuration

Create `tsconfig.json` (empty file):

```bash
touch tsconfig.json
```

Run dev server to auto-configure:

```bash
npm run dev
```

Next.js will populate `tsconfig.json` and create `next-env.d.ts`.

### TypeScript Files

Rename files to `.tsx`:

```typescript
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

```typescript
// app/page.tsx
export default function Page() {
  return <h1>Hello, Next.js!</h1>
}
```

## ESLint Configuration

### Install ESLint

```bash
npm install --save-dev eslint eslint-config-next
```

### Configure .eslintrc.json

```json
{
  "extends": "next/core-web-vitals"
}
```

### Run ESLint

```bash
npm run lint
```

### Strict ESLint Rules

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

## Path Aliases

Configure import aliases in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/styles/*": ["./styles/*"]
    }
  }
}
```

### Using Path Aliases

```typescript
// Instead of: import Button from '../../../components/Button'
import Button from '@/components/Button'
import { fetchData } from '@/lib/api'
```

## Environment Variables

### Create .env.local

```bash
# .env.local
DATABASE_URL=postgresql://localhost:5432/mydb
NEXT_PUBLIC_API_URL=https://api.example.com
```

### Usage

```typescript
// Server-side only
const dbUrl = process.env.DATABASE_URL

// Available in browser (prefixed with NEXT_PUBLIC_)
const apiUrl = process.env.NEXT_PUBLIC_API_URL
```

## Running the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Visit `http://localhost:3000`

### Custom Port

```bash
npm run dev -- -p 3001
```

## Best Practices

1. **Use TypeScript** - Catch errors at compile time
2. **Enable ESLint** - Maintain code quality
3. **Configure path aliases** - Improve import readability
4. **Use .env.local** - Never commit secrets
5. **Keep dependencies updated** - Run `npm outdated` regularly
6. **Use App Router** - It's the recommended approach for new projects

## Common Pitfalls

1. **Forgetting to restart dev server** - Required after environment variable changes
2. **Committing .env.local** - Add to .gitignore
3. **Using outdated Next.js version** - Always use latest stable
4. **Missing root layout** - App Router requires app/layout.js
5. **Incorrect path aliases** - Ensure baseUrl matches your structure

## Verification Checklist

After installation, verify:

- [ ] Dev server runs without errors
- [ ] TypeScript compiles (if using TypeScript)
- [ ] ESLint runs without errors
- [ ] Home page loads at http://localhost:3000
- [ ] Hot reload works when editing files
- [ ] Environment variables are accessible
- [ ] Path aliases resolve correctly
