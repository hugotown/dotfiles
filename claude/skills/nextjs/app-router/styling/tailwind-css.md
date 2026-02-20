# Tailwind CSS in Next.js App Router

Tailwind CSS is a utility-first CSS framework that provides low-level utility classes to build custom designs without leaving your HTML/JSX.

## Overview

Tailwind CSS works perfectly with Next.js App Router, offering excellent performance through automatic purging of unused styles and zero runtime overhead.

## Installation and Setup

### Installing Tailwind CSS

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

This creates:
- `tailwind.config.js` - Tailwind configuration
- `postcss.config.js` - PostCSS configuration

### Configuring Tailwind

Update `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',

    // Or if using `src` directory:
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### Adding Tailwind Directives

Create or update `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Import in root layout:

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

## Basic Usage

### Utility Classes

```typescript
// components/Button.tsx
export default function Button({ children }: { children: React.ReactNode }) {
  return (
    <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
      {children}
    </button>
  )
}
```

### Responsive Design

Tailwind uses mobile-first breakpoints:

```typescript
export default function Card() {
  return (
    <div className="
      w-full
      sm:w-1/2
      md:w-1/3
      lg:w-1/4
      xl:w-1/5
      p-4
    ">
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold">
          Responsive Card
        </h2>
      </div>
    </div>
  )
}
```

### State Variants

```typescript
export default function Input() {
  return (
    <input
      type="text"
      className="
        border border-gray-300
        rounded-md
        px-4 py-2
        focus:outline-none
        focus:ring-2
        focus:ring-blue-500
        focus:border-transparent
        disabled:bg-gray-100
        disabled:cursor-not-allowed
        hover:border-gray-400
      "
    />
  )
}
```

## Theme Customization

### Extending the Theme

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        secondary: '#7c3aed',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-roboto-mono)', 'monospace'],
      },
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
```

Usage:

```typescript
<div className="bg-primary-500 text-white font-sans p-128 rounded-4xl animate-fade-in">
  Custom themed content
</div>
```

### Custom Screens (Breakpoints)

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
      '3xl': '1920px',
    },
  },
}
```

## Dark Mode

### Class-Based Dark Mode

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  // ...
}
```

```typescript
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        {children}
      </body>
    </html>
  )
}
```

### Dark Mode Toggle

```typescript
// components/ThemeToggle.tsx
'use client'

import { useState, useEffect } from 'react'

export default function ThemeToggle() {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true'
    setDarkMode(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    localStorage.setItem('darkMode', String(newMode))
    document.documentElement.classList.toggle('dark', newMode)
  }

  return (
    <button
      onClick={toggleDarkMode}
      className="
        p-2
        rounded-lg
        bg-gray-200
        dark:bg-gray-800
        text-gray-800
        dark:text-gray-200
        hover:bg-gray-300
        dark:hover:bg-gray-700
        transition-colors
      "
    >
      {darkMode ? '🌙' : '☀️'}
    </button>
  )
}
```

### Dark Mode Styles

```typescript
<div className="
  bg-white dark:bg-gray-800
  text-gray-900 dark:text-white
  border border-gray-200 dark:border-gray-700
">
  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
    Dark Mode Title
  </h1>
  <p className="text-gray-600 dark:text-gray-300">
    This text adapts to dark mode
  </p>
</div>
```

## Popular Tailwind Plugins

### Forms Plugin

```bash
npm install -D @tailwindcss/forms
```

```javascript
// tailwind.config.js
module.exports = {
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
```

Usage:

```typescript
<input
  type="email"
  className="
    form-input
    rounded-md
    border-gray-300
    focus:border-blue-500
    focus:ring-blue-500
  "
/>
```

### Typography Plugin

```bash
npm install -D @tailwindcss/typography
```

```javascript
// tailwind.config.js
module.exports = {
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
```

Usage:

```typescript
<article className="prose lg:prose-xl dark:prose-invert">
  <h1>Blog Post Title</h1>
  <p>Automatically styled content...</p>
</article>
```

### Container Queries Plugin

```bash
npm install -D @tailwindcss/container-queries
```

```javascript
// tailwind.config.js
module.exports = {
  plugins: [
    require('@tailwindcss/container-queries'),
  ],
}
```

Usage:

```typescript
<div className="@container">
  <div className="@lg:grid-cols-2 grid grid-cols-1">
    <div>Card 1</div>
    <div>Card 2</div>
  </div>
</div>
```

### Aspect Ratio Plugin

```bash
npm install -D @tailwindcss/aspect-ratio
```

```javascript
// tailwind.config.js
module.exports = {
  plugins: [
    require('@tailwindcss/aspect-ratio'),
  ],
}
```

Usage:

```typescript
<div className="aspect-w-16 aspect-h-9">
  <iframe src="https://www.youtube.com/embed/..." />
</div>
```

## Advanced Patterns

### Component Extraction with @apply

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn-primary {
    @apply bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded;
  }

  .btn-secondary {
    @apply bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded;
  }

  .card {
    @apply bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow;
  }
}
```

Usage:

```typescript
<button className="btn-primary">Click me</button>
<div className="card">Card content</div>
```

### Custom Utilities

```css
/* app/globals.css */
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }

  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  .gradient-text {
    @apply bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent;
  }
}
```

### Arbitrary Values

```typescript
// Use any CSS value on the fly
<div className="
  top-[117px]
  w-[762px]
  bg-[#1da1f2]
  text-[14px]
  before:content-['Hello']
">
  Custom values
</div>
```

### Dynamic Class Names

```typescript
// components/Alert.tsx
interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info'
  children: React.ReactNode
}

const alertStyles = {
  success: 'bg-green-100 border-green-500 text-green-700',
  error: 'bg-red-100 border-red-500 text-red-700',
  warning: 'bg-yellow-100 border-yellow-500 text-yellow-700',
  info: 'bg-blue-100 border-blue-500 text-blue-700',
}

export default function Alert({ type, children }: AlertProps) {
  return (
    <div className={`border-l-4 p-4 ${alertStyles[type]}`}>
      {children}
    </div>
  )
}
```

### Class Variance Authority (CVA)

```bash
npm install class-variance-authority
```

```typescript
// components/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2',
  {
    variants: {
      variant: {
        primary: 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500',
        secondary: 'bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-500',
        outline: 'border-2 border-blue-500 text-blue-500 hover:bg-blue-50',
        ghost: 'text-blue-500 hover:bg-blue-50',
      },
      size: {
        sm: 'text-sm px-3 py-1.5',
        md: 'text-base px-4 py-2',
        lg: 'text-lg px-6 py-3',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export default function Button({
  variant,
  size,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  )
}

// Usage
<Button variant="primary" size="lg">Click me</Button>
<Button variant="outline" size="sm">Small outline</Button>
```

## Tailwind with TypeScript

### Type-Safe Class Names

```bash
npm install -D tailwind-merge clsx
```

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage
import { cn } from '@/lib/utils'

<div className={cn(
  'bg-white p-4',
  isActive && 'bg-blue-500',
  isDisabled && 'opacity-50 cursor-not-allowed'
)}>
```

### Tailwind IntelliSense

Install the VS Code extension:
- **Name**: Tailwind CSS IntelliSense
- **Features**: Autocomplete, linting, hover previews

Settings for better IntelliSense:

```json
// .vscode/settings.json
{
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "editor.quickSuggestions": {
    "strings": true
  }
}
```

## Performance Optimization

### PurgeCSS (Automatic)

Next.js automatically purges unused Tailwind classes in production based on your `content` configuration:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // Tailwind will only include classes found in these files
}
```

### Safelist Important Classes

```javascript
// tailwind.config.js
module.exports = {
  safelist: [
    'bg-red-500',
    'bg-green-500',
    'bg-blue-500',
    {
      pattern: /bg-(red|green|blue)-(100|500|900)/,
    },
  ],
}
```

### JIT Mode (Default)

Tailwind uses Just-In-Time mode by default, generating styles on-demand:

- Faster build times
- Smaller CSS files
- All variants enabled by default

## Common Patterns

### Responsive Grid Layout

```typescript
export default function ProductGrid() {
  return (
    <div className="
      grid
      grid-cols-1
      sm:grid-cols-2
      md:grid-cols-3
      lg:grid-cols-4
      gap-4
      md:gap-6
      lg:gap-8
      p-4
    ">
      {products.map(product => (
        <div key={product.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
          {/* Product card content */}
        </div>
      ))}
    </div>
  )
}
```

### Flexbox Layouts

```typescript
// Center content
<div className="flex items-center justify-center min-h-screen">
  <div>Centered content</div>
</div>

// Navigation bar
<nav className="flex items-center justify-between p-4 bg-white shadow">
  <div className="flex items-center gap-4">
    <Logo />
    <NavLinks />
  </div>
  <UserMenu />
</nav>

// Card with flex
<div className="flex flex-col gap-4 p-6 bg-white rounded-lg">
  <h2 className="text-xl font-bold">Title</h2>
  <p className="flex-grow text-gray-600">Description</p>
  <button className="self-end px-4 py-2 bg-blue-500 text-white rounded">
    Action
  </button>
</div>
```

### Form Styling

```typescript
export default function ContactForm() {
  return (
    <form className="max-w-md mx-auto space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          className="
            w-full
            px-3
            py-2
            border
            border-gray-300
            rounded-md
            focus:outline-none
            focus:ring-2
            focus:ring-blue-500
            focus:border-transparent
          "
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Message
        </label>
        <textarea
          rows={4}
          className="
            w-full
            px-3
            py-2
            border
            border-gray-300
            rounded-md
            focus:outline-none
            focus:ring-2
            focus:ring-blue-500
          "
        />
      </div>

      <button
        type="submit"
        className="
          w-full
          bg-blue-500
          hover:bg-blue-600
          text-white
          font-medium
          py-2
          px-4
          rounded-md
          transition-colors
        "
      >
        Submit
      </button>
    </form>
  )
}
```

### Animations and Transitions

```typescript
// Hover effects
<div className="
  transform
  transition-all
  duration-300
  hover:scale-105
  hover:shadow-xl
">
  Hover me
</div>

// Loading spinner
<div className="
  animate-spin
  rounded-full
  h-12
  w-12
  border-b-2
  border-blue-500
" />

// Fade in on load
<div className="animate-fade-in">
  Content
</div>
```

## Best Practices

### 1. Use Consistent Spacing

```typescript
// Good: Use Tailwind's spacing scale
<div className="p-4 mb-6 gap-2">

// Avoid: Arbitrary values for common spacing
<div className="p-[15px] mb-[23px]">
```

### 2. Group Related Classes

```typescript
// Good: Logical grouping
<div className="
  flex items-center justify-between
  p-4 mb-6
  bg-white dark:bg-gray-800
  rounded-lg shadow-md
  hover:shadow-lg
  transition-shadow
">

// Avoid: Random order
<div className="shadow-md hover:shadow-lg bg-white flex mb-6 rounded-lg items-center p-4">
```

### 3. Extract Repeated Patterns

```typescript
// components/Card.tsx
export default function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      {children}
    </div>
  )
}
```

### 4. Use Semantic Class Names for Complex Components

```css
@layer components {
  .pricing-card {
    @apply bg-white rounded-lg shadow-lg p-8 border border-gray-200;
  }

  .pricing-card-featured {
    @apply pricing-card border-blue-500 border-2 scale-105;
  }
}
```

### 5. Leverage Tailwind Config for Brand Consistency

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0070f3',
          secondary: '#7928ca',
        },
      },
    },
  },
}
```

## Troubleshooting

### Styles Not Applied

1. Check `content` paths in `tailwind.config.js`
2. Ensure `globals.css` is imported in root layout
3. Clear `.next` cache: `rm -rf .next`
4. Verify Tailwind directives in CSS file

### IntelliSense Not Working

1. Install Tailwind CSS IntelliSense extension
2. Reload VS Code window
3. Check `tailwind.config.js` is in root directory

### Dark Mode Not Working

1. Verify `darkMode: 'class'` in config
2. Check `dark` class on `<html>` element
3. Ensure dark mode variants are used correctly

## Summary

Tailwind CSS in Next.js App Router provides:

- **Utility-first approach** - Rapid development
- **Zero runtime** - Optimal performance
- **Automatic purging** - Minimal CSS bundle
- **Dark mode** - Built-in support
- **TypeScript friendly** - Type-safe with proper tools
- **Responsive** - Mobile-first breakpoints
- **Customizable** - Extensive theming options
- **Plugin ecosystem** - Rich community plugins

Tailwind is ideal for teams that value consistency, speed, and maintainability in their styling workflow.
