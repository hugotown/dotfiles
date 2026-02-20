# Next.js Font Optimization

The `next/font` module provides automatic font optimization, including self-hosting Google Fonts and local font files with zero layout shift.

## Import

```jsx
// Google Fonts
import { Inter, Roboto, Playfair_Display } from 'next/font/google'

// Local Fonts
import localFont from 'next/font/local'
```

## Google Fonts

### Basic Usage

```jsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
})

export default function Layout({ children }) {
  return (
    <html className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

### Configuration Options

#### subsets
- **Type**: `string[]`
- **Description**: Font subsets to preload
- **Required**: Yes (for optimization)
- Common values: `'latin'`, `'latin-ext'`, `'cyrillic'`, `'greek'`

```jsx
const inter = Inter({
  subsets: ['latin'],
})

// Multiple subsets
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
})
```

#### weight
- **Type**: `string | string[]`
- **Description**: Font weights to load
- Use `'variable'` for variable fonts

```jsx
// Single weight
const roboto = Roboto({
  weight: '400',
  subsets: ['latin'],
})

// Multiple weights
const roboto = Roboto({
  weight: ['400', '700'],
  subsets: ['latin'],
})

// Variable font
const inter = Inter({
  subsets: ['latin'],
  weight: 'variable', // or omit - variable is default
})
```

#### style
- **Type**: `string | string[]`
- **Description**: Font styles to load
- Values: `'normal'`, `'italic'`

```jsx
// Single style
const roboto = Roboto({
  weight: '400',
  style: 'normal',
  subsets: ['latin'],
})

// Multiple styles
const roboto = Roboto({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
})
```

#### display
- **Type**: `'auto' | 'block' | 'swap' | 'fallback' | 'optional'`
- **Default**: `'swap'`
- **Description**: Font display strategy

```jsx
const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Show fallback immediately, swap when loaded
})

// Other options:
// 'block' - Brief invisible period, then swap
// 'fallback' - Very brief invisible period, swap with timeout
// 'optional' - Only use if available within timeout
```

#### preload
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Whether to preload the font

```jsx
const inter = Inter({
  subsets: ['latin'],
  preload: true, // Preload for better performance
})
```

#### variable
- **Type**: `string`
- **Description**: CSS variable name for the font

```jsx
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

// Use in CSS
<style jsx>{`
  .heading {
    font-family: var(--font-inter);
  }
`}</style>
```

#### adjustFontFallback
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Automatically adjust fallback font for zero layout shift

```jsx
const inter = Inter({
  subsets: ['latin'],
  adjustFontFallback: true, // Minimize layout shift
})
```

#### fallback
- **Type**: `string[]`
- **Description**: Fallback fonts

```jsx
const inter = Inter({
  subsets: ['latin'],
  fallback: ['system-ui', 'arial'],
})
```

## Local Fonts

### Basic Usage

```jsx
import localFont from 'next/font/local'

const myFont = localFont({
  src: './my-font.woff2',
})

export default function Layout({ children }) {
  return (
    <html className={myFont.className}>
      <body>{children}</body>
    </html>
  )
}
```

### Configuration Options

#### src
- **Type**: `string | Array<{path: string, weight?: string, style?: string}>`
- **Description**: Path to font file(s)

```jsx
// Single file
const myFont = localFont({
  src: './my-font.woff2',
})

// Multiple files
const myFont = localFont({
  src: [
    {
      path: './my-font-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './my-font-bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: './my-font-italic.woff2',
      weight: '400',
      style: 'italic',
    },
  ],
})
```

#### variable
- **Type**: `string`
- **Description**: CSS variable name

```jsx
const myFont = localFont({
  src: './my-font.woff2',
  variable: '--font-custom',
})
```

#### display
- Same as Google Fonts

#### weight
- **Type**: `string`
- Optional for single font files

```jsx
const myFont = localFont({
  src: './my-font.woff2',
  weight: '400',
})
```

#### style
- **Type**: `string`
- Optional for single font files

```jsx
const myFont = localFont({
  src: './my-font-italic.woff2',
  style: 'italic',
})
```

## Common Patterns

### Multiple Fonts

```jsx
import { Inter, Playfair_Display } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
})

export default function RootLayout({ children }) {
  return (
    <html className={`${inter.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

```css
/* globals.css */
body {
  font-family: var(--font-inter);
}

h1, h2, h3 {
  font-family: var(--font-playfair);
}
```

### Variable Fonts

```jsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export default function RootLayout({ children }) {
  return (
    <html className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
```

```css
/* Use font weight variations */
.light { font-weight: 300; }
.regular { font-weight: 400; }
.medium { font-weight: 500; }
.semibold { font-weight: 600; }
.bold { font-weight: 700; }
```

### Font with Tailwind CSS

```jsx
// app/layout.js
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export default function RootLayout({ children }) {
  return (
    <html className={inter.variable}>
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
        sans: ['var(--font-inter)'],
      },
    },
  },
}
```

### Component-Specific Font

```jsx
import { Roboto_Mono } from 'next/font/google'

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: '400',
})

export default function CodeBlock({ children }) {
  return (
    <pre className={robotoMono.className}>
      <code>{children}</code>
    </pre>
  )
}
```

### Conditional Font Loading

```jsx
import { Inter } from 'next/font/google'
import localFont from 'next/font/local'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const customFont = localFont({
  src: './custom-font.woff2',
  variable: '--font-custom',
})

export default function RootLayout({ children }) {
  const useCustomFont = process.env.NEXT_PUBLIC_USE_CUSTOM_FONT === 'true'

  return (
    <html className={useCustomFont ? customFont.variable : inter.variable}>
      <body>{children}</body>
    </html>
  )
}
```

### Font Subsetting

```jsx
// Only load Latin characters
const inter = Inter({
  subsets: ['latin'],
})

// Load multiple language subsets
const inter = Inter({
  subsets: ['latin', 'cyrillic', 'greek'],
})
```

### Font Preloading

```jsx
const inter = Inter({
  subsets: ['latin'],
  preload: true, // Preload for better performance
  display: 'swap', // Show fallback immediately
})
```

### System Font Stack with Fallback

```jsx
const inter = Inter({
  subsets: ['latin'],
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
})
```

## Advanced Usage

### Multiple Weights and Styles

```jsx
import { Roboto } from 'next/font/google'

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
})
```

### Font Axes (Variable Fonts)

```jsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  axes: ['slnt'], // Optional: specify font axes
})
```

### Custom Font Display Strategy

```jsx
const inter = Inter({
  subsets: ['latin'],
  display: 'optional', // Only use if available quickly
})
```

### Disable Automatic Fallback Adjustment

```jsx
const inter = Inter({
  subsets: ['latin'],
  adjustFontFallback: false, // Manual fallback control
})
```

## Font Loading Strategies

### Strategy 1: Global Fonts (Recommended)

```jsx
// app/layout.js
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }) {
  return (
    <html className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

### Strategy 2: CSS Variables

```jsx
// app/layout.js
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
    <html className={`${inter.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

```css
/* globals.css */
:root {
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}

body {
  font-family: var(--font-sans);
}

code, pre {
  font-family: var(--font-mono);
}
```

### Strategy 3: Component-Level

```jsx
// components/Hero.js
import { Playfair_Display } from 'next/font/google'

const playfair = Playfair_Display({ subsets: ['latin'] })

export default function Hero() {
  return (
    <h1 className={playfair.className}>
      Welcome to Next.js
    </h1>
  )
}
```

## Popular Google Font Examples

### Sans-Serif Fonts

```jsx
// Inter (modern, neutral)
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'] })

// Roboto (clean, readable)
import { Roboto } from 'next/font/google'
const roboto = Roboto({ weight: ['400', '700'], subsets: ['latin'] })

// Open Sans (friendly, readable)
import { Open_Sans } from 'next/font/google'
const openSans = Open_Sans({ subsets: ['latin'] })

// Montserrat (geometric, modern)
import { Montserrat } from 'next/font/google'
const montserrat = Montserrat({ subsets: ['latin'] })
```

### Serif Fonts

```jsx
// Playfair Display (elegant, editorial)
import { Playfair_Display } from 'next/font/google'
const playfair = Playfair_Display({ subsets: ['latin'] })

// Merriweather (classic, readable)
import { Merriweather } from 'next/font/google'
const merriweather = Merriweather({ weight: ['400', '700'], subsets: ['latin'] })

// Lora (balanced, elegant)
import { Lora } from 'next/font/google'
const lora = Lora({ subsets: ['latin'] })
```

### Monospace Fonts

```jsx
// Roboto Mono (clean, readable)
import { Roboto_Mono } from 'next/font/google'
const robotoMono = Roboto_Mono({ subsets: ['latin'] })

// Fira Code (with ligatures)
import { Fira_Code } from 'next/font/google'
const firaCode = Fira_Code({ subsets: ['latin'] })

// Source Code Pro (Adobe)
import { Source_Code_Pro } from 'next/font/google'
const sourceCodePro = Source_Code_Pro({ subsets: ['latin'] })
```

### Display Fonts

```jsx
// Bebas Neue (bold, impactful)
import { Bebas_Neue } from 'next/font/google'
const bebasNeue = Bebas_Neue({ weight: '400', subsets: ['latin'] })

// Righteous (bold, modern)
import { Righteous } from 'next/font/google'
const righteous = Righteous({ weight: '400', subsets: ['latin'] })
```

## Performance Optimization

### Benefits of next/font

1. **Zero layout shift**: Fonts are sized correctly before loading
2. **Self-hosting**: Google Fonts are automatically self-hosted
3. **No external requests**: Fonts served from your domain
4. **Automatic subsetting**: Only load characters you need
5. **Preloading**: Critical fonts preloaded automatically

### Best Practices

1. **Use variable fonts** when possible for fewer file loads
2. **Limit font weights** to only what you need
3. **Use appropriate subsets** (e.g., just 'latin' for English sites)
4. **Preload critical fonts** with `preload: true`
5. **Use font-display: swap** for better perceived performance
6. **Combine similar fonts** to reduce HTTP requests

### Font Loading Timeline

```jsx
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',      // Show fallback immediately
  preload: true,        // Preload for faster loading
})
```

## Accessibility

### Best Practices

1. **Maintain sufficient contrast**: WCAG AA requires 4.5:1 for body text
2. **Use readable font sizes**: Minimum 16px for body text
3. **Ensure line height**: 1.5 or greater for readability
4. **Test with zoom**: Content should be readable at 200% zoom
5. **Avoid font-only communication**: Don't rely solely on font styling

```css
body {
  font-family: var(--font-inter);
  font-size: 16px;
  line-height: 1.5;
  color: #333; /* Sufficient contrast on white */
}
```

## Troubleshooting

### Font not loading
- Check that subset is specified
- Verify font name matches Google Fonts exactly
- Check for typos in font imports

### Layout shift occurring
- Ensure `adjustFontFallback` is enabled (default)
- Verify font is preloaded
- Check that fallback fonts are similar in metrics

### Font looks different from Google Fonts
- Fonts are self-hosted, so behavior should be identical
- Check that weights and styles match
- Verify subset includes needed characters

### Performance issues
- Reduce number of font weights
- Use variable fonts
- Limit subsets to needed languages
- Enable preloading for critical fonts

## Migration from @next/font

If upgrading from Next.js 12:

```jsx
// Old (@next/font)
import { Inter } from '@next/font/google'

// New (next/font)
import { Inter } from 'next/font/google'
```

## Resources

- [Google Fonts](https://fonts.google.com/) - Browse available fonts
- [Font Squirrel](https://www.fontsquirrel.com/) - Free fonts for commercial use
- [Variable Fonts](https://v-fonts.com/) - Showcase of variable fonts
- [Font display](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display) - MDN documentation
