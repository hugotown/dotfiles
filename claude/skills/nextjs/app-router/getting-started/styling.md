# Styling

Master different styling approaches in Next.js App Router including CSS Modules, Tailwind CSS, Global CSS, and CSS-in-JS.

## CSS Modules

CSS Modules automatically scope CSS to components, preventing naming conflicts.

### Basic CSS Module

```css
/* app/components/Button.module.css */
.button {
  background-color: blue;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
}

.button:hover {
  background-color: darkblue;
}

.primary {
  background-color: green;
}
```

```javascript
// app/components/Button.js
import styles from './Button.module.css'

export default function Button({ children, primary }) {
  return (
    <button className={primary ? styles.primary : styles.button}>
      {children}
    </button>
  )
}
```

### Multiple Classes

```javascript
import styles from './Card.module.css'

export default function Card({ title, featured }) {
  return (
    <div className={`${styles.card} ${featured ? styles.featured : ''}`}>
      <h2 className={styles.title}>{title}</h2>
    </div>
  )
}
```

### Using clsx for Class Composition

```javascript
import styles from './Card.module.css'
import clsx from 'clsx'

export default function Card({ title, featured, large }) {
  return (
    <div className={clsx(styles.card, {
      [styles.featured]: featured,
      [styles.large]: large,
    })}>
      <h2 className={styles.title}>{title}</h2>
    </div>
  )
}
```

## Global CSS

Import global styles in the root layout.

### Global Styles File

```css
/* app/globals.css */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
  line-height: 1.6;
  color: #333;
}

a {
  color: inherit;
  text-decoration: none;
}
```

```javascript
// app/layout.js
import './globals.css'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

### Organizing Global Styles

```css
/* app/globals.css */
@import './styles/reset.css';
@import './styles/typography.css';
@import './styles/utilities.css';

:root {
  --primary-color: #0070f3;
  --secondary-color: #7928ca;
  --text-color: #333;
  --background-color: #fff;
}

body {
  color: var(--text-color);
  background-color: var(--background-color);
}
```

## Tailwind CSS

Use utility-first CSS framework for rapid development.

### Installation

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Configuration

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0070f3',
        secondary: '#7928ca',
      },
    },
  },
  plugins: [],
}
```

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Using Tailwind

```javascript
// app/components/Card.js
export default function Card({ title, description }) {
  return (
    <div className="bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {title}
      </h2>
      <p className="text-gray-600">
        {description}
      </p>
    </div>
  )
}
```

### Custom Tailwind Components

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn-primary {
    @apply bg-blue-500 text-white font-bold py-2 px-4 rounded;
    @apply hover:bg-blue-700 transition-colors;
  }

  .card {
    @apply bg-white shadow-lg rounded-lg p-6;
  }
}
```

```javascript
export default function Button({ children }) {
  return <button className="btn-primary">{children}</button>
}
```

### Responsive Design

```javascript
export default function Hero() {
  return (
    <div className="px-4 py-8 md:px-8 md:py-16 lg:px-16 lg:py-24">
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">
        Welcome
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Content */}
      </div>
    </div>
  )
}
```

## CSS-in-JS

### Styled-JSX (Built-in)

Next.js includes styled-jsx by default:

```javascript
export default function Button({ children }) {
  return (
    <>
      <button className="button">
        {children}
      </button>

      <style jsx>{`
        .button {
          background-color: blue;
          color: white;
          padding: 10px 20px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
        }

        .button:hover {
          background-color: darkblue;
        }
      `}</style>
    </>
  )
}
```

### Global Styles with styled-jsx

```javascript
export default function Layout({ children }) {
  return (
    <>
      <div className="container">
        {children}
      </div>

      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          font-family: sans-serif;
        }
      `}</style>
    </>
  )
}
```

### Styled-Components

```bash
npm install styled-components
```

Create a registry for Server Components:

```javascript
// app/lib/registry.js
'use client'

import React, { useState } from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import { ServerStyleSheet, StyleSheetManager } from 'styled-components'

export default function StyledComponentsRegistry({ children }) {
  const [styledComponentsStyleSheet] = useState(() => new ServerStyleSheet())

  useServerInsertedHTML(() => {
    const styles = styledComponentsStyleSheet.getStyleElement()
    styledComponentsStyleSheet.instance.clearTag()
    return <>{styles}</>
  })

  if (typeof window !== 'undefined') return <>{children}</>

  return (
    <StyleSheetManager sheet={styledComponentsStyleSheet.instance}>
      {children}
    </StyleSheetManager>
  )
}

// app/layout.js
import StyledComponentsRegistry from './lib/registry'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
      </body>
    </html>
  )
}
```

Using styled-components:

```javascript
// app/components/Button.js
'use client'

import styled from 'styled-components'

const StyledButton = styled.button`
  background-color: ${props => props.primary ? 'blue' : 'gray'};
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  border: none;
  cursor: pointer;

  &:hover {
    background-color: ${props => props.primary ? 'darkblue' : 'darkgray'};
  }
`

export default function Button({ children, primary }) {
  return <StyledButton primary={primary}>{children}</StyledButton>
}
```

## Sass/SCSS

```bash
npm install -D sass
```

### SCSS Modules

```scss
// app/components/Card.module.scss
$primary-color: #0070f3;
$border-radius: 8px;

.card {
  background: white;
  border-radius: $border-radius;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &.featured {
    border: 2px solid $primary-color;
  }

  .title {
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }

  .description {
    color: #666;
  }
}
```

```javascript
// app/components/Card.js
import styles from './Card.module.scss'

export default function Card({ title, description, featured }) {
  return (
    <div className={featured ? `${styles.card} ${styles.featured}` : styles.card}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
    </div>
  )
}
```

### Global SCSS

```scss
// app/styles/globals.scss
@import './variables';
@import './mixins';

* {
  box-sizing: border-box;
}

body {
  @include font-stack;
  color: $text-color;
  background: $background-color;
}
```

## CSS Variables

Define and use CSS custom properties:

```css
/* app/globals.css */
:root {
  --color-primary: #0070f3;
  --color-secondary: #7928ca;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 2rem;
  --border-radius: 8px;
}

[data-theme='dark'] {
  --color-primary: #3291ff;
  --text-color: #fff;
  --background-color: #000;
}
```

```javascript
// app/components/Card.module.css
.card {
  background: white;
  border-radius: var(--border-radius);
  padding: var(--spacing-md);
}

.button {
  background: var(--color-primary);
  padding: var(--spacing-sm) var(--spacing-md);
}
```

## Font Optimization

### Using next/font with Google Fonts

```javascript
// app/layout.js
import { Inter, Roboto_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

### Local Fonts

```javascript
// app/layout.js
import localFont from 'next/font/local'

const myFont = localFont({
  src: './fonts/my-font.woff2',
  display: 'swap',
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={myFont.className}>
      <body>{children}</body>
    </html>
  )
}
```

## Responsive Design

### Media Queries in CSS Modules

```css
/* app/components/Hero.module.css */
.hero {
  padding: 2rem;
}

.title {
  font-size: 2rem;
}

@media (min-width: 768px) {
  .hero {
    padding: 4rem;
  }

  .title {
    font-size: 3rem;
  }
}

@media (min-width: 1024px) {
  .hero {
    padding: 6rem;
  }

  .title {
    font-size: 4rem;
  }
}
```

### Container Queries

```css
/* app/components/Card.module.css */
.container {
  container-type: inline-size;
}

.card {
  padding: 1rem;
}

@container (min-width: 400px) {
  .card {
    padding: 2rem;
    display: grid;
    grid-template-columns: 1fr 2fr;
  }
}
```

## Dark Mode

### CSS Variables Approach

```javascript
// app/components/ThemeProvider.js
'use client'

import { useEffect, useState } from 'react'

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  return (
    <>
      <button onClick={toggleTheme}>
        Toggle {theme === 'light' ? 'Dark' : 'Light'} Mode
      </button>
      {children}
    </>
  )
}
```

```css
/* app/globals.css */
:root {
  --background: white;
  --text: black;
}

[data-theme='dark'] {
  --background: black;
  --text: white;
}

body {
  background: var(--background);
  color: var(--text);
}
```

### Tailwind Dark Mode

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  // ...
}
```

```javascript
export default function Card() {
  return (
    <div className="bg-white dark:bg-gray-800 text-black dark:text-white">
      <h2 className="text-2xl font-bold">Card Title</h2>
    </div>
  )
}
```

## Best Practices

1. **Use CSS Modules for component styles** - Automatic scoping prevents conflicts
2. **Use Tailwind for rapid prototyping** - Fast development with utilities
3. **Minimize global CSS** - Prefer scoped styles
4. **Use CSS variables for theming** - Easy theme switching
5. **Optimize fonts** - Use next/font for automatic optimization
6. **Implement responsive design** - Mobile-first approach
7. **Consider performance** - Minimize CSS bundle size
8. **Use semantic class names** - Descriptive, meaningful names

## Common Pitfalls

1. **Importing CSS in Client Components** - Import in Server Components or layout
2. **Not using CSS Modules** - Global namespace pollution
3. **Inline styles everywhere** - Harder to maintain, no caching
4. **Not optimizing fonts** - Missing next/font benefits
5. **Over-using global CSS** - Specificity issues
6. **Forgetting responsive design** - Mobile experience suffers
7. **Not using CSS variables** - Harder to theme
8. **Large CSS bundles** - Importing unused styles

## Styling Checklist

- [ ] Choose styling approach (CSS Modules, Tailwind, CSS-in-JS)
- [ ] Import global styles in root layout
- [ ] Set up font optimization with next/font
- [ ] Implement responsive design
- [ ] Configure dark mode if needed
- [ ] Use CSS variables for theming
- [ ] Minimize global CSS
- [ ] Test styles across browsers
- [ ] Optimize CSS bundle size
- [ ] Use semantic class names
