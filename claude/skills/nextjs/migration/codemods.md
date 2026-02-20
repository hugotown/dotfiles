# Using Next.js Codemods for Automated Migrations

Codemods are automated code transformations that help you upgrade your Next.js application. This guide covers all available Next.js codemods and how to use them effectively.

## What are Codemods?

Codemods are scripts that automate code transformations during upgrades or migrations. Next.js provides codemods to:

- Transform deprecated APIs to new ones
- Update import statements
- Restructure component patterns
- Migrate between routing systems
- Upgrade configuration files

## Prerequisites

- Node.js installed
- A Next.js project
- Git (recommended for easy rollback)

## Running Codemods

### Basic Command Structure

```bash
npx @next/codemod@latest <codemod-name> <path>
```

**Parameters**:
- `<codemod-name>`: The name of the transformation
- `<path>`: Files or directory to transform (use `.` for entire project)

### Interactive Mode

Run without arguments for an interactive selection:

```bash
npx @next/codemod@latest
```

This will prompt you to:
1. Select the codemod to run
2. Choose the target directory
3. Confirm the transformation

## Available Codemods

### 1. App Router Migration

#### `app-router-migration`

Transforms Pages Router to App Router structure.

**Usage**:
```bash
npx @next/codemod@latest app-router-migration .
```

**What it does**:
- Creates `app/` directory structure
- Converts `pages/` files to App Router format
- Migrates `_app.tsx` to `layout.tsx`
- Updates imports and exports
- Converts data fetching methods

**Before**:
```typescript
// pages/index.tsx
import { GetServerSideProps } from 'next'

export default function Home({ data }) {
  return <div>{data}</div>
}

export const getServerSideProps: GetServerSideProps = async () => {
  const data = await fetchData()
  return { props: { data } }
}
```

**After**:
```typescript
// app/page.tsx
async function getData() {
  return await fetchData()
}

export default async function Home() {
  const data = await getData()
  return <div>{data}</div>
}
```

**Notes**:
- Manual review required for complex pages
- Context providers need `'use client'` directive
- Check generated code for correctness

### 2. Image Component Updates

#### `next-image-to-legacy-image`

Renames `next/image` imports to `next/legacy/image` for Next.js 13+.

**Usage**:
```bash
npx @next/codemod@latest next-image-to-legacy-image .
```

**What it does**:
Updates imports from `next/image` to `next/legacy/image` to maintain old behavior.

**Before**:
```typescript
import Image from 'next/image'
```

**After**:
```typescript
import Image from 'next/legacy/image'
```

**Use Case**: When you want to upgrade Next.js but keep the old Image API.

#### `next-image-experimental`

Migrates `next/legacy/image` to the new `next/image` API.

**Usage**:
```bash
npx @next/codemod@latest next-image-experimental .
```

**What it does**:
- Updates layout prop to new CSS
- Converts objectFit to style
- Updates other deprecated props

**Before**:
```typescript
import Image from 'next/legacy/image'

<Image
  src="/photo.jpg"
  layout="fill"
  objectFit="cover"
  objectPosition="center"
/>
```

**After**:
```typescript
import Image from 'next/image'

<Image
  src="/photo.jpg"
  fill
  style={{ objectFit: 'cover', objectPosition: 'center' }}
/>
```

### 3. Link Component Updates

#### `new-link`

Updates Link components to remove the child `<a>` tag (Next.js 13+).

**Usage**:
```bash
npx @next/codemod@latest new-link .
```

**What it does**:
Removes the `<a>` tag wrapper inside `<Link>` components.

**Before**:
```typescript
import Link from 'next/link'

<Link href="/about">
  <a className="link">About</a>
</Link>
```

**After**:
```typescript
import Link from 'next/link'

<Link href="/about" className="link">
  About
</Link>
```

**Special Cases**:
- Preserves `onClick` handlers
- Maintains className and other props
- Handles complex child structures

### 4. Built-in Next Font

#### `built-in-next-font`

Transforms `@next/font` imports to `next/font`.

**Usage**:
```bash
npx @next/codemod@latest built-in-next-font .
```

**What it does**:
Updates imports from deprecated `@next/font` package.

**Before**:
```typescript
import { Inter } from '@next/font/google'

const inter = Inter({ subsets: ['latin'] })
```

**After**:
```typescript
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })
```

### 5. Metadata Export

#### `metadata-to-segment-config`

Converts page metadata to the new Metadata API.

**Usage**:
```bash
npx @next/codemod@latest metadata-to-segment-config .
```

**What it does**:
Converts Head component usage to Metadata export.

**Before**:
```typescript
import Head from 'next/head'

export default function Page() {
  return (
    <>
      <Head>
        <title>My Page</title>
        <meta name="description" content="Description" />
      </Head>
      <div>Content</div>
    </>
  )
}
```

**After**:
```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Page',
  description: 'Description',
}

export default function Page() {
  return <div>Content</div>
}
```

### 6. Dynamic Await

#### `app-dir-dynamic-await`

Makes dynamic Next.js APIs async (Next.js 15+).

**Usage**:
```bash
npx @next/codemod@latest app-dir-dynamic-await .
```

**What it does**:
Updates `cookies()`, `headers()`, and `params` to be awaited.

**Before**:
```typescript
import { cookies } from 'next/headers'

export default function Page() {
  const cookieStore = cookies()
  const theme = cookieStore.get('theme')
}
```

**After**:
```typescript
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')
}
```

### 7. React 19 Upgrades

#### `upgrade/react-19`

Prepares your codebase for React 19.

**Usage**:
```bash
npx @next/codemod@latest upgrade/react-19 .
```

**What it does**:
- Replaces deprecated React APIs
- Updates prop-types usage
- Fixes context API usage
- Updates legacy refs

### 8. Named Export for Use Client

#### `use-client-named-export`

Transforms default exports in client components to named exports.

**Usage**:
```bash
npx @next/codemod@latest use-client-named-export .
```

**What it does**:
Converts client components to use named exports.

**Before**:
```typescript
'use client'

export default function MyComponent() {
  return <div>Client Component</div>
}
```

**After**:
```typescript
'use client'

export function MyComponent() {
  return <div>Client Component</div>
}
```

## Advanced Codemod Usage

### Dry Run Mode

Preview changes without modifying files:

```bash
npx @next/codemod@latest <codemod-name> <path> --dry
```

### Git Integration

When using git, codemods will show you a diff:

```bash
# Stage current changes first
git add .

# Run codemod
npx @next/codemod@latest new-link .

# Review changes
git diff

# Commit or discard
git commit -m "Apply new-link codemod"
# or
git checkout .
```

### Targeting Specific Files

Run codemods on specific file types:

```bash
# Only TypeScript files
npx @next/codemod@latest new-link '**/*.tsx'

# Specific directory
npx @next/codemod@latest new-link ./src/components

# Multiple patterns
npx @next/codemod@latest new-link 'components/**/*.tsx' 'pages/**/*.tsx'
```

### Using with Ignore Patterns

Create a `.gitignore`-style file to exclude paths:

```bash
# Create .codemodignore
echo "node_modules/" >> .codemodignore
echo "build/" >> .codemodignore
echo "*.test.tsx" >> .codemodignore

# Run codemod (it will respect .codemodignore)
npx @next/codemod@latest new-link .
```

## Custom Codemods with jscodeshift

You can create custom codemods using jscodeshift:

### Installation

```bash
npm install -g jscodeshift
```

### Example Custom Codemod

Create `my-transform.js`:

```javascript
module.exports = function transformer(file, api) {
  const j = api.jscodeshift
  const root = j(file.source)

  // Find all function components
  root
    .find(j.FunctionDeclaration)
    .filter(path => {
      // Check if it returns JSX
      return j(path)
        .find(j.ReturnStatement)
        .find(j.JSXElement)
        .length > 0
    })
    .forEach(path => {
      // Add a comment above each component
      const comment = j.commentBlock(' Component ', true, false)
      path.value.comments = path.value.comments || []
      path.value.comments.push(comment)
    })

  return root.toSource()
}
```

### Run Custom Codemod

```bash
jscodeshift -t my-transform.js src/
```

## Migration Workflow Best Practices

### Step 1: Prepare Your Repository

```bash
# Ensure clean git state
git status

# Create a migration branch
git checkout -b migrate-to-app-router

# Update dependencies first
npm install next@latest react@latest react-dom@latest
```

### Step 2: Run Codemods Incrementally

Don't run all codemods at once. Use this order:

```bash
# 1. Update Image components
npx @next/codemod@latest next-image-to-legacy-image .
git add . && git commit -m "Update image imports"

# 2. Update Link components
npx @next/codemod@latest new-link .
git add . && git commit -m "Update link components"

# 3. Update fonts
npx @next/codemod@latest built-in-next-font .
git add . && git commit -m "Update font imports"

# 4. Migrate to App Router (big one)
npx @next/codemod@latest app-router-migration .
git add . && git commit -m "Migrate to App Router"
```

### Step 3: Manual Review and Testing

After each codemod:

```bash
# Review changes
git diff HEAD~1

# Test the application
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Step 4: Fix Issues

Codemods aren't perfect. Common manual fixes needed:

1. **Client Components**: Add `'use client'` where needed
```typescript
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

2. **Dynamic Imports**: Update dynamic imports
```typescript
// Before
const DynamicComponent = dynamic(() => import('./Component'))

// After
const DynamicComponent = dynamic(() => import('./Component'), {
  loading: () => <p>Loading...</p>
})
```

3. **Metadata**: Review generated metadata
```typescript
// Review and enhance
export const metadata: Metadata = {
  title: 'My Page',
  description: 'Add proper description',
  openGraph: {
    // Add OG tags
  },
}
```

## Troubleshooting Codemods

### Issue 1: Codemod Fails to Run

**Error**: "Cannot find module '@next/codemod'"

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Try npx with latest
npx @next/codemod@latest <transform>

# Or install globally
npm install -g @next/codemod
```

### Issue 2: Incomplete Transformations

**Problem**: Some files weren't transformed

**Solution**:
```bash
# Run with verbose mode
npx @next/codemod@latest <transform> . --verbose

# Check for syntax errors in source files
npm run build
```

### Issue 3: Git Conflicts

**Problem**: Codemod creates conflicts

**Solution**:
```bash
# Reset to clean state
git checkout .

# Apply codemods to smaller chunks
npx @next/codemod@latest new-link ./src/components
npx @next/codemod@latest new-link ./src/pages
```

### Issue 4: Breaking Changes

**Problem**: App breaks after codemod

**Solution**:
```bash
# Rollback
git checkout .

# Review the codemod's documentation
npx @next/codemod@latest --help <transform-name>

# Apply to a single file first
npx @next/codemod@latest <transform> ./src/app/page.tsx
```

## Combining Multiple Codemods

For major version upgrades, you might need multiple codemods:

### Next.js 12 → 15 Migration Script

Create `migrate.sh`:

```bash
#!/bin/bash

set -e  # Exit on error

echo "Starting Next.js 12 to 15 migration..."

# 1. Update dependencies
echo "Updating dependencies..."
npm install next@15 react@latest react-dom@latest

# 2. Transform images
echo "Transforming images..."
npx @next/codemod@latest next-image-to-legacy-image .
git add . && git commit -m "Transform images to legacy"

# 3. Update links
echo "Updating links..."
npx @next/codemod@latest new-link .
git add . && git commit -m "Update link components"

# 4. Update fonts
echo "Updating fonts..."
npx @next/codemod@latest built-in-next-font .
git add . && git commit -m "Update font imports"

# 5. Migrate to App Router
echo "Migrating to App Router..."
npx @next/codemod@latest app-router-migration .
git add . && git commit -m "Migrate to App Router"

# 6. Update dynamic APIs
echo "Updating dynamic APIs..."
npx @next/codemod@latest app-dir-dynamic-await .
git add . && git commit -m "Update dynamic APIs"

echo "Migration complete! Please review changes and test thoroughly."
```

Make executable and run:

```bash
chmod +x migrate.sh
./migrate.sh
```

## Testing After Codemods

### Automated Testing Checklist

```bash
# 1. Type checking
npm run type-check
# or
tsc --noEmit

# 2. Linting
npm run lint

# 3. Unit tests
npm test

# 4. Build test
npm run build

# 5. Start production server
npm start
```

### Manual Testing Checklist

- [ ] All pages render correctly
- [ ] Navigation works
- [ ] Images load and display properly
- [ ] Forms submit correctly
- [ ] API routes respond as expected
- [ ] Authentication/authorization works
- [ ] Metadata appears in page source
- [ ] Performance is acceptable

## Creating a Custom Migration Strategy

### 1. Assessment Phase

```bash
# Analyze your codebase
npm install -g cloc
cloc src/ --include-lang=TypeScript,JavaScript

# Find Pages Router usage
grep -r "getServerSideProps" src/
grep -r "getStaticProps" src/
```

### 2. Planning Phase

Document what needs transformation:
- Pages using `getServerSideProps`: ___ files
- Pages using `getStaticProps`: ___ files
- Dynamic routes: ___ files
- API routes: ___ files
- Custom `_app.tsx` logic: Yes/No
- Context providers: ___ providers

### 3. Execution Phase

Apply codemods in logical groups:

**Group 1: Simple transforms**
- Image imports
- Link components
- Font imports

**Group 2: Complex transforms**
- App Router migration
- Metadata updates
- Dynamic API updates

**Group 3: Manual work**
- Client components
- Server Actions
- Complex data fetching

### 4. Validation Phase

```bash
# Run all checks
npm run lint && npm run type-check && npm test && npm run build
```

## Additional Resources

- [Official Next.js Codemods](https://nextjs.org/docs/app/building-your-application/upgrading/codemods)
- [jscodeshift Documentation](https://github.com/facebook/jscodeshift)
- [AST Explorer](https://astexplorer.net/) - For creating custom transforms
- [Next.js Upgrade Guide](https://nextjs.org/docs/upgrading)
- [Next.js GitHub Discussions](https://github.com/vercel/next.js/discussions)

## Summary

Codemods are powerful tools for automated migrations but:

✅ **Do**:
- Use version control
- Run codemods incrementally
- Review all changes
- Test thoroughly
- Keep backups

❌ **Don't**:
- Run multiple codemods without commits
- Skip manual review
- Ignore warnings or errors
- Forget to test
- Apply to production without staging

Codemods handle the repetitive work, but you still need to understand what they're doing and verify the results.
