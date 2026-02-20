# Global CSS in Next.js App Router

Global CSS provides application-wide styles, CSS variables, resets, and foundational styling that applies across all pages and components.

## Overview

Global CSS in Next.js App Router is imported in the root layout and applies to the entire application. It's ideal for:

- CSS resets and normalizations
- CSS custom properties (variables)
- Typography defaults
- Base element styles
- Third-party CSS imports

## Basic Setup

### Creating Global Styles

```css
/* app/globals.css */

/* CSS Reset / Normalize */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #fff;
}

/* Remove default list styles */
ul,
ol {
  list-style: none;
}

/* Remove default link styles */
a {
  color: inherit;
  text-decoration: none;
}

/* Make images responsive by default */
img {
  max-width: 100%;
  height: auto;
  display: block;
}

/* Remove default button styles */
button {
  border: none;
  background: none;
  font: inherit;
  cursor: pointer;
}
```

### Importing in Root Layout

```typescript
// app/layout.tsx
import './globals.css'

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

## CSS Custom Properties (Variables)

### Defining CSS Variables

```css
/* app/globals.css */

:root {
  /* Colors */
  --color-primary: #0070f3;
  --color-secondary: #7928ca;
  --color-success: #10b981;
  --color-error: #ef4444;
  --color-warning: #f59e0b;

  /* Neutral colors */
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #666666;
  --color-text-tertiary: #999999;

  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-bg-tertiary: #e5e5e5;

  --color-border: #e0e0e0;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  --spacing-3xl: 64px;

  /* Typography */
  --font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;

  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 30px;
  --font-size-4xl: 36px;

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);

  /* Z-index */
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-fixed: 1030;
  --z-modal-backdrop: 1040;
  --z-modal: 1050;
  --z-popover: 1060;
  --z-tooltip: 1070;

  /* Transitions */
  --transition-fast: 150ms ease-in-out;
  --transition-base: 200ms ease-in-out;
  --transition-slow: 300ms ease-in-out;
}

/* Apply base styles using variables */
body {
  font-family: var(--font-family-sans);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
}
```

### Using CSS Variables

```css
/* components/button.module.css */
.button {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-base);
  box-shadow: var(--shadow-sm);
}

.primary {
  background-color: var(--color-primary);
  color: white;
}

.primary:hover {
  box-shadow: var(--shadow-md);
}
```

## Dark Mode with CSS Variables

### System-Based Dark Mode

```css
/* app/globals.css */

:root {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #666666;
  --color-border: #e0e0e0;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-primary: #1a1a1a;
    --color-bg-secondary: #2a2a2a;
    --color-text-primary: #ffffff;
    --color-text-secondary: #cccccc;
    --color-border: #404040;
  }
}

body {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
}
```

### Class-Based Dark Mode

```css
/* app/globals.css */

:root {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #666666;
}

[data-theme='dark'] {
  --color-bg-primary: #1a1a1a;
  --color-bg-secondary: #2a2a2a;
  --color-text-primary: #ffffff;
  --color-text-secondary: #cccccc;
}

/* Alternative: class-based */
.dark {
  --color-bg-primary: #1a1a1a;
  --color-bg-secondary: #2a2a2a;
  --color-text-primary: #ffffff;
  --color-text-secondary: #cccccc;
}
```

```typescript
// app/layout.tsx
'use client'

import { useEffect, useState } from 'react'
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light')
    setTheme(initialTheme)
  }, [])

  return (
    <html lang="en" data-theme={theme}>
      <body>{children}</body>
    </html>
  )
}
```

## Typography Defaults

### Headings and Text

```css
/* app/globals.css */

h1, h2, h3, h4, h5, h6 {
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  margin-bottom: var(--spacing-md);
}

h1 {
  font-size: var(--font-size-4xl);
  margin-bottom: var(--spacing-lg);
}

h2 {
  font-size: var(--font-size-3xl);
}

h3 {
  font-size: var(--font-size-2xl);
}

h4 {
  font-size: var(--font-size-xl);
}

h5 {
  font-size: var(--font-size-lg);
}

h6 {
  font-size: var(--font-size-base);
}

p {
  margin-bottom: var(--spacing-md);
  line-height: var(--line-height-relaxed);
}

strong, b {
  font-weight: var(--font-weight-semibold);
}

em, i {
  font-style: italic;
}

small {
  font-size: var(--font-size-sm);
}

code {
  font-family: var(--font-family-mono);
  font-size: 0.9em;
  padding: 2px 6px;
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
}

pre {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  padding: var(--spacing-md);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin-bottom: var(--spacing-md);
}

pre code {
  padding: 0;
  background: none;
}
```

## Layout Utilities

### Container Classes

```css
/* app/globals.css */

.container {
  width: 100%;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: var(--spacing-md);
  padding-right: var(--spacing-md);
}

@media (min-width: 768px) {
  .container {
    padding-left: var(--spacing-lg);
    padding-right: var(--spacing-lg);
  }
}

.container-fluid {
  width: 100%;
  padding-left: var(--spacing-md);
  padding-right: var(--spacing-md);
}

.container-sm {
  max-width: 640px;
}

.container-md {
  max-width: 768px;
}

.container-lg {
  max-width: 1024px;
}

.container-xl {
  max-width: 1280px;
}
```

### Spacing Utilities

```css
/* app/globals.css */

.section {
  padding-top: var(--spacing-3xl);
  padding-bottom: var(--spacing-3xl);
}

@media (max-width: 768px) {
  .section {
    padding-top: var(--spacing-2xl);
    padding-bottom: var(--spacing-2xl);
  }
}

.section-sm {
  padding-top: var(--spacing-xl);
  padding-bottom: var(--spacing-xl);
}

.section-lg {
  padding-top: 80px;
  padding-bottom: 80px;
}
```

## Form Defaults

### Input Styling

```css
/* app/globals.css */

input,
textarea,
select {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

input[type='text'],
input[type='email'],
input[type='password'],
input[type='number'],
input[type='search'],
input[type='tel'],
input[type='url'],
textarea,
select {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  transition: border-color var(--transition-base);
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
}

input:disabled,
textarea:disabled,
select:disabled {
  background-color: var(--color-bg-secondary);
  cursor: not-allowed;
  opacity: 0.6;
}

textarea {
  resize: vertical;
  min-height: 100px;
}

/* Checkbox and radio */
input[type='checkbox'],
input[type='radio'] {
  width: auto;
  margin-right: var(--spacing-sm);
}
```

## Accessibility Helpers

### Focus Styles

```css
/* app/globals.css */

/* Better focus styles for keyboard navigation */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Remove outline for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}

/* Skip to main content link */
.skip-to-main {
  position: absolute;
  left: -9999px;
  z-index: 999;
  padding: var(--spacing-md);
  background-color: var(--color-primary);
  color: white;
  text-decoration: none;
}

.skip-to-main:focus {
  left: 50%;
  transform: translateX(-50%);
  top: var(--spacing-md);
}

/* Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### High Contrast Mode

```css
/* app/globals.css */

@media (prefers-contrast: high) {
  :root {
    --color-border: #000000;
  }

  button,
  a {
    text-decoration: underline;
  }

  input,
  textarea,
  select {
    border-width: 2px;
  }
}
```

### Reduced Motion

```css
/* app/globals.css */

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## Print Styles

```css
/* app/globals.css */

@media print {
  /* Hide navigation and non-essential elements */
  nav,
  footer,
  .no-print {
    display: none !important;
  }

  /* Optimize for print */
  body {
    font-size: 12pt;
    line-height: 1.5;
    color: #000;
    background: #fff;
  }

  a {
    text-decoration: underline;
    color: #000;
  }

  /* Show link URLs after links */
  a[href^='http']:after {
    content: ' (' attr(href) ')';
    font-size: 90%;
  }

  /* Page breaks */
  h1, h2, h3 {
    page-break-after: avoid;
  }

  img, table, figure {
    page-break-inside: avoid;
  }

  /* Ensure images fit on page */
  img {
    max-width: 100% !important;
  }
}
```

## Importing Third-Party CSS

### Font Files

```css
/* app/globals.css */

@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/CustomFont-Regular.woff2') format('woff2'),
       url('/fonts/CustomFont-Regular.woff') format('woff');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/CustomFont-Bold.woff2') format('woff2'),
       url('/fonts/CustomFont-Bold.woff') format('woff');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

### Library Stylesheets

```typescript
// app/layout.tsx
import './globals.css'
import 'normalize.css' // CSS reset
import 'react-loading-skeleton/dist/skeleton.css' // Third-party component styles

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

## Animation Utilities

### Keyframe Animations

```css
/* app/globals.css */

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Animation utility classes */
.animate-fade-in {
  animation: fadeIn var(--transition-slow) ease-in-out;
}

.animate-slide-up {
  animation: slideUp var(--transition-base) ease-out;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

## Best Practices

### 1. Organization

```css
/* app/globals.css */

/* ==========================================================================
   CSS Variables
   ========================================================================== */
:root {
  /* Variables here */
}

/* ==========================================================================
   CSS Reset
   ========================================================================== */
*, *::before, *::after {
  /* Reset styles */
}

/* ==========================================================================
   Base Styles
   ========================================================================== */
body {
  /* Base body styles */
}

/* ==========================================================================
   Typography
   ========================================================================== */
h1, h2, h3, h4, h5, h6 {
  /* Heading styles */
}

/* ==========================================================================
   Forms
   ========================================================================== */
input, textarea, select {
  /* Form styles */
}

/* ==========================================================================
   Utilities
   ========================================================================== */
.container {
  /* Utility classes */
}

/* ==========================================================================
   Media Queries
   ========================================================================== */
@media (min-width: 768px) {
  /* Responsive styles */
}
```

### 2. CSS Variable Naming

```css
/* Good: Clear, hierarchical naming */
--color-primary-500
--color-text-primary
--spacing-md
--font-size-xl

/* Avoid: Generic or unclear names */
--blue
--text
--space
--big
```

### 3. Minimize Global Styles

```css
/* Good: Only truly global styles */
body {
  font-family: var(--font-family-sans);
  color: var(--color-text-primary);
}

/* Avoid: Component-specific styles in global CSS */
.button {
  /* This should be in a module */
}
```

### 4. Use CSS Variables for Theming

```css
/* Good: Variables make theming easy */
:root {
  --button-bg: #0070f3;
}

[data-theme='dark'] {
  --button-bg: #1a8fff;
}

.button {
  background: var(--button-bg);
}

/* Avoid: Hard-coded values */
.button {
  background: #0070f3;
}

.dark .button {
  background: #1a8fff;
}
```

## Common Patterns

### Smooth Scrolling

```css
/* app/globals.css */

html {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

### Sticky Header

```css
/* app/globals.css */

.site-header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  background-color: var(--color-bg-primary);
  box-shadow: var(--shadow-sm);
}
```

### Full-Height Sections

```css
/* app/globals.css */

.full-height {
  min-height: 100vh;
  min-height: 100dvh; /* Dynamic viewport height for mobile */
}
```

## Performance Considerations

1. **Critical CSS**: Global styles are loaded immediately, so keep them minimal
2. **File Size**: Limit global CSS to truly global concerns
3. **Specificity**: Keep global selectors low specificity
4. **Variables**: CSS variables have negligible performance impact
5. **Media Queries**: Use mobile-first approach

## Summary

Global CSS in Next.js App Router is best used for:

- **CSS Variables**: Design tokens and theming
- **Resets**: Normalize browser defaults
- **Base Styles**: Typography, forms, links
- **Utilities**: Reusable helper classes
- **Accessibility**: Focus styles, screen reader utilities
- **Print Styles**: Optimize for printing

Keep global styles focused and minimal, using component-scoped CSS (CSS Modules) or utility classes (Tailwind) for component-specific styling.
