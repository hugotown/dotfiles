# next lint

Run ESLint on your Next.js application.

## Syntax

```bash
next lint [directory] [options]
```

## Description

Runs ESLint with Next.js-specific rules and configurations. Helps catch errors, enforce code quality, and follow Next.js best practices.

Features:
- Next.js-specific rules
- Accessibility checks
- Performance optimizations
- Core Web Vitals recommendations
- Auto-fix capability

## Options

### `[directory]`
Specify directory to lint (default: current directory).

```bash
next lint ./src
next lint ./app
```

### `--dir` / `-d`
Specify directories to lint (can specify multiple).

```bash
next lint --dir src --dir app
next lint -d pages -d components
```

### `--file`
Lint specific files.

```bash
next lint --file pages/index.tsx
next lint --file "components/**/*.tsx"
```

### `--ext`
Specify file extensions to check.

```bash
next lint --ext .ts,.tsx
next lint --ext .js,.jsx,.ts,.tsx
```

### `--fix`
Automatically fix problems.

```bash
next lint --fix
```

### `--quiet`
Report errors only, ignore warnings.

```bash
next lint --quiet
```

### `--max-warnings`
Exit with error if warnings exceed limit.

```bash
next lint --max-warnings 0
next lint --max-warnings 10
```

### `--no-cache`
Disable caching of linting results.

```bash
next lint --no-cache
```

### `--cache-location`
Specify cache file location.

```bash
next lint --cache-location .eslintcache
```

### `--format`
Specify output format.

```bash
next lint --format json
next lint --format stylish
next lint --format compact
```

### `--strict`
Enable strict mode with recommended Next.js rules.

```bash
next lint --strict
```

## ESLint Configuration

### Default Setup

When running `next lint` for first time, Next.js offers to set up ESLint:

```bash
next lint

# Prompts:
# ? How would you like to configure ESLint?
#
# ❯ Strict (recommended)
#   Base
#   Cancel
```

### .eslintrc.json

**Base Configuration:**
```json
{
  "extends": "next"
}
```

**Strict Configuration:**
```json
{
  "extends": "next/core-web-vitals"
}
```

**Custom Configuration:**
```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@next/next/no-html-link-for-pages": "error",
    "react/no-unescaped-entities": "off",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

## Next.js ESLint Plugin

Included in `eslint-config-next`:

### Rules Categories

**Core Web Vitals (next/core-web-vitals)**
- No HTML link for pages
- No img element (use next/image)
- No sync scripts
- Google Font display

**Recommended (next)**
- No CSS tags
- No head element
- No page custom font
- No title in document
- No unwanted polyfill

## Rule Reference

### @next/next/no-html-link-for-pages
Use `next/link` instead of `<a>` for internal navigation.

```typescript
// ❌ Bad
<a href="/about">About</a>

// ✅ Good
import Link from 'next/link'
<Link href="/about">About</Link>
```

### @next/next/no-img-element
Use `next/image` instead of `<img>`.

```typescript
// ❌ Bad
<img src="/photo.jpg" alt="Photo" />

// ✅ Good
import Image from 'next/image'
<Image src="/photo.jpg" width={500} height={300} alt="Photo" />
```

### @next/next/no-sync-scripts
Use `next/script` with proper loading strategy.

```typescript
// ❌ Bad
<script src="https://example.com/script.js" />

// ✅ Good
import Script from 'next/script'
<Script src="https://example.com/script.js" strategy="lazyOnload" />
```

### @next/next/google-font-display
Ensure font-display is set for Google Fonts.

```typescript
// ❌ Bad
<link href="https://fonts.googleapis.com/css2?family=Inter" />

// ✅ Good
<link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" />

// ✅ Better
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'] })
```

### @next/next/no-head-element
Use `next/head` in pages or metadata in app directory.

```typescript
// ❌ Bad
<head>
  <title>Page Title</title>
</head>

// ✅ Good (Pages Router)
import Head from 'next/head'
<Head>
  <title>Page Title</title>
</Head>

// ✅ Good (App Router)
export const metadata = {
  title: 'Page Title',
}
```

## Usage Examples

### Basic Linting
```bash
# Lint entire project
next lint

# Or via package.json
npm run lint
```

### Lint Specific Directories
```bash
# Single directory
next lint --dir app

# Multiple directories
next lint --dir app --dir components --dir lib
```

### Lint and Fix
```bash
# Auto-fix issues
next lint --fix

# Fix only, no warnings
next lint --fix --quiet
```

### Strict Mode
```bash
# Zero warnings allowed
next lint --max-warnings 0

# Quiet mode (errors only)
next lint --quiet
```

### CI/CD Integration
```bash
# Fail build on any warning
next lint --max-warnings 0

# Cache results for faster runs
next lint --cache

# JSON output for parsing
next lint --format json > eslint-report.json
```

## Integration with Build

### Automatic Linting

Linting runs automatically during `next build`:

```bash
next build
# Includes linting step
```

### Disable Build-Time Linting

```javascript
// next.config.js
module.exports = {
  eslint: {
    // Warning: Allows production builds despite ESLint errors
    ignoreDuringBuilds: true,
  },
}
```

### Custom Directories for Build

```javascript
// next.config.js
module.exports = {
  eslint: {
    dirs: ['pages', 'app', 'components', 'lib', 'utils'],
  },
}
```

## IDE Integration

### VS Code

Install ESLint extension:
```json
// .vscode/settings.json
{
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### WebStorm/IntelliJ
Enable ESLint in preferences:
- Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
- Check "Automatic ESLint configuration"

## Custom Rules

### Adding Rules

```json
// .eslintrc.json
{
  "extends": "next/core-web-vitals",
  "rules": {
    // Turn off specific rules
    "react/no-unescaped-entities": "off",

    // Make warning an error
    "@next/next/no-img-element": "error",

    // Custom rules
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error",

    // TypeScript rules
    "@typescript-eslint/no-unused-vars": [
      "error",
      { "argsIgnorePattern": "^_" }
    ]
  }
}
```

### Disabling Rules

**File level:**
```typescript
/* eslint-disable @next/next/no-img-element */
```

**Line level:**
```typescript
// eslint-disable-next-line @next/next/no-img-element
<img src="/photo.jpg" alt="Photo" />
```

**Next line:**
```typescript
// eslint-disable-next-line
<img src="/photo.jpg" alt="Photo" />
```

## Ignoring Files

### .eslintignore

```
# Dependencies
node_modules/
.pnp.js

# Build outputs
.next/
out/
build/
dist/

# Misc
*.log
.DS_Store
.env*.local

# Testing
coverage/
.nyc_output/

# Generated files
*.d.ts
```

## Common Configurations

### TypeScript Project
```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

### With Prettier
```bash
npm install -D eslint-config-prettier
```

```json
{
  "extends": [
    "next/core-web-vitals",
    "prettier"
  ]
}
```

### Accessibility Focus
```bash
npm install -D eslint-plugin-jsx-a11y
```

```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:jsx-a11y/recommended"
  ]
}
```

### Monorepo Setup
```json
{
  "extends": "next/core-web-vitals",
  "settings": {
    "next": {
      "rootDir": ["apps/*/", "packages/*/"]
    }
  }
}
```

## CI/CD Examples

### GitHub Actions
```yaml
name: Lint
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
```

### Pre-commit Hook

Install husky:
```bash
npm install -D husky lint-staged
npx husky init
```

Configure:
```json
// package.json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "next lint --fix",
      "git add"
    ]
  }
}
```

```bash
# .husky/pre-commit
npm run lint-staged
```

## Performance

### Caching
```bash
# Enable cache (default)
next lint --cache

# Custom cache location
next lint --cache-location .eslintcache

# Disable cache
next lint --no-cache
```

### Parallel Processing
```bash
# Lint multiple directories in parallel
next lint --dir pages &
next lint --dir app &
wait
```

## Troubleshooting

### ESLint Not Found
```bash
# Install ESLint
npm install -D eslint eslint-config-next

# Initialize config
next lint
```

### Rules Not Applied
```bash
# Clear cache
rm .eslintcache
next lint --no-cache

# Verify config
cat .eslintrc.json
```

### Slow Linting
```bash
# Enable caching
next lint --cache

# Lint specific directories
next lint --dir app

# Reduce file scope in config
```

### Conflicting Rules
```bash
# Check rule priority
next lint --debug

# Verify extends order
# Later configs override earlier ones
```

## Best Practices

1. **Use Strict Mode**: Enable `next/core-web-vitals`
2. **Auto-fix on Save**: Configure IDE integration
3. **Pre-commit Hooks**: Catch issues before commit
4. **CI/CD Integration**: Fail builds on errors
5. **Custom Rules**: Adapt to team standards
6. **Regular Updates**: Keep ESLint packages current
7. **Cache Results**: Speed up repeated runs

## Package.json Scripts

```json
{
  "scripts": {
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "lint:strict": "next lint --max-warnings 0",
    "lint:cache": "next lint --cache-location .eslintcache"
  }
}
```

## Related Commands

- [next dev](./next-dev.md) - Development server
- [next build](./next-build.md) - Production build
- [create-next-app](./create-next-app.md) - Create new project

## Learn More

- [ESLint Plugin](https://nextjs.org/docs/app/building-your-application/configuring/eslint)
- [Core Web Vitals](https://web.dev/vitals/)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring/)
