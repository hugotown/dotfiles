# Styling Patterns in Next.js App Router

This guide covers advanced styling patterns, best practices, and common solutions for styling challenges in Next.js applications.

## Responsive Design Patterns

### Mobile-First Approach

```css
/* components/grid.module.css */
.grid {
  /* Mobile: single column */
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 16px;
}

/* Tablet: 2 columns */
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
    padding: 24px;
  }
}

/* Desktop: 3 columns */
@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
    padding: 32px;
  }
}

/* Large Desktop: 4 columns */
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

.card {
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.cardImage {
  width: 100%;
  aspect-ratio: 16/9;
}

/* When container is >= 400px */
@container card (min-width: 400px) {
  .card {
    flex-direction: row;
    gap: 20px;
  }

  .cardImage {
    width: 200px;
    aspect-ratio: 1;
  }
}

/* When container is >= 600px */
@container card (min-width: 600px) {
  .card {
    padding: 24px;
  }

  .cardImage {
    width: 250px;
  }
}
```

### Fluid Typography

```css
/* app/globals.css */
:root {
  /* Fluid font sizes: min 16px at 320px viewport, max 20px at 1200px viewport */
  --font-size-base: clamp(1rem, 0.9091rem + 0.4545vw, 1.25rem);
  --font-size-lg: clamp(1.125rem, 1.0227rem + 0.5114vw, 1.4063rem);
  --font-size-xl: clamp(1.2656rem, 1.1505rem + 0.5756vw, 1.5819rem);
  --font-size-2xl: clamp(1.4238rem, 1.294rem + 0.6488vw, 1.7798rem);
  --font-size-3xl: clamp(1.6018rem, 1.4557rem + 0.7303vw, 2.0023rem);
}

body {
  font-size: var(--font-size-base);
}

h1 { font-size: var(--font-size-3xl); }
h2 { font-size: var(--font-size-2xl); }
h3 { font-size: var(--font-size-xl); }
h4 { font-size: var(--font-size-lg); }
```

### Responsive Spacing

```css
/* components/section.module.css */
.section {
  /* Fluid padding */
  padding-block: clamp(2rem, 5vw, 5rem);
  padding-inline: clamp(1rem, 5vw, 3rem);
}

.container {
  /* Responsive max-width with fluid padding */
  max-width: min(1200px, 100% - 2rem);
  margin-inline: auto;
}
```

## Theming Patterns

### CSS Variables Theme

```css
/* app/globals.css */
:root {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #666666;
  --color-border: #e0e0e0;
  --color-primary: #0070f3;
  --color-primary-hover: #0051cc;
}

[data-theme='dark'] {
  --color-bg-primary: #1a1a1a;
  --color-bg-secondary: #2a2a2a;
  --color-text-primary: #ffffff;
  --color-text-secondary: #cccccc;
  --color-border: #404040;
  --color-primary: #1a8fff;
  --color-primary-hover: #4da3ff;
}

body {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
}
```

### Theme Toggle Component

```typescript
// components/ThemeToggle.tsx
'use client'

import { useEffect, useState } from 'react'
import styles from './themetoggle.module.css'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // Check localStorage and system preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light')
    setTheme(initialTheme)
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return (
    <button
      onClick={toggleTheme}
      className={styles.toggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}
```

### Multi-Theme Support

```css
/* app/globals.css */
:root {
  /* Default theme variables */
}

[data-theme='dark'] {
  /* Dark theme */
}

[data-theme='high-contrast'] {
  --color-bg-primary: #000000;
  --color-bg-secondary: #1a1a1a;
  --color-text-primary: #ffffff;
  --color-border: #ffffff;
  --color-primary: #ffff00;
}

[data-theme='solarized'] {
  --color-bg-primary: #002b36;
  --color-bg-secondary: #073642;
  --color-text-primary: #839496;
  --color-primary: #268bd2;
}
```

## Animation Patterns

### Entrance Animations

```css
/* components/animations.module.css */
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
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.fadeIn {
  animation: fadeIn 0.5s ease-out;
}

.slideUp {
  animation: slideUp 0.5s ease-out;
}

.scaleIn {
  animation: scaleIn 0.3s ease-out;
}

/* Stagger children animations */
.staggerContainer > * {
  opacity: 0;
  animation: slideUp 0.5s ease-out forwards;
}

.staggerContainer > *:nth-child(1) { animation-delay: 0.1s; }
.staggerContainer > *:nth-child(2) { animation-delay: 0.2s; }
.staggerContainer > *:nth-child(3) { animation-delay: 0.3s; }
.staggerContainer > *:nth-child(4) { animation-delay: 0.4s; }
.staggerContainer > *:nth-child(5) { animation-delay: 0.5s; }
```

### Hover Effects

```css
/* components/card.module.css */
.card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  cursor: pointer;
}

.card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

/* Lift effect */
.liftCard {
  position: relative;
  transition: all 0.3s ease;
}

.liftCard::before {
  content: '';
  position: absolute;
  inset: 0;
  background: inherit;
  border-radius: inherit;
  transition: transform 0.3s ease;
  z-index: -1;
}

.liftCard:hover::before {
  transform: scale(1.05);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

/* Glow effect */
.glowButton {
  position: relative;
  overflow: hidden;
}

.glowButton::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.glowButton:hover::after {
  width: 300px;
  height: 300px;
}
```

### Loading States

```css
/* components/loading.module.css */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
  border-radius: 4px;
}

.pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #0070f3;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
```

### Page Transitions

```typescript
// components/PageTransition.tsx
'use client'

import { motion } from 'framer-motion'

const variants = {
  hidden: { opacity: 0, y: 20 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

export default function PageTransition({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial="hidden"
      animate="enter"
      exit="exit"
      variants={variants}
      transition={{ duration: 0.3, type: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}
```

## Layout Patterns

### Holy Grail Layout

```css
/* components/layout.module.css */
.layout {
  display: grid;
  grid-template-areas:
    "header header header"
    "nav main aside"
    "footer footer footer";
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 200px 1fr 200px;
  min-height: 100vh;
  gap: 20px;
}

.header {
  grid-area: header;
  background: var(--color-bg-secondary);
  padding: 20px;
}

.nav {
  grid-area: nav;
  background: var(--color-bg-secondary);
  padding: 20px;
}

.main {
  grid-area: main;
  padding: 20px;
}

.aside {
  grid-area: aside;
  background: var(--color-bg-secondary);
  padding: 20px;
}

.footer {
  grid-area: footer;
  background: var(--color-bg-secondary);
  padding: 20px;
}

/* Responsive */
@media (max-width: 1024px) {
  .layout {
    grid-template-areas:
      "header header"
      "nav main"
      "footer footer";
    grid-template-columns: 200px 1fr;
  }

  .aside {
    display: none;
  }
}

@media (max-width: 768px) {
  .layout {
    grid-template-areas:
      "header"
      "main"
      "nav"
      "footer";
    grid-template-columns: 1fr;
  }
}
```

### Sidebar Layout

```css
/* components/sidebar-layout.module.css */
.container {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 280px;
  background: var(--color-bg-secondary);
  padding: 24px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  transition: transform 0.3s ease;
}

.main {
  flex: 1;
  padding: 24px;
  max-width: 1200px;
}

/* Mobile: Slide-out sidebar */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 1000;
    transform: translateX(-100%);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .overlay.visible {
    opacity: 1;
    pointer-events: auto;
  }
}
```

### Masonry Layout

```css
/* components/masonry.module.css */
.masonry {
  column-count: 1;
  column-gap: 20px;
}

.masonryItem {
  break-inside: avoid;
  margin-bottom: 20px;
}

@media (min-width: 640px) {
  .masonry {
    column-count: 2;
  }
}

@media (min-width: 1024px) {
  .masonry {
    column-count: 3;
  }
}

@media (min-width: 1280px) {
  .masonry {
    column-count: 4;
  }
}
```

## Conditional Styling Patterns

### Data Attributes

```typescript
// components/StatusBadge.tsx
interface StatusBadgeProps {
  status: 'success' | 'error' | 'warning' | 'info'
  children: React.ReactNode
}

export default function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span data-status={status} className={styles.badge}>
      {children}
    </span>
  )
}
```

```css
/* components/statusbadge.module.css */
.badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
}

.badge[data-status='success'] {
  background: #d1fae5;
  color: #065f46;
}

.badge[data-status='error'] {
  background: #fee2e2;
  color: #991b1b;
}

.badge[data-status='warning'] {
  background: #fef3c7;
  color: #92400e;
}

.badge[data-status='info'] {
  background: #dbeafe;
  color: #1e40af;
}
```

### CSS Modules with Compose

```css
/* components/buttons.module.css */
.buttonBase {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.primary {
  composes: buttonBase;
  background-color: #0070f3;
  color: white;
}

.primary:hover {
  background-color: #0051cc;
}

.secondary {
  composes: buttonBase;
  background-color: #eaeaea;
  color: #000;
}

.large {
  composes: buttonBase;
  padding: 16px 32px;
  font-size: 18px;
}

.small {
  composes: buttonBase;
  padding: 8px 16px;
  font-size: 14px;
}
```

### Tailwind Variants with CVA

```typescript
// components/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority'

const button = cva('font-semibold rounded-lg transition-colors', {
  variants: {
    intent: {
      primary: 'bg-blue-500 text-white hover:bg-blue-600',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
      danger: 'bg-red-500 text-white hover:bg-red-600',
    },
    size: {
      small: 'text-sm px-3 py-1.5',
      medium: 'text-base px-4 py-2',
      large: 'text-lg px-6 py-3',
    },
    fullWidth: {
      true: 'w-full',
    },
  },
  compoundVariants: [
    {
      intent: 'primary',
      size: 'large',
      class: 'uppercase tracking-wider',
    },
  ],
  defaultVariants: {
    intent: 'primary',
    size: 'medium',
  },
})

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export default function Button({ intent, size, fullWidth, className, ...props }: ButtonProps) {
  return <button className={button({ intent, size, fullWidth, className })} {...props} />
}
```

## Form Styling Patterns

### Accessible Form Inputs

```css
/* components/input.module.css */
.formGroup {
  margin-bottom: 24px;
}

.label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-size: 14px;
}

.required::after {
  content: ' *';
  color: #ef4444;
}

.input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  font-size: 16px;
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
}

.input:disabled {
  background-color: var(--color-bg-secondary);
  cursor: not-allowed;
  opacity: 0.6;
}

.input.error {
  border-color: #ef4444;
}

.input.error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.helperText {
  margin-top: 6px;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.errorMessage {
  margin-top: 6px;
  font-size: 14px;
  color: #ef4444;
}
```

### Custom Checkbox/Radio

```css
/* components/checkbox.module.css */
.checkboxWrapper {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.checkbox {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.checkboxCustom {
  position: relative;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  margin-right: 12px;
  transition: all 0.2s;
}

.checkbox:checked + .checkboxCustom {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.checkbox:checked + .checkboxCustom::after {
  content: '';
  position: absolute;
  left: 6px;
  top: 2px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox:focus + .checkboxCustom {
  box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
}

.checkbox:disabled + .checkboxCustom {
  opacity: 0.5;
  cursor: not-allowed;
}
```

## Accessibility Patterns

### Focus Indicators

```css
/* app/globals.css */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none;
}

/* Skip to main content */
.skipToMain {
  position: absolute;
  left: -9999px;
  z-index: 999;
  padding: 16px;
  background-color: var(--color-primary);
  color: white;
  text-decoration: none;
  border-radius: 8px;
}

.skipToMain:focus {
  left: 50%;
  top: 20px;
  transform: translateX(-50%);
}

/* Screen reader only */
.srOnly {
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

## Performance Patterns

### Critical CSS

```css
/* app/globals.css - Keep minimal */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, sans-serif;
  line-height: 1.6;
}

/* Move everything else to component modules */
```

### Font Loading

```typescript
// app/layout.tsx
import { Inter, Roboto_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto-mono',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

```css
/* app/globals.css */
body {
  font-family: var(--font-inter), sans-serif;
}

code {
  font-family: var(--font-roboto-mono), monospace;
}
```

### Image Optimization

```typescript
// components/OptimizedImage.tsx
import Image from 'next/image'
import styles from './optimizedimage.module.css'

export default function OptimizedImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className={styles.imageContainer}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className={styles.image}
      />
    </div>
  )
}
```

```css
/* components/optimizedimage.module.css */
.imageContainer {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 8px;
}

.image {
  object-fit: cover;
}
```

## Summary

Key styling patterns for Next.js App Router:

1. **Responsive Design**: Mobile-first, container queries, fluid typography
2. **Theming**: CSS variables, theme toggles, multi-theme support
3. **Animations**: Entrance effects, loading states, page transitions
4. **Layouts**: Grid patterns, flexbox, responsive containers
5. **Conditional Styles**: Data attributes, variants, compose
6. **Forms**: Accessible inputs, custom controls, validation
7. **Accessibility**: Focus indicators, reduced motion, screen readers
8. **Performance**: Critical CSS, font loading, image optimization

Choose patterns based on your project requirements and team preferences, always prioritizing user experience and accessibility.
