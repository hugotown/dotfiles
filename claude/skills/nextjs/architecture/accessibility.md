# Accessibility

## Overview

Next.js includes built-in accessibility (a11y) features to help build inclusive web applications. These features ensure your application is usable by everyone, including people with disabilities who use assistive technologies like screen readers, keyboard navigation, and other accessibility tools.

## Core Accessibility Features

### 1. Route Announcements

Next.js automatically announces route changes to screen readers:

```javascript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

// When navigating from /home to /about:
// Screen reader announces: "About - navigating"
```

**How it works:**
- Uses ARIA live regions
- Announces page title on route change
- Configurable announcement behavior

**Configuration:**
```javascript
// next.config.js
module.exports = {
  experimental: {
    scrollRestoration: true, // Restore scroll on back/forward
  },
}
```

### 2. Language Declaration

Set the page language for assistive technologies:

```javascript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en"> {/* Declares English content */}
      <body>{children}</body>
    </html>
  )
}

// For multi-language support
export default function RootLayout({ children, params }) {
  return (
    <html lang={params.lang}>
      <body>{children}</body>
    </html>
  )
}
```

### 3. Focus Management

Next.js manages focus during navigation:

```javascript
// Automatic focus reset on route change
import Link from 'next/link'

export default function Navigation() {
  return (
    <nav>
      <Link href="/about">
        About {/* Focus moves here after navigation */}
      </Link>
    </nav>
  )
}
```

**Custom focus management:**
```javascript
'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function FocusManager({ children }) {
  const pathname = usePathname()
  const mainRef = useRef(null)

  useEffect(() => {
    // Focus main content on route change
    mainRef.current?.focus()
  }, [pathname])

  return (
    <main ref={mainRef} tabIndex={-1}>
      {children}
    </main>
  )
}
```

### 4. Skip Links

Enable keyboard users to skip navigation:

```javascript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Navigation />
        <main id="main-content">{children}</main>
      </body>
    </html>
  )
}
```

**Styling skip links:**
```css
/* globals.css */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

## Image Accessibility

### Alt Text

Always provide meaningful alt text:

```javascript
import Image from 'next/image'

export default function ProductImage() {
  return (
    <>
      {/* ✅ Good: Descriptive alt text */}
      <Image
        src="/product.jpg"
        alt="Blue cotton t-shirt with round neck"
        width={500}
        height={500}
      />

      {/* ❌ Bad: Generic alt text */}
      <Image
        src="/product.jpg"
        alt="Image"
        width={500}
        height={500}
      />

      {/* ✅ Decorative images: Empty alt */}
      <Image
        src="/decoration.jpg"
        alt=""
        width={100}
        height={100}
        aria-hidden="true"
      />
    </>
  )
}
```

### Lazy Loading

Next.js images lazy load by default:

```javascript
import Image from 'next/image'

export default function Gallery() {
  return (
    <Image
      src="/photo.jpg"
      alt="Description"
      width={800}
      height={600}
      loading="lazy" // Default behavior
      // Priority images:
      // priority={true} // For above-the-fold images
    />
  )
}
```

## Form Accessibility

### Labels and Inputs

Always associate labels with inputs:

```javascript
export default function ContactForm() {
  return (
    <form>
      {/* ✅ Good: Explicit label */}
      <label htmlFor="email">Email Address</label>
      <input
        type="email"
        id="email"
        name="email"
        required
        aria-describedby="email-hint"
      />
      <span id="email-hint">We'll never share your email</span>

      {/* ✅ Good: Implicit label */}
      <label>
        Phone Number
        <input type="tel" name="phone" />
      </label>

      {/* ❌ Bad: No label */}
      <input type="text" placeholder="Name" />
    </form>
  )
}
```

### Error Handling

Announce errors to screen readers:

```javascript
'use client'

import { useState } from 'react'

export default function Form() {
  const [errors, setErrors] = useState({})

  const handleSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const email = formData.get('email')

    if (!email) {
      setErrors({ email: 'Email is required' })
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input
        type="email"
        id="email"
        name="email"
        aria-invalid={errors.email ? 'true' : 'false'}
        aria-describedby={errors.email ? 'email-error' : undefined}
      />
      {errors.email && (
        <span id="email-error" role="alert" aria-live="polite">
          {errors.email}
        </span>
      )}
      <button type="submit">Submit</button>
    </form>
  )
}
```

### Field Hints

Provide helpful descriptions:

```javascript
export default function PasswordField() {
  return (
    <div>
      <label htmlFor="password">Password</label>
      <input
        type="password"
        id="password"
        name="password"
        aria-describedby="password-requirements"
      />
      <div id="password-requirements">
        Must be at least 8 characters with one number and one symbol
      </div>
    </div>
  )
}
```

## Semantic HTML

### Use Proper Heading Hierarchy

```javascript
export default function Article() {
  return (
    <article>
      <h1>Main Article Title</h1> {/* Only one h1 per page */}

      <section>
        <h2>Section Title</h2>
        <p>Content...</p>

        <h3>Subsection</h3>
        <p>Content...</p>
      </section>

      <section>
        <h2>Another Section</h2>
        <p>Content...</p>
      </section>
    </article>
  )
}
```

### Landmark Regions

Use HTML5 semantic elements:

```javascript
export default function Page() {
  return (
    <>
      <header>
        <nav aria-label="Main navigation">
          <ul>{/* Navigation items */}</ul>
        </nav>
      </header>

      <main>
        <article>
          <h1>Article Title</h1>
          <p>Content...</p>
        </article>

        <aside aria-label="Related articles">
          <h2>Related</h2>
          <ul>{/* Related items */}</ul>
        </aside>
      </main>

      <footer>
        <p>Footer content</p>
      </footer>
    </>
  )
}
```

### Lists

Use semantic list elements:

```javascript
export default function Navigation() {
  return (
    <nav aria-label="Main navigation">
      {/* ✅ Good: Semantic list */}
      <ul>
        <li><Link href="/">Home</Link></li>
        <li><Link href="/about">About</Link></li>
        <li><Link href="/contact">Contact</Link></li>
      </ul>

      {/* ❌ Bad: Divs instead of list */}
      <div>
        <div><Link href="/">Home</Link></div>
        <div><Link href="/about">About</Link></div>
      </div>
    </nav>
  )
}
```

## Keyboard Navigation

### Tab Order

Ensure logical tab order:

```javascript
export default function Modal() {
  return (
    <dialog open>
      <h2>Modal Title</h2>
      <button tabIndex={0}>First</button>
      <button tabIndex={0}>Second</button>
      <button tabIndex={0}>Third</button>
      {/* ❌ Don't use positive tabIndex values */}
      {/* <button tabIndex={1}>Wrong</button> */}
    </dialog>
  )
}
```

### Focus Trap

Trap focus within modals:

```javascript
'use client'

import { useEffect, useRef } from 'react'

export default function Modal({ isOpen, onClose, children }) {
  const modalRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    const modal = modalRef.current
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleTab = (e) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    modal.addEventListener('keydown', handleTab)
    firstElement?.focus()

    return () => modal.removeEventListener('keydown', handleTab)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div ref={modalRef} role="dialog" aria-modal="true">
      {children}
    </div>
  )
}
```

### Keyboard Shortcuts

Implement accessible shortcuts:

```javascript
'use client'

import { useEffect } from 'react'

export default function KeyboardShortcuts() {
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Alt + S for search
      if (e.altKey && e.key === 's') {
        e.preventDefault()
        document.getElementById('search')?.focus()
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        closeModal()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  return (
    <div>
      <input
        id="search"
        type="search"
        aria-label="Search"
        placeholder="Search (Alt+S)"
      />
    </div>
  )
}
```

## ARIA Attributes

### Roles

Use ARIA roles when semantic HTML isn't enough:

```javascript
export default function Tabs() {
  return (
    <div>
      <div role="tablist" aria-label="Product details">
        <button
          role="tab"
          aria-selected="true"
          aria-controls="panel-1"
          id="tab-1"
        >
          Description
        </button>
        <button
          role="tab"
          aria-selected="false"
          aria-controls="panel-2"
          id="tab-2"
        >
          Reviews
        </button>
      </div>

      <div
        role="tabpanel"
        id="panel-1"
        aria-labelledby="tab-1"
        hidden={false}
      >
        <p>Product description...</p>
      </div>

      <div
        role="tabpanel"
        id="panel-2"
        aria-labelledby="tab-2"
        hidden={true}
      >
        <p>Reviews...</p>
      </div>
    </div>
  )
}
```

### Live Regions

Announce dynamic content:

```javascript
'use client'

import { useState } from 'react'

export default function LiveSearch() {
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('')

  const handleSearch = async (query) => {
    setStatus('Searching...')
    const data = await fetch(`/api/search?q=${query}`)
    const results = await data.json()
    setResults(results)
    setStatus(`${results.length} results found`)
  }

  return (
    <div>
      <input
        type="search"
        onChange={(e) => handleSearch(e.target.value)}
        aria-label="Search products"
      />

      {/* Announce status changes */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {status}
      </div>

      <ul>
        {results.map((result) => (
          <li key={result.id}>{result.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

### Labeling

Provide accessible names:

```javascript
export default function IconButtons() {
  return (
    <div>
      {/* ✅ Good: aria-label for icon buttons */}
      <button aria-label="Close dialog">
        <CloseIcon />
      </button>

      {/* ✅ Good: aria-labelledby */}
      <div>
        <h2 id="dialog-title">Confirm Delete</h2>
        <div role="dialog" aria-labelledby="dialog-title">
          <p>Are you sure?</p>
        </div>
      </div>

      {/* ✅ Good: aria-describedby */}
      <button aria-describedby="delete-warning">
        Delete Account
      </button>
      <p id="delete-warning">This action cannot be undone</p>
    </div>
  )
}
```

## Color and Contrast

### Sufficient Contrast

Ensure text meets WCAG standards:

```css
/* ✅ Good: 4.5:1 contrast ratio for normal text */
.text {
  color: #333333;
  background: #ffffff;
}

/* ✅ Good: 3:1 for large text (18pt+) */
.heading {
  color: #666666;
  background: #ffffff;
  font-size: 24px;
}

/* ❌ Bad: Insufficient contrast */
.low-contrast {
  color: #cccccc;
  background: #ffffff;
}
```

### Don't Rely on Color Alone

```javascript
export default function Status() {
  return (
    <div>
      {/* ❌ Bad: Color only */}
      <span style={{ color: 'red' }}>Error</span>

      {/* ✅ Good: Color + icon + text */}
      <span style={{ color: 'red' }}>
        <ErrorIcon aria-hidden="true" />
        <span>Error: Invalid input</span>
      </span>
    </div>
  )
}
```

## Testing Accessibility

### Automated Testing

Use ESLint plugin:

```bash
npm install --save-dev eslint-plugin-jsx-a11y
```

```javascript
// .eslintrc.js
module.exports = {
  extends: ['next/core-web-vitals', 'plugin:jsx-a11y/recommended'],
  plugins: ['jsx-a11y'],
}
```

### Manual Testing

**Keyboard testing:**
```bash
# Test with keyboard only
# Tab through all interactive elements
# Enter/Space to activate buttons
# Arrow keys for custom widgets
# Escape to close modals
```

**Screen reader testing:**
- **macOS**: VoiceOver (Cmd+F5)
- **Windows**: NVDA (free) or JAWS
- **Linux**: Orca

### Automated Accessibility Checks

Use Lighthouse:

```bash
# Run Lighthouse
npm install -g lighthouse
lighthouse http://localhost:3000 --only-categories=accessibility
```

Use axe DevTools browser extension:
- Install axe DevTools
- Open DevTools
- Run accessibility scan

## Best Practices

### 1. Start with Semantic HTML

```javascript
// ✅ Good: Semantic HTML
<button onClick={handleClick}>Click me</button>

// ❌ Bad: Div as button
<div onClick={handleClick}>Click me</div>
```

### 2. Provide Text Alternatives

```javascript
// Images
<Image src="/chart.png" alt="Sales increased 50% in Q1" />

// Icons
<button aria-label="Delete item">
  <TrashIcon aria-hidden="true" />
</button>

// Videos
<video>
  <track kind="captions" src="/captions.vtt" />
</video>
```

### 3. Ensure Keyboard Accessibility

```javascript
// All interactive elements must be keyboard accessible
<button onClick={handleClick}>Accessible</button>

// Custom interactive elements need keyboard handlers
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyPress={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick()
    }
  }}
>
  Custom button
</div>
```

### 4. Test with Real Users

- Include users with disabilities in testing
- Test with assistive technologies
- Gather feedback and iterate

### 5. Document Accessibility Features

```javascript
// Document keyboard shortcuts
export default function HelpDialog() {
  return (
    <dialog>
      <h2>Keyboard Shortcuts</h2>
      <dl>
        <dt>Alt + S</dt>
        <dd>Focus search</dd>

        <dt>Escape</dt>
        <dd>Close dialog</dd>

        <dt>Tab</dt>
        <dd>Navigate forward</dd>

        <dt>Shift + Tab</dt>
        <dd>Navigate backward</dd>
      </dl>
    </dialog>
  )
}
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Next.js Accessibility](https://nextjs.org/docs/architecture/accessibility)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM](https://webaim.org/)
- [A11y Project](https://www.a11yproject.com/)
