# CSS-in-JS in Next.js App Router

CSS-in-JS libraries allow you to write CSS directly in JavaScript/TypeScript, providing dynamic styling capabilities, component-scoped styles, and runtime theming.

## Overview

CSS-in-JS solutions work differently in Next.js App Router due to Server Components. Most CSS-in-JS libraries require client-side rendering and the `'use client'` directive.

## Important Considerations for App Router

### Server vs Client Components

- **Server Components**: Cannot use runtime CSS-in-JS
- **Client Components**: Full CSS-in-JS support with `'use client'`
- **Recommendation**: Use CSS Modules or Tailwind for Server Components

### Performance Impact

CSS-in-JS libraries have runtime overhead:
- JavaScript bundle size increases
- Runtime style injection
- Server/Client boundary considerations

## Styled Components

### Installation

```bash
npm install styled-components
npm install -D @types/styled-components
```

### Setup with App Router

Create a styled-components registry:

```typescript
// lib/registry.tsx
'use client'

import React, { useState } from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import { ServerStyleSheet, StyleSheetManager } from 'styled-components'

export default function StyledComponentsRegistry({
  children,
}: {
  children: React.ReactNode
}) {
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
```

Add to root layout:

```typescript
// app/layout.tsx
import StyledComponentsRegistry from '@/lib/registry'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
      </body>
    </html>
  )
}
```

### Basic Usage

```typescript
// components/Button.tsx
'use client'

import styled from 'styled-components'

const StyledButton = styled.button<{ $primary?: boolean }>`
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  background-color: ${props => props.$primary ? '#0070f3' : '#eaeaea'};
  color: ${props => props.$primary ? 'white' : '#000'};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

interface ButtonProps {
  primary?: boolean
  children: React.ReactNode
  onClick?: () => void
}

export default function Button({ primary, children, onClick }: ButtonProps) {
  return (
    <StyledButton $primary={primary} onClick={onClick}>
      {children}
    </StyledButton>
  )
}
```

### Theming

```typescript
// lib/theme.ts
export const lightTheme = {
  colors: {
    primary: '#0070f3',
    secondary: '#7928ca',
    background: '#ffffff',
    text: '#1a1a1a',
    border: '#e0e0e0',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
}

export const darkTheme = {
  colors: {
    primary: '#1a8fff',
    secondary: '#9d5cff',
    background: '#1a1a1a',
    text: '#ffffff',
    border: '#404040',
  },
  spacing: lightTheme.spacing,
  borderRadius: lightTheme.borderRadius,
}

export type Theme = typeof lightTheme
```

```typescript
// components/ThemeProvider.tsx
'use client'

import { ThemeProvider as StyledThemeProvider } from 'styled-components'
import { lightTheme, darkTheme } from '@/lib/theme'
import { useState, useEffect } from 'react'

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    setIsDark(saved === 'dark')
  }, [])

  return (
    <StyledThemeProvider theme={isDark ? darkTheme : lightTheme}>
      {children}
    </StyledThemeProvider>
  )
}
```

```typescript
// components/Card.tsx
'use client'

import styled from 'styled-components'

const StyledCard = styled.div`
  background-color: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.md};
  padding: ${props => props.theme.spacing.lg};
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`

export default function Card({ children }: { children: React.ReactNode }) {
  return <StyledCard>{children}</StyledCard>
}
```

### Advanced Patterns

```typescript
// components/styles.ts
'use client'

import styled, { css } from 'styled-components'

// Shared styles
const buttonBase = css`
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
`

// Variant styles
const buttonVariants = {
  primary: css`
    background-color: ${props => props.theme.colors.primary};
    color: white;
  `,
  secondary: css`
    background-color: ${props => props.theme.colors.secondary};
    color: white;
  `,
  outline: css`
    background-color: transparent;
    border: 2px solid ${props => props.theme.colors.primary};
    color: ${props => props.theme.colors.primary};
  `,
}

// Size styles
const buttonSizes = {
  sm: css`
    padding: 8px 16px;
    font-size: 14px;
  `,
  md: css`
    padding: 12px 24px;
    font-size: 16px;
  `,
  lg: css`
    padding: 16px 32px;
    font-size: 18px;
  `,
}

export const Button = styled.button<{
  $variant?: keyof typeof buttonVariants
  $size?: keyof typeof buttonSizes
}>`
  ${buttonBase}
  ${props => buttonVariants[props.$variant || 'primary']}
  ${props => buttonSizes[props.$size || 'md']}

  &:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`
```

## Emotion

### Installation

```bash
npm install @emotion/react @emotion/styled
npm install -D @emotion/cache
```

### Setup

```typescript
// lib/emotion-cache.tsx
'use client'

import { useState } from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'

export default function EmotionCacheProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [cache] = useState(() => {
    const cache = createCache({ key: 'css' })
    cache.compat = true
    return cache
  })

  useServerInsertedHTML(() => {
    return (
      <style
        data-emotion={`${cache.key} ${Object.keys(cache.inserted).join(' ')}`}
        dangerouslySetInnerHTML={{
          __html: Object.values(cache.inserted).join(' '),
        }}
      />
    )
  })

  return <CacheProvider value={cache}>{children}</CacheProvider>
}
```

### Basic Usage

```typescript
// components/Button.tsx
'use client'

import styled from '@emotion/styled'
import { css } from '@emotion/react'

const StyledButton = styled.button<{ primary?: boolean }>`
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  ${props => props.primary
    ? css`
        background-color: #0070f3;
        color: white;
      `
    : css`
        background-color: #eaeaea;
        color: #000;
      `
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`

export default function Button({
  primary,
  children,
}: {
  primary?: boolean
  children: React.ReactNode
}) {
  return <StyledButton primary={primary}>{children}</StyledButton>
}
```

### CSS Prop

```typescript
// components/Card.tsx
'use client'

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

export default function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      css={css`
        background: white;
        border-radius: 8px;
        padding: 24px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

        &:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      `}
    >
      {children}
    </div>
  )
}
```

## Panda CSS

Panda CSS is a modern CSS-in-JS library with zero runtime and build-time style generation.

### Installation

```bash
npm install -D @pandacss/dev
npx panda init
```

### Configuration

```typescript
// panda.config.ts
import { defineConfig } from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  include: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  exclude: [],
  theme: {
    extend: {
      tokens: {
        colors: {
          primary: { value: '#0070f3' },
          secondary: { value: '#7928ca' },
        },
        spacing: {
          sm: { value: '8px' },
          md: { value: '16px' },
          lg: { value: '24px' },
        },
      },
    },
  },
  outdir: 'styled-system',
})
```

### Basic Usage

```typescript
// components/Button.tsx
import { css } from '@/styled-system/css'

interface ButtonProps {
  variant?: 'primary' | 'secondary'
  children: React.ReactNode
}

export default function Button({ variant = 'primary', children }: ButtonProps) {
  return (
    <button
      className={css({
        padding: '12px 24px',
        borderRadius: 'md',
        fontWeight: 'semibold',
        cursor: 'pointer',
        transition: 'all 0.2s',
        bg: variant === 'primary' ? 'primary' : 'secondary',
        color: 'white',
        _hover: {
          transform: 'translateY(-2px)',
          shadow: 'md',
        },
      })}
    >
      {children}
    </button>
  )
}
```

### Patterns

```typescript
// components/Card.tsx
import { css, cva } from '@/styled-system/css'

const cardStyles = cva({
  base: {
    bg: 'white',
    borderRadius: 'lg',
    padding: 'lg',
    shadow: 'md',
  },
  variants: {
    variant: {
      default: {
        border: '1px solid',
        borderColor: 'gray.200',
      },
      elevated: {
        shadow: 'xl',
      },
    },
  },
})

export default function Card({
  variant = 'default',
  children,
}: {
  variant?: 'default' | 'elevated'
  children: React.ReactNode
}) {
  return <div className={cardStyles({ variant })}>{children}</div>
}
```

## Vanilla Extract

Vanilla Extract generates CSS at build time with TypeScript types.

### Installation

```bash
npm install @vanilla-extract/css @vanilla-extract/next-plugin
```

### Configuration

```javascript
// next.config.js
const { createVanillaExtractPlugin } = require('@vanilla-extract/next-plugin')
const withVanillaExtract = createVanillaExtractPlugin()

/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = withVanillaExtract(nextConfig)
```

### Basic Usage

```typescript
// components/button.css.ts
import { style } from '@vanilla-extract/css'

export const button = style({
  padding: '12px 24px',
  borderRadius: '8px',
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s',
})

export const primary = style([
  button,
  {
    backgroundColor: '#0070f3',
    color: 'white',
    ':hover': {
      backgroundColor: '#0051cc',
    },
  },
])

export const secondary = style([
  button,
  {
    backgroundColor: '#eaeaea',
    color: '#000',
    ':hover': {
      backgroundColor: '#d5d5d5',
    },
  },
])
```

```typescript
// components/Button.tsx
import * as styles from './button.css'

interface ButtonProps {
  variant?: 'primary' | 'secondary'
  children: React.ReactNode
}

export default function Button({ variant = 'primary', children }: ButtonProps) {
  return (
    <button className={styles[variant]}>
      {children}
    </button>
  )
}
```

### Theme Contract

```typescript
// theme.css.ts
import { createTheme, createThemeContract } from '@vanilla-extract/css'

export const vars = createThemeContract({
  color: {
    primary: null,
    secondary: null,
    background: null,
    text: null,
  },
  spacing: {
    sm: null,
    md: null,
    lg: null,
  },
})

export const lightTheme = createTheme(vars, {
  color: {
    primary: '#0070f3',
    secondary: '#7928ca',
    background: '#ffffff',
    text: '#1a1a1a',
  },
  spacing: {
    sm: '8px',
    md: '16px',
    lg: '24px',
  },
})

export const darkTheme = createTheme(vars, {
  color: {
    primary: '#1a8fff',
    secondary: '#9d5cff',
    background: '#1a1a1a',
    text: '#ffffff',
  },
  spacing: {
    sm: '8px',
    md: '16px',
    lg: '24px',
  },
})
```

## Comparison Table

| Library | Runtime | Bundle Size | SSR Support | TypeScript | Performance |
|---------|---------|-------------|-------------|------------|-------------|
| Styled Components | Yes | Medium | Yes (with setup) | Excellent | Medium |
| Emotion | Yes | Small-Medium | Yes (with setup) | Excellent | Medium-Good |
| Panda CSS | No | Small | Excellent | Excellent | Excellent |
| Vanilla Extract | No | Minimal | Excellent | Excellent | Excellent |
| CSS Modules | No | Minimal | Excellent | Good | Excellent |

## Best Practices

### 1. Use `'use client'` Directive

```typescript
// components/StyledButton.tsx
'use client' // Required for CSS-in-JS

import styled from 'styled-components'

const Button = styled.button`
  /* styles */
`
```

### 2. Avoid Runtime Styles in Server Components

```typescript
// Bad: CSS-in-JS in Server Component
export default function ServerComponent() {
  return <StyledDiv>Content</StyledDiv> // Error!
}

// Good: Use CSS Modules for Server Components
import styles from './component.module.css'

export default function ServerComponent() {
  return <div className={styles.container}>Content</div>
}
```

### 3. Optimize Theme Objects

```typescript
// Good: Memoize theme
import { useMemo } from 'react'

function ThemeProvider({ children }) {
  const theme = useMemo(() => ({
    colors: { /* ... */ },
    spacing: { /* ... */ },
  }), [])

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}
```

### 4. Extract Static Styles

```typescript
// Bad: All styles in JS
const Button = styled.button`
  padding: 12px 24px;
  border-radius: 8px;
  /* 100 more lines */
`

// Good: Use CSS for static styles, JS for dynamic
// button.module.css
.button {
  padding: 12px 24px;
  border-radius: 8px;
  /* Static styles */
}

// Button.tsx
<button
  className={styles.button}
  style={{ backgroundColor: dynamicColor }}
>
```

### 5. Use Build-Time Solutions When Possible

Prefer Panda CSS or Vanilla Extract over runtime solutions for better performance.

## Migration Strategy

### From CSS-in-JS to CSS Modules

```typescript
// Before: styled-components
const Card = styled.div`
  padding: 24px;
  background: white;
  border-radius: 8px;
`

// After: CSS Modules
// card.module.css
.card {
  padding: 24px;
  background: white;
  border-radius: 8px;
}

// Card.tsx
import styles from './card.module.css'
export const Card = ({ children }) => (
  <div className={styles.card}>{children}</div>
)
```

## Troubleshooting

### Issue: Styles Not Rendering in Production

**Solution**: Ensure proper SSR setup with registry/cache provider

### Issue: Flash of Unstyled Content (FOUC)

**Solution**: Implement `useServerInsertedHTML` hook properly

### Issue: Large Bundle Size

**Solution**: Consider switching to build-time solutions (Panda CSS, Vanilla Extract)

### Issue: Type Errors with Styled Components

**Solution**: Use transient props (`$prop` instead of `prop`)

```typescript
// Good: Transient prop
const Button = styled.button<{ $primary?: boolean }>`
  background: ${props => props.$primary ? 'blue' : 'gray'};
`

<Button $primary />
```

## Summary

CSS-in-JS in Next.js App Router:

- **Runtime Libraries**: Require `'use client'` and proper SSR setup
- **Build-Time Libraries**: Better performance, work with Server Components
- **Recommendation**: Use CSS Modules/Tailwind for Server Components, CSS-in-JS only when dynamic styling is essential
- **Performance**: Build-time solutions (Panda, Vanilla Extract) > Runtime (Emotion, Styled Components)

Choose based on your needs:
- **Dynamic theming**: Styled Components, Emotion
- **Zero runtime**: Panda CSS, Vanilla Extract
- **Server Components**: CSS Modules, Tailwind
