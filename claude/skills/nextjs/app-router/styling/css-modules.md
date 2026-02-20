# CSS Modules in Next.js App Router

CSS Modules provide component-scoped CSS with zero runtime overhead, making them ideal for Server Components and performance-critical applications.

## Overview

CSS Modules automatically scope CSS to components by generating unique class names, preventing style conflicts and enabling true component isolation.

## Basic Setup

### Creating a CSS Module

CSS Module files use the `.module.css` extension:

```css
/* components/button.module.css */
.button {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.2s;
}

.primary {
  background-color: #0070f3;
  color: white;
}

.primary:hover {
  background-color: #0051cc;
}

.secondary {
  background-color: #eaeaea;
  color: #000;
}

.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

### Using in Components

```typescript
// components/Button.tsx
import styles from './button.module.css'

interface ButtonProps {
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  children: React.ReactNode
}

export default function Button({
  variant = 'primary',
  disabled = false,
  children
}: ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${disabled ? styles.disabled : ''}`}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
```

## Advanced Features

### Composition with `composes`

Reuse styles from other classes:

```css
/* components/card.module.css */
.baseCard {
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.interactiveCard {
  composes: baseCard;
  cursor: pointer;
  transition: transform 0.2s;
}

.interactiveCard:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.featuredCard {
  composes: baseCard;
  border: 2px solid #0070f3;
}
```

### Importing from Other Modules

```css
/* components/theme.module.css */
.primaryColor {
  color: #0070f3;
}

/* components/heading.module.css */
.title {
  composes: primaryColor from './theme.module.css';
  font-size: 32px;
  font-weight: bold;
}
```

### Global Selectors

Use `:global()` for targeting global elements:

```css
/* components/layout.module.css */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* Target global body when container is present */
.container :global(body) {
  overflow: hidden;
}

/* Target specific global class */
.wrapper :global(.custom-element) {
  margin-top: 20px;
}
```

### Combining Local and Global Classes

```css
.navigation {
  display: flex;
  gap: 16px;
}

.navigation :global(a) {
  text-decoration: none;
  color: inherit;
}

.navigation :global(a.active) {
  font-weight: bold;
  border-bottom: 2px solid currentColor;
}
```

## TypeScript Support

### Type-Safe CSS Modules

Enable TypeScript support for CSS Modules:

```typescript
// next-env.d.ts (auto-generated, but you can extend it)
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

### Using TypeScript Plugin

Install the plugin for autocomplete:

```bash
npm install --save-dev typescript-plugin-css-modules
```

Configure in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "typescript-plugin-css-modules"
      }
    ]
  }
}
```

### Custom Type Definitions

Create type definitions for better autocomplete:

```typescript
// types/css-modules.d.ts
declare module '*.module.css' {
  const classes: { [key: string]: string }
  export default classes
}

declare module '*.module.scss' {
  const classes: { [key: string]: string }
  export default classes
}
```

### Type-Safe Class Names Helper

```typescript
// utils/classnames.ts
type ClassValue = string | number | null | undefined | boolean
type ClassArray = ClassValue[]
type ClassDictionary = Record<string, any>

export function cn(...args: (ClassValue | ClassArray | ClassDictionary)[]): string {
  const classes: string[] = []

  args.forEach(arg => {
    if (!arg) return

    if (typeof arg === 'string' || typeof arg === 'number') {
      classes.push(String(arg))
    } else if (Array.isArray(arg)) {
      classes.push(cn(...arg))
    } else if (typeof arg === 'object') {
      Object.keys(arg).forEach(key => {
        if (arg[key]) classes.push(key)
      })
    }
  })

  return classes.join(' ')
}

// Usage
import styles from './button.module.css'
import { cn } from '@/utils/classnames'

<button className={cn(styles.button, styles.primary, disabled && styles.disabled)}>
```

## Conditional Styling

### Using clsx/classnames Library

```typescript
import styles from './alert.module.css'
import clsx from 'clsx'

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info'
  dismissible?: boolean
  children: React.ReactNode
}

export default function Alert({ type, dismissible, children }: AlertProps) {
  return (
    <div className={clsx(
      styles.alert,
      styles[type],
      dismissible && styles.dismissible
    )}>
      {children}
    </div>
  )
}
```

### Object-Based Conditional Classes

```typescript
import styles from './input.module.css'

interface InputProps {
  error?: string
  touched?: boolean
  disabled?: boolean
}

export default function Input({ error, touched, disabled }: InputProps) {
  const inputClasses = [
    styles.input,
    error && touched && styles.error,
    disabled && styles.disabled
  ].filter(Boolean).join(' ')

  return <input className={inputClasses} disabled={disabled} />
}
```

## Responsive Design

### Mobile-First Approach

```css
/* components/grid.module.css */
.grid {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
}

/* Tablet */
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
  }
}

/* Large Desktop */
@media (min-width: 1280px) {
  .grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

### Container Queries

```css
/* components/card.module.css */
.cardContainer {
  container-type: inline-size;
  container-name: card;
}

.cardContent {
  padding: 16px;
}

.cardTitle {
  font-size: 18px;
}

/* When container is larger than 400px */
@container card (min-width: 400px) {
  .cardContent {
    padding: 24px;
  }

  .cardTitle {
    font-size: 24px;
  }
}
```

## CSS Variables with Modules

### Defining CSS Variables

```css
/* components/theme.module.css */
.theme {
  --primary-color: #0070f3;
  --secondary-color: #7928ca;
  --success-color: #10b981;
  --error-color: #ef4444;
  --spacing-unit: 8px;
  --border-radius: 8px;
}

.component {
  color: var(--primary-color);
  padding: calc(var(--spacing-unit) * 2);
  border-radius: var(--border-radius);
}
```

### Dynamic CSS Variables

```typescript
// components/ThemeCard.tsx
import styles from './themecard.module.css'

interface ThemeCardProps {
  accentColor: string
  children: React.ReactNode
}

export default function ThemeCard({ accentColor, children }: ThemeCardProps) {
  return (
    <div
      className={styles.card}
      style={{ '--accent-color': accentColor } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
```

```css
/* components/themecard.module.css */
.card {
  border-left: 4px solid var(--accent-color);
  padding: 20px;
  background: white;
}

.card:hover {
  box-shadow: 0 0 0 2px var(--accent-color);
}
```

## Performance Optimization

### Critical CSS

CSS Modules are automatically optimized by Next.js:

```typescript
// app/layout.tsx
import './globals.css' // Global styles loaded once

// Component styles are automatically code-split
// Each page only loads the CSS it needs
```

### Reducing Bundle Size

```css
/* Bad: Unused styles increase bundle size */
.unused1 { color: red; }
.unused2 { color: blue; }
.unused3 { color: green; }

/* Good: Only include styles you use */
.button {
  padding: 12px 24px;
}
```

### Avoiding Over-Specificity

```css
/* Bad: Too specific, hard to override */
div.container div.wrapper div.content p.text {
  color: black;
}

/* Good: Simple, reusable */
.contentText {
  color: black;
}
```

## Best Practices

### 1. Naming Conventions

Use BEM-like naming for clarity:

```css
/* components/productcard.module.css */
.productCard { }
.productCard__image { }
.productCard__title { }
.productCard__price { }
.productCard__button { }
.productCard--featured { }
.productCard--sale { }
```

### 2. File Organization

Colocate CSS with components:

```
components/
├── Button/
│   ├── Button.tsx
│   ├── button.module.css
│   └── index.ts
├── Card/
│   ├── Card.tsx
│   ├── card.module.css
│   └── index.ts
```

### 3. Shared Styles

Create reusable modules:

```css
/* styles/shared/spacing.module.css */
.mt1 { margin-top: 8px; }
.mt2 { margin-top: 16px; }
.mt3 { margin-top: 24px; }
.mt4 { margin-top: 32px; }

.mb1 { margin-bottom: 8px; }
.mb2 { margin-bottom: 16px; }
/* ... */
```

```typescript
import spacing from '@/styles/shared/spacing.module.css'
import styles from './component.module.css'

<div className={`${styles.container} ${spacing.mt3} ${spacing.mb2}`}>
```

### 4. Avoiding Globals

Minimize use of `:global()`:

```css
/* Bad: Too many globals */
:global(.app) :global(.header) :global(.nav) {
  /* ... */
}

/* Good: Scoped with minimal globals */
.navigation {
  /* ... */
}

.navigation :global(a) {
  /* Only global where necessary */
}
```

### 5. Documentation

Comment complex styles:

```css
/* components/layout.module.css */

/**
 * Main container using CSS Grid
 * - Header: Fixed at top
 * - Sidebar: Collapsible on mobile
 * - Main: Scrollable content area
 * - Footer: Sticky at bottom
 */
.layoutGrid {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 250px 1fr;
  min-height: 100vh;
}

.header {
  grid-area: header;
}

.sidebar {
  grid-area: sidebar;
}

.main {
  grid-area: main;
  overflow-y: auto;
}

.footer {
  grid-area: footer;
}
```

## Common Patterns

### Layout Components

```css
/* components/container.module.css */
.container {
  width: 100%;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 16px;
  padding-right: 16px;
}

@media (min-width: 768px) {
  .container {
    padding-left: 24px;
    padding-right: 24px;
  }
}

.containerFluid {
  width: 100%;
  padding-left: 16px;
  padding-right: 16px;
}
```

### Form Styling

```css
/* components/form.module.css */
.formGroup {
  margin-bottom: 20px;
}

.label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #374151;
}

.input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 16px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input:focus {
  outline: none;
  border-color: #0070f3;
  box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
}

.input:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.inputError {
  border-color: #ef4444;
}

.inputError:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.errorMessage {
  margin-top: 6px;
  font-size: 14px;
  color: #ef4444;
}
```

### Animation Classes

```css
/* components/animations.module.css */
.fadeIn {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.slideIn {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
```

## Troubleshooting

### Issue: Styles Not Applied

**Problem**: Classes not showing in browser

**Solutions**:
1. Check file extension is `.module.css`
2. Verify import path is correct
3. Ensure CSS file is saved
4. Clear Next.js cache: `rm -rf .next`

### Issue: Global Style Leaking

**Problem**: Styles affecting other components

**Solutions**:
1. Use `.module.css` extension
2. Avoid `:global()` unless necessary
3. Check for naming conflicts

### Issue: TypeScript Errors

**Problem**: Type errors on CSS imports

**Solutions**:
1. Add CSS module type declarations
2. Restart TypeScript server
3. Check `tsconfig.json` configuration

## Summary

CSS Modules in Next.js App Router provide:

- **Zero runtime overhead** - Perfect for Server Components
- **Automatic scoping** - No naming conflicts
- **TypeScript support** - Type-safe styling
- **Composition** - Reusable style patterns
- **Performance** - Automatic optimization by Next.js
- **Flexibility** - Works with all component types

They are the recommended choice for most Next.js applications, especially when performance and maintainability are priorities.
