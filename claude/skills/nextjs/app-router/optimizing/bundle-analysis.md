# Bundle Analysis & Optimization

Analyze and optimize your Next.js application's JavaScript bundle size for better performance.

## Bundle Analyzer Setup

### Installation

```bash
npm install @next/bundle-analyzer
```

### Configuration

```js
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer({
  // Your Next.js config
})
```

### Usage

```json
// package.json
{
  "scripts": {
    "analyze": "ANALYZE=true next build",
    "analyze:server": "ANALYZE=true BUNDLE_ANALYZE=server next build",
    "analyze:browser": "ANALYZE=true BUNDLE_ANALYZE=browser next build"
  }
}
```

Run analysis:

```bash
npm run analyze
```

This will open an interactive treemap visualization in your browser showing bundle composition.

## Reading Bundle Analysis

### Understanding the Visualization

The bundle analyzer shows:
- **File sizes**: Stat size (original), Parsed size (minified), Gzipped size
- **Dependencies**: What's included in each chunk
- **Code splitting**: How code is divided across chunks
- **Duplicates**: Libraries included multiple times

### Key Metrics

```
Stat size: Original file size before processing
Parsed size: Minified file size
Gzipped size: Compressed size sent to browser (most important)
```

### What to Look For

1. **Large dependencies**: Libraries over 50KB gzipped
2. **Duplicate code**: Same library in multiple chunks
3. **Unused code**: Large libraries with small usage
4. **Poor chunking**: Routes with unnecessarily large bundles

## Identifying Issues

### Large Dependencies

```bash
# After running analyze, look for large modules
# Example problematic dependencies:
- moment.js (~70KB) - use date-fns instead
- lodash (full build ~70KB) - use individual imports
- chart.js (~180KB) - consider lazy loading
```

### Finding Alternatives

```tsx
// Bad - importing entire lodash
import _ from 'lodash'
const result = _.debounce(fn, 300)

// Good - importing specific function
import debounce from 'lodash/debounce'
const result = debounce(fn, 300)

// Better - use native or smaller alternative
const debounce = (fn, delay) => {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}
```

### Duplicate Dependencies

Check for duplicates:

```bash
npm ls <package-name>
```

Fix version conflicts:

```json
// package.json
{
  "resolutions": {
    "package-name": "1.2.3"
  }
}
```

## Optimization Strategies

### 1. Tree Shaking

Ensure tree shaking works properly:

```tsx
// Bad - imports everything
import * as utils from './utils'
utils.formatDate(date)

// Good - imports only what's needed
import { formatDate } from './utils'
formatDate(date)
```

Enable tree shaking:

```js
// next.config.js
module.exports = {
  webpack: (config) => {
    config.optimization = {
      ...config.optimization,
      usedExports: true,
      sideEffects: false,
    }
    return config
  },
}
```

### 2. Code Splitting

#### Automatic Route-Based Splitting

Next.js automatically splits code by route. No configuration needed.

#### Manual Code Splitting

```tsx
// Split large components
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('@/components/Heavy'))
const Chart = dynamic(() => import('@/components/Chart'))

export default function Page() {
  return (
    <>
      <HeavyComponent />
      <Chart />
    </>
  )
}
```

#### Library Code Splitting

```tsx
'use client'

import { useState } from 'react'

export default function DatePicker() {
  const [date, setDate] = useState<Date | null>(null)

  const handleDateChange = async (newDate: Date) => {
    // Load date-fns only when needed
    const { format } = await import('date-fns')
    const formatted = format(newDate, 'yyyy-MM-dd')
    console.log(formatted)
    setDate(newDate)
  }

  return <input type="date" onChange={(e) => handleDateChange(new Date(e.target.value))} />
}
```

### 3. Module Replacement

Replace heavy libraries with lighter alternatives:

```tsx
// Bad - Moment.js (70KB)
import moment from 'moment'
const formatted = moment(date).format('YYYY-MM-DD')

// Good - date-fns (modular, ~2KB per function)
import { format } from 'date-fns'
const formatted = format(date, 'yyyy-MM-dd')

// Best - native Intl API (0KB, built-in)
const formatted = new Intl.DateTimeFormat('en-US').format(date)
```

More examples:

```tsx
// Lodash alternatives
// Bad
import _ from 'lodash'

// Better
import debounce from 'lodash/debounce'

// Best - native methods when possible
const unique = [...new Set(array)]
const grouped = array.reduce((acc, item) => {
  acc[item.category] = acc[item.category] || []
  acc[item.category].push(item)
  return acc
}, {})
```

### 4. Remove Unused Dependencies

Analyze unused dependencies:

```bash
npm install -g depcheck
depcheck
```

Remove unused packages:

```bash
npm uninstall unused-package
```

### 5. Optimize Images

Use `next/image` to reduce bundle impact:

```tsx
import Image from 'next/image'

// This doesn't add to JS bundle
<Image
  src="/large-image.jpg"
  width={800}
  height={600}
  alt="Image"
/>
```

### 6. Use Server Components

Default to Server Components in App Router:

```tsx
// app/page.tsx
// This is a Server Component by default - no JS sent to client
export default function Page() {
  return <div>Content rendered on server</div>
}

// Only use 'use client' when necessary
// app/interactive.tsx
'use client'

import { useState } from 'react'

export default function Interactive() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

## Advanced Techniques

### Custom Webpack Configuration

#### Analyze Specific Chunks

```js
// next.config.js
module.exports = {
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Production client-side only
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          // Common chunk
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      }
    }
    return config
  },
}
```

#### Externalize Dependencies

```js
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle these on client side
      config.externals = {
        ...config.externals,
        'heavy-server-only-lib': 'commonjs heavy-server-only-lib',
      }
    }
    return config
  },
}
```

### Import Cost Monitoring

Install VS Code extension: "Import Cost"

Shows inline size of imports:

```tsx
import moment from 'moment' // 📦 72.4KB (gzipped: 24.4KB)
import { format } from 'date-fns' // 📦 4.8KB (gzipped: 1.9KB)
```

### Bundle Size Budgets

Set size budgets in `next.config.js`:

```js
// next.config.js
module.exports = {
  // Show warning if bundle exceeds these sizes
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Custom webpack plugin for size limits
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.performance = {
        maxAssetSize: 244 * 1024, // 244 KB
        maxEntrypointSize: 244 * 1024,
      }
    }
    return config
  },
}
```

## Measurement & Monitoring

### Build-time Analysis

Create custom script to track bundle size:

```js
// scripts/bundle-size.js
const fs = require('fs')
const path = require('path')

function getDirSize(dirPath) {
  let size = 0
  const files = fs.readdirSync(dirPath)

  files.forEach((file) => {
    const filePath = path.join(dirPath, file)
    const stats = fs.statSync(filePath)

    if (stats.isDirectory()) {
      size += getDirSize(filePath)
    } else {
      size += stats.size
    }
  })

  return size
}

const buildDir = path.join(process.cwd(), '.next')
const size = getDirSize(buildDir)
const sizeInMB = (size / 1024 / 1024).toFixed(2)

console.log(`Total build size: ${sizeInMB} MB`)

// Log to file for tracking over time
fs.appendFileSync(
  'bundle-size-log.txt',
  `${new Date().toISOString()}: ${sizeInMB} MB\n`
)
```

```json
// package.json
{
  "scripts": {
    "postbuild": "node scripts/bundle-size.js"
  }
}
```

### CI/CD Integration

GitHub Action example:

```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size Check

on: [pull_request]

jobs:
  bundle-size:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Analyze bundle
        run: npm run analyze

      - name: Check bundle size
        run: |
          SIZE=$(du -sh .next | awk '{print $1}')
          echo "Bundle size: $SIZE"

      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: 'Bundle size: Check artifacts for details'
            })
```

### Production Monitoring

Track bundle size in production:

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('PerformanceObserver' in window) {
                const observer = new PerformanceObserver((list) => {
                  for (const entry of list.getEntries()) {
                    if (entry.entryType === 'resource') {
                      console.log(
                        entry.name,
                        'Size:',
                        entry.transferSize,
                        'bytes'
                      )
                    }
                  }
                })
                observer.observe({ entryTypes: ['resource'] })
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
```

## Common Optimizations

### Date Libraries

```tsx
// Before: Moment.js (~70KB)
import moment from 'moment'

// After: date-fns (~2KB per function)
import { format, parseISO } from 'date-fns'

// Or: Native Intl (0KB)
const formatted = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(new Date())
```

### Icon Libraries

```tsx
// Before: FontAwesome full library (~900KB)
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHome, faUser } from '@fortawesome/free-solid-svg-icons'

// After: Individual SVG imports
import HomeIcon from '@/icons/home.svg'
import UserIcon from '@/icons/user.svg'

// Or: Lucide React (tree-shakeable)
import { Home, User } from 'lucide-react'
```

### UI Component Libraries

```tsx
// Before: Material-UI full (~400KB)
import { Button, TextField, Dialog } from '@mui/material'

// After: Headless UI + Tailwind (~50KB)
import { Dialog } from '@headlessui/react'

// Or: Radix UI primitives (~10KB per component)
import * as Dialog from '@radix-ui/react-dialog'
```

### Form Libraries

```tsx
// Before: Formik (~30KB)
import { Formik, Form, Field } from 'formik'

// After: React Hook Form (~9KB)
import { useForm } from 'react-hook-form'

// Or: Native form handling (0KB)
const handleSubmit = (e) => {
  e.preventDefault()
  const formData = new FormData(e.target)
  // Process form data
}
```

## Best Practices

1. **Regular Analysis**: Run bundle analyzer with each significant change
2. **Set Budgets**: Define maximum acceptable bundle sizes
3. **Monitor Trends**: Track bundle size over time
4. **Lazy Load Heavy Components**: Use dynamic imports
5. **Use Server Components**: Default to server-side rendering
6. **Optimize Dependencies**: Choose lighter alternatives
7. **Tree Shake Properly**: Use ES modules and named imports
8. **Remove Dead Code**: Regular dependency audits
9. **Measure Impact**: Test performance before and after optimizations
10. **CI/CD Checks**: Automate bundle size monitoring

## Checklist

- [ ] Bundle analyzer configured and run regularly
- [ ] Large dependencies identified and optimized
- [ ] Tree shaking enabled and verified
- [ ] Heavy components lazy loaded
- [ ] Server Components used by default
- [ ] Duplicate dependencies resolved
- [ ] Bundle size budgets defined
- [ ] Unused dependencies removed
- [ ] CI/CD bundle size checks implemented
- [ ] Production monitoring in place

## Resources

- [Next.js Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [Webpack Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)
- [Bundle Size Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/bundle-analyzer)
- [Import Cost VS Code Extension](https://marketplace.visualstudio.com/items?itemName=wix.vscode-import-cost)
