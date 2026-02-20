# Project Structure

Understanding Next.js App Router's file-based routing and project organization.

## Directory Structure

```
my-app/
├── app/                    # App Router directory (routing)
│   ├── layout.js          # Root layout
│   ├── page.js            # Home page
│   ├── loading.js         # Loading UI
│   ├── error.js           # Error UI
│   ├── not-found.js       # 404 UI
│   ├── global.css         # Global styles
│   ├── dashboard/         # Route segment
│   │   ├── layout.js      # Dashboard layout
│   │   ├── page.js        # Dashboard page
│   │   └── settings/      # Nested route
│   │       └── page.js    # Settings page
│   └── api/               # API routes
│       └── users/
│           └── route.js   # API endpoint
├── components/            # Reusable components
│   ├── ui/
│   │   ├── Button.js
│   │   └── Card.js
│   └── Header.js
├── lib/                   # Utility functions
│   ├── db.js
│   └── utils.js
├── public/                # Static assets
│   ├── images/
│   └── favicon.ico
├── .env.local            # Environment variables
├── next.config.js        # Next.js configuration
├── package.json
└── tsconfig.json         # TypeScript config
```

## App Directory

The `app` directory is the core of App Router, using file-based routing.

### File Conventions

| File | Purpose | Required |
|------|---------|----------|
| `layout.js` | Shared UI for a segment | Yes (root) |
| `page.js` | Route UI, makes route publicly accessible | Yes |
| `loading.js` | Loading UI for segment | No |
| `error.js` | Error UI for segment | No |
| `not-found.js` | Not found UI | No |
| `route.js` | API endpoint | No |
| `template.js` | Re-rendered layout | No |
| `default.js` | Parallel route fallback | No |

### Special Files

```
app/
├── layout.js          # Required root layout
├── page.js            # Home page (/)
├── loading.js         # Suspense boundary for page
├── error.js           # Error boundary for page
├── not-found.js       # 404 page
└── global-error.js    # Root error boundary
```

## Routing Structure

### Basic Routes

```
app/
├── page.js                 # /
├── about/
│   └── page.js            # /about
├── blog/
│   ├── page.js            # /blog
│   └── [slug]/
│       └── page.js        # /blog/:slug
└── dashboard/
    ├── layout.js          # Shared layout
    ├── page.js            # /dashboard
    ├── analytics/
    │   └── page.js        # /dashboard/analytics
    └── settings/
        └── page.js        # /dashboard/settings
```

### Route Examples

```javascript
// app/page.js
export default function Home() {
  return <h1>Home</h1>
}

// app/about/page.js
export default function About() {
  return <h1>About</h1>
}

// app/blog/[slug]/page.js
export default function BlogPost({ params }) {
  return <h1>Post: {params.slug}</h1>
}
```

## Colocation

You can colocate components, styles, and tests within the `app` directory:

```
app/
├── dashboard/
│   ├── page.js                    # Route
│   ├── layout.js                  # Layout
│   ├── components/                # Private components
│   │   ├── Chart.js
│   │   └── Chart.test.js
│   ├── utils/                     # Private utilities
│   │   └── calculations.js
│   └── styles/
│       └── dashboard.module.css
```

### What Gets Served

Only `page.js` and `route.js` files are publicly routable. Other files are private.

```
app/
├── components/
│   └── Button.js          # NOT a route
├── utils/
│   └── format.js          # NOT a route
└── dashboard/
    ├── page.js            # ✅ Route: /dashboard
    ├── Chart.js           # NOT a route
    └── api/
        └── route.js       # ✅ API route: /dashboard/api
```

## Private Folders

Prefix folders with `_` to exclude them from routing:

```
app/
├── _components/           # Private folder, not routable
│   ├── Button.js
│   └── Card.js
├── _lib/                  # Private utilities
│   └── utils.js
└── dashboard/
    └── page.js           # ✅ Route: /dashboard
```

### When to Use Private Folders

- Shared components across multiple routes
- Utility functions
- Internal logic
- Prevent accidental routing

## Route Groups

Use `(folder)` syntax to organize routes without affecting the URL:

```
app/
├── (marketing)/          # Route group
│   ├── layout.js        # Marketing layout
│   ├── about/
│   │   └── page.js      # /about (not /marketing/about)
│   └── contact/
│       └── page.js      # /contact
├── (shop)/              # Route group
│   ├── layout.js        # Shop layout
│   ├── products/
│   │   └── page.js      # /products
│   └── cart/
│       └── page.js      # /cart
└── layout.js            # Root layout
```

### Benefits of Route Groups

1. **Organize without URL changes** - Logical grouping without affecting routes
2. **Multiple layouts** - Different layouts for different sections
3. **Code organization** - Keep related routes together

## Components Directory

Recommended structure for reusable components:

```
components/
├── ui/                   # Generic UI components
│   ├── Button.js
│   ├── Button.test.js
│   ├── Card.js
│   ├── Input.js
│   └── index.js
├── forms/               # Form components
│   ├── LoginForm.js
│   └── SignupForm.js
├── layout/              # Layout components
│   ├── Header.js
│   ├── Footer.js
│   └── Sidebar.js
└── features/            # Feature-specific components
    ├── UserProfile.js
    └── ProductCard.js
```

## Lib Directory

Utility functions, database connections, and helpers:

```
lib/
├── db.js                # Database connection
├── api.js               # API client
├── utils.js             # General utilities
├── constants.js         # App constants
├── validations.js       # Validation schemas
└── hooks/               # Custom React hooks
    ├── useAuth.js
    └── useLocalStorage.js
```

## Public Directory

Static files served from the root:

```
public/
├── images/
│   ├── logo.svg
│   └── hero.jpg
├── fonts/
│   └── custom-font.woff2
├── favicon.ico
├── robots.txt
└── sitemap.xml
```

### Accessing Public Files

```jsx
import Image from 'next/image'

// Reference files from /public
<Image src="/images/logo.svg" alt="Logo" width={100} height={100} />
```

## Configuration Files

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['example.com'],
  },
  experimental: {
    serverActions: true,
  },
}

module.exports = nextConfig
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## Best Practices

1. **Use colocation** - Keep related files together
2. **Organize with route groups** - Group routes logically without affecting URLs
3. **Private folders for shared code** - Use `_folder` for non-routable code
4. **Separate concerns** - Keep components, lib, and app directories distinct
5. **Follow file conventions** - Use page.js, layout.js, error.js consistently
6. **Use TypeScript** - Add types for better developer experience
7. **Centralize utilities** - Keep helpers in lib directory
8. **Static files in public** - Never import from public, reference by path

## Common Pitfalls

1. **Forgetting page.js** - Routes need page.js to be accessible
2. **Importing from public** - Reference public files by URL path, not import
3. **Nested layouts without layout.js** - Each segment can have its own layout
4. **Mixing app and pages directories** - Choose one routing approach
5. **Not using route groups** - Missing opportunity for better organization
6. **Over-nesting** - Keep route hierarchy shallow when possible

## Migration from Pages Router

Pages Router structure:

```
pages/
├── index.js              # /
├── about.js              # /about
└── blog/
    └── [slug].js         # /blog/:slug
```

App Router equivalent:

```
app/
├── page.js               # /
├── about/
│   └── page.js          # /about
└── blog/
    └── [slug]/
        └── page.js      # /blog/:slug
```

Key differences:
- `pages/` → `app/`
- Files are pages → Folders are routes, page.js creates the page
- `_app.js` → `layout.js`
- `_document.js` → `layout.js` with HTML structure
