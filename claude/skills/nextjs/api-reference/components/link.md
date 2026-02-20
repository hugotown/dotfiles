# Next.js Link Component

The `next/link` component enables client-side navigation between routes with automatic prefetching for optimal performance.

## Import

```jsx
import Link from 'next/link'
```

## Basic Usage

```jsx
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/about">About</Link>
  )
}
```

## Props API Reference

### Required Props

#### href
- **Type**: `string | UrlObject`
- **Description**: Path or URL to navigate to
- Can be a string or object with pathname, query, and hash

```jsx
// String path
<Link href="/about">About</Link>

// Dynamic route
<Link href={`/blog/${post.slug}`}>Read more</Link>

// URL object
<Link href={{
  pathname: '/blog/[slug]',
  query: { slug: 'hello-world' },
}}>
  Blog Post
</Link>

// With hash
<Link href="/about#team">Our Team</Link>

// With query parameters
<Link href={{
  pathname: '/search',
  query: { q: 'nextjs', category: 'docs' },
}}>
  Search
</Link>
```

### Optional Props

#### replace
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Replace current history state instead of adding new URL to stack
- Useful for login redirects or form submissions

```jsx
// Standard navigation (adds to history)
<Link href="/dashboard">Dashboard</Link>

// Replace history (doesn't add to history)
<Link href="/login" replace>Login</Link>
```

#### scroll
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Scroll to top of page after navigation
- Set to `false` to maintain scroll position

```jsx
// Default: scrolls to top
<Link href="/about">About</Link>

// Maintain scroll position
<Link href="/about" scroll={false}>About</Link>
```

#### prefetch
- **Type**: `boolean | null`
- **Default**: `null` (auto-prefetch in production)
- **Description**: Prefetch the page in the background
- **Automatic in production** when link enters viewport
- Set to `false` to disable prefetching

```jsx
// Auto-prefetch (default in production)
<Link href="/about">About</Link>

// Disable prefetching
<Link href="/external" prefetch={false}>External</Link>

// Force prefetch (even in development)
<Link href="/dashboard" prefetch={true}>Dashboard</Link>
```

#### shallow
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Update URL without running data fetching methods
- Only works for same page URL changes

```jsx
// Shallow routing - updates URL without full page reload
<Link
  href={{
    pathname: '/posts',
    query: { sortBy: 'date' }
  }}
  shallow
>
  Sort by Date
</Link>
```

#### locale
- **Type**: `string | false`
- **Description**: Active locale for internationalized routing
- Automatically prepends locale to path

```jsx
// Link to French version
<Link href="/about" locale="fr">À propos</Link>

// Link without locale prefix
<Link href="/about" locale={false}>About</Link>
```

#### legacyBehavior
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Use legacy behavior (requires child to be `<a>`)
- Needed for custom components

```jsx
// Legacy behavior
<Link href="/about" legacyBehavior>
  <a>About</a>
</Link>

// Modern behavior (default)
<Link href="/about">About</Link>
```

#### passHref
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Force passing href to child component
- Useful with custom components or styled components

```jsx
import styled from 'styled-components'

const StyledLink = styled.a`
  color: blue;
  text-decoration: none;
`

// Pass href to styled component
<Link href="/about" passHref legacyBehavior>
  <StyledLink>About</StyledLink>
</Link>
```

## Common Patterns

### Navigation Menu

```jsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav>
      <Link
        href="/"
        className={pathname === '/' ? 'active' : ''}
      >
        Home
      </Link>
      <Link
        href="/about"
        className={pathname === '/about' ? 'active' : ''}
      >
        About
      </Link>
      <Link
        href="/blog"
        className={pathname.startsWith('/blog') ? 'active' : ''}
      >
        Blog
      </Link>
    </nav>
  )
}
```

### Dynamic Routes

```jsx
// Link to dynamic route
const posts = [
  { id: 1, slug: 'hello-world', title: 'Hello World' },
  { id: 2, slug: 'nextjs-tips', title: 'Next.js Tips' },
]

export default function BlogList() {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/blog/${post.slug}`}>
            {post.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

### Pagination

```jsx
export default function Pagination({ currentPage, totalPages }) {
  return (
    <div>
      {currentPage > 1 && (
        <Link
          href={{
            pathname: '/posts',
            query: { page: currentPage - 1 }
          }}
        >
          Previous
        </Link>
      )}

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <Link
          key={page}
          href={{
            pathname: '/posts',
            query: { page }
          }}
          className={page === currentPage ? 'active' : ''}
        >
          {page}
        </Link>
      ))}

      {currentPage < totalPages && (
        <Link
          href={{
            pathname: '/posts',
            query: { page: currentPage + 1 }
          }}
        >
          Next
        </Link>
      )}
    </div>
  )
}
```

### Filters with Shallow Routing

```jsx
'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function ProductFilters() {
  const searchParams = useSearchParams()
  const category = searchParams.get('category')

  const categories = ['electronics', 'clothing', 'books']

  return (
    <div>
      <h3>Filter by Category</h3>
      {categories.map((cat) => (
        <Link
          key={cat}
          href={{
            pathname: '/products',
            query: { category: cat }
          }}
          shallow
          className={category === cat ? 'active' : ''}
        >
          {cat}
        </Link>
      ))}
    </div>
  )
}
```

### Breadcrumbs

```jsx
import Link from 'next/link'

export default function Breadcrumbs({ paths }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol style={{ display: 'flex', gap: '0.5rem', listStyle: 'none' }}>
        <li>
          <Link href="/">Home</Link>
        </li>
        {paths.map((path, index) => (
          <li key={path.href}>
            <span> / </span>
            {index === paths.length - 1 ? (
              <span aria-current="page">{path.label}</span>
            ) : (
              <Link href={path.href}>{path.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

// Usage
<Breadcrumbs paths={[
  { href: '/blog', label: 'Blog' },
  { href: '/blog/nextjs', label: 'Next.js' },
  { href: '/blog/nextjs/routing', label: 'Routing' }
]} />
```

### Call-to-Action Button

```jsx
import Link from 'next/link'

export default function CTAButton({ href, children, variant = 'primary' }) {
  return (
    <Link
      href={href}
      className={`btn btn-${variant}`}
      style={{
        display: 'inline-block',
        padding: '0.75rem 1.5rem',
        borderRadius: '0.375rem',
        textDecoration: 'none',
        backgroundColor: variant === 'primary' ? '#0070f3' : '#eaeaea',
        color: variant === 'primary' ? 'white' : 'black',
      }}
    >
      {children}
    </Link>
  )
}

// Usage
<CTAButton href="/signup">Get Started</CTAButton>
```

### Card with Link Overlay

```jsx
import Link from 'next/link'

export default function Card({ title, description, href }) {
  return (
    <article style={{ position: 'relative', border: '1px solid #eaeaea', padding: '1.5rem' }}>
      <h3>
        <Link href={href} style={{ textDecoration: 'none' }}>
          {title}
        </Link>
      </h3>
      <p>{description}</p>
      {/* Overlay link for entire card */}
      <Link
        href={href}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1
        }}
        aria-label={`Read more about ${title}`}
      >
        <span style={{ display: 'none' }}>Read more</span>
      </Link>
    </article>
  )
}
```

### Language Switcher (i18n)

```jsx
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function LanguageSwitcher() {
  const router = useRouter()
  const { locales, locale: activeLocale } = router

  return (
    <div>
      {locales.map((locale) => (
        <Link
          key={locale}
          href={router.asPath}
          locale={locale}
          className={locale === activeLocale ? 'active' : ''}
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </div>
  )
}
```

### Tabs with URL State

```jsx
'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function Tabs({ tabs }) {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || tabs[0].id

  return (
    <div>
      <div role="tablist">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={{
              query: { tab: tab.id }
            }}
            shallow
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'active' : ''}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <div role="tabpanel">
        {tabs.find(t => t.id === activeTab)?.content}
      </div>
    </div>
  )
}
```

## Prefetching Behavior

### Production
- **Automatic**: Links are prefetched when they enter the viewport
- **Static routes**: Full page prefetched
- **Dynamic routes**: Partial prefetch (shared layout)

### Development
- **Disabled by default**: No prefetching in dev mode
- **Can force**: Set `prefetch={true}`

### Controlling Prefetch

```jsx
// Disable prefetch for external links
<Link href="https://example.com" prefetch={false}>
  External Site
</Link>

// Force prefetch in development
<Link href="/dashboard" prefetch={true}>
  Dashboard
</Link>

// Auto prefetch (production only)
<Link href="/about">About</Link>
```

## Navigation Methods

### Programmatic Navigation

```jsx
'use client'
import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()

  const handleClick = () => {
    router.push('/dashboard')
  }

  return <button onClick={handleClick}>Go to Dashboard</button>
}
```

### Router Methods

```jsx
const router = useRouter()

// Navigate to route
router.push('/about')

// Replace current route
router.replace('/login')

// Go back
router.back()

// Go forward
router.forward()

// Refresh current route
router.refresh()

// Prefetch route
router.prefetch('/dashboard')
```

## Accessibility Considerations

1. **Use descriptive link text**: Avoid "click here" or "read more"
2. **Provide context**: Link text should make sense out of context
3. **Use aria-label** for ambiguous links
4. **Mark current page**: Use `aria-current="page"`
5. **Keyboard accessible**: Links are natively keyboard accessible

```jsx
// Good - descriptive
<Link href="/blog/nextjs-routing">Learn about Next.js routing</Link>

// Poor - needs context
<Link href="/blog/nextjs-routing">Click here</Link>

// Better - with aria-label
<Link
  href="/blog/nextjs-routing"
  aria-label="Learn about Next.js routing"
>
  Read more
</Link>

// Current page indicator
<Link
  href="/about"
  aria-current={pathname === '/about' ? 'page' : undefined}
>
  About
</Link>
```

## Styling Links

### CSS Modules

```jsx
import Link from 'next/link'
import styles from './Navigation.module.css'

export default function Navigation() {
  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.link}>Home</Link>
      <Link href="/about" className={styles.link}>About</Link>
    </nav>
  )
}
```

### Tailwind CSS

```jsx
<Link
  href="/about"
  className="text-blue-600 hover:text-blue-800 underline"
>
  About
</Link>
```

### Active Link Styling

```jsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavLink({ href, children }) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link
      href={href}
      className={isActive ? 'active' : ''}
      style={{
        color: isActive ? '#0070f3' : 'inherit',
        fontWeight: isActive ? 'bold' : 'normal'
      }}
    >
      {children}
    </Link>
  )
}
```

## Performance Tips

1. **Leverage automatic prefetching** for better perceived performance
2. **Use `replace`** for redirects to prevent back-button issues
3. **Use `shallow`** routing for URL state changes without re-fetching
4. **Disable prefetch** for rarely-visited pages to save bandwidth
5. **Prefetch critical routes** early with `router.prefetch()`

## Common Issues

### Link doesn't navigate
- Ensure href is valid
- Check if using `legacyBehavior` correctly
- Verify no JavaScript errors blocking navigation

### Prefetch not working
- Prefetch is disabled in development by default
- Check if `prefetch={false}` is set
- Verify production build

### Styling not applied
- Don't nest `<a>` inside `<Link>` (unless using `legacyBehavior`)
- Apply styles directly to `<Link>` component
- Use `className` or `style` props

### External links
```jsx
// For external links, use regular <a> tag
<a href="https://example.com" target="_blank" rel="noopener noreferrer">
  External Site
</a>

// Or disable prefetch
<Link href="https://example.com" prefetch={false}>
  External Site
</Link>
```

## Best Practices

1. **Always use Link for internal navigation** (not `<a>`)
2. **Use descriptive link text** for accessibility
3. **Mark active links** visually and with ARIA attributes
4. **Use `priority` prefetch** for critical routes
5. **Use `shallow` routing** for filters and tabs
6. **Replace history** for login/logout flows
7. **Provide loading states** for slow navigations
8. **Test keyboard navigation** and screen readers
