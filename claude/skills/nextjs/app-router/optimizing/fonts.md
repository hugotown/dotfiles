# Font Optimization

Next.js `next/font` automatically optimizes fonts and removes external network requests for improved privacy and performance.

## Core Features

- **Automatic Self-Hosting**: Downloads and hosts Google Fonts locally
- **Zero Layout Shift**: CSS size-adjust property prevents layout shift
- **Font Subsetting**: Only loads characters you need
- **Font Display Strategy**: Configurable loading behavior
- **Variable Fonts**: Full support for variable font files

## Google Fonts

### Basic Usage

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

### Multiple Weights

```tsx
import { Roboto } from 'next/font/google'

const roboto = Roboto({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
})
```

### Variable Fonts

```tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter', // Creates CSS variable
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
```

```css
/* Then use in CSS */
.heading {
  font-family: var(--font-inter);
}
```

### Multiple Fonts

```tsx
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

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

### Tailwind CSS Integration

```tsx
// app/layout.tsx
import { Inter, Roboto_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
}
```

```tsx
// Usage in components
<h1 className="font-sans">This uses Inter</h1>
<code className="font-mono">This uses Roboto Mono</code>
```

## Local Fonts

### Basic Local Font

```tsx
import localFont from 'next/font/local'

const myFont = localFont({
  src: './my-font.woff2',
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

### Multiple Font Files

```tsx
import localFont from 'next/font/local'

const myFont = localFont({
  src: [
    {
      path: './fonts/MyFont-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/MyFont-Italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: './fonts/MyFont-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-my-font',
  display: 'swap',
})
```

### Variable Font Files

```tsx
import localFont from 'next/font/local'

const myVariableFont = localFont({
  src: './fonts/MyVariableFont.woff2',
  display: 'swap',
  variable: '--font-my-variable',
})
```

## Font Display Strategies

### Display Options

```tsx
import { Inter } from 'next/font/google'

// Available options:
const font = Inter({
  subsets: ['latin'],
  display: 'swap', // Recommended: swap, optional, block, fallback, auto
})
```

**Display Values:**

- `swap` (Recommended): Use fallback font, swap when custom font loads
- `optional`: Use fallback, only swap if font loads quickly
- `block`: Brief invisible period, then swap (can cause FOIT)
- `fallback`: Very brief invisible period, then swap with timeout
- `auto`: Browser default behavior

### Preloading Fonts

```tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  preload: true, // Default is true
})
```

## Font Subsetting

### Language Subsets

```tsx
import { Noto_Sans_JP } from 'next/font/google'

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin', 'japanese'], // Only load needed character sets
  weight: ['400', '700'],
})
```

### Custom Subsetting

For Google Fonts, Next.js automatically subsets. For local fonts:

```bash
# Use pyftsubset to create subsets
pip install fonttools brotli

pyftsubset font.ttf \
  --output-file=font-subset.woff2 \
  --flavor=woff2 \
  --layout-features="*" \
  --unicodes="U+0000-00FF"
```

## Advanced Patterns

### Font Per Route

```tsx
// app/blog/layout.tsx
import { Merriweather } from 'next/font/google'

const merriweather = Merriweather({
  weight: ['400', '700'],
  subsets: ['latin'],
})

export default function BlogLayout({ children }) {
  return <div className={merriweather.className}>{children}</div>
}
```

### Conditional Font Loading

```tsx
'use client'

import { Inter, Roboto } from 'next/font/google'
import { usePathname } from 'next/navigation'

const inter = Inter({ subsets: ['latin'] })
const roboto = Roboto({ weight: ['400', '700'], subsets: ['latin'] })

export default function ConditionalFont({ children }) {
  const pathname = usePathname()
  const font = pathname.startsWith('/blog') ? roboto : inter

  return <div className={font.className}>{children}</div>
}
```

### Headings vs Body Font

```tsx
// app/layout.tsx
import { Playfair_Display, Inter } from 'next/font/google'

const headingFont = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-heading',
})

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body className="font-body">
        {children}
      </body>
    </html>
  )
}
```

```css
/* globals.css */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}

body {
  font-family: var(--font-body);
}
```

## Performance Optimization

### Minimize Font Weights

```tsx
// Bad - loading many weights
const inter = Inter({
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
})

// Good - only what you need
const inter = Inter({
  weight: ['400', '700'],
  subsets: ['latin'],
})

// Best - use variable font
const inter = Inter({
  subsets: ['latin'],
  // Variable font includes all weights
})
```

### Font Loading Strategy

```tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Best for performance
  preload: true,
  fallback: ['system-ui', 'arial'], // System font fallback
})
```

### Adjust Fallback Font

Minimize layout shift by matching fallback font metrics:

```tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  adjustFontFallback: true, // Default, automatically adjusts
})
```

For local fonts:

```tsx
import localFont from 'next/font/local'

const myFont = localFont({
  src: './my-font.woff2',
  adjustFontFallback: 'Arial', // Adjust Arial to match custom font
})
```

## Measurement

### Monitor Font Loading

```tsx
'use client'

import { useEffect } from 'react'

export default function FontMonitor() {
  useEffect(() => {
    if ('fonts' in document) {
      document.fonts.ready.then(() => {
        console.log('All fonts loaded')

        document.fonts.forEach((font) => {
          console.log('Font loaded:', font.family)
        })
      })
    }
  }, [])

  return null
}
```

### Performance API

```tsx
'use client'

import { useEffect } from 'react'

export default function FontPerformance() {
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.log('Font loaded:', entry.name, entry.duration)
      }
    })

    observer.observe({ entryTypes: ['resource'] })

    return () => observer.disconnect()
  }, [])

  return null
}
```

## Best Practices

1. **Use Variable Fonts**: When possible, they're more flexible and efficient
2. **Limit Font Weights**: Only load weights you actually use
3. **Subset Appropriately**: Only include needed character sets
4. **Use display: swap**: Best performance and UX balance
5. **Preload Critical Fonts**: Ensure above-the-fold text renders quickly
6. **Match Fallback Metrics**: Use adjustFontFallback to reduce layout shift
7. **Self-host**: Use next/font instead of external Google Fonts links
8. **CSS Variables**: Use for flexibility across your app

## Common Issues

### Font Not Loading

Ensure correct font name from Google Fonts:

```tsx
// Correct - use underscore for spaces
import { Roboto_Mono } from 'next/font/google'

// Incorrect
import { Roboto Mono } from 'next/font/google'
```

### Layout Shift

Always specify fallback fonts:

```tsx
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: true, // Ensures fallback matches custom font metrics
})
```

### Flash of Unstyled Text (FOUT)

Use appropriate display strategy:

```tsx
const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Better than 'block' which causes invisible text
})
```

## Tailwind CSS Example

Complete setup with Tailwind:

```tsx
// app/layout.tsx
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
}
```

```tsx
// Usage
<h1 className="font-sans text-4xl font-bold">Heading</h1>
<code className="font-mono">Code snippet</code>
```

## Resources

- [Next.js Font Optimization Documentation](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)
- [Google Fonts](https://fonts.google.com/)
- [Font Subsetting Guide](https://web.dev/font-best-practices/)
