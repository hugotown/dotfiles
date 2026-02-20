# Images and Fonts

Learn how to optimize images and fonts in Next.js App Router using next/image and next/font.

## Image Optimization with next/image

The `next/image` component automatically optimizes images for better performance.

### Basic Image Usage

```javascript
import Image from 'next/image'

export default function Avatar() {
  return (
    <Image
      src="/profile.jpg"
      alt="Profile picture"
      width={500}
      height={500}
    />
  )
}
```

### Remote Images

```javascript
import Image from 'next/image'

export default function Avatar() {
  return (
    <Image
      src="https://example.com/profile.jpg"
      alt="Profile picture"
      width={500}
      height={500}
    />
  )
}
```

Configure allowed domains in `next.config.js`:

```javascript
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
        port: '',
        pathname: '/images/**',
      },
    ],
  },
}
```

### Fill Mode

Use `fill` for images that should fill their parent container:

```javascript
import Image from 'next/image'

export default function Hero() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '400px' }}>
      <Image
        src="/hero.jpg"
        alt="Hero image"
        fill
        style={{ objectFit: 'cover' }}
      />
    </div>
  )
}
```

### Responsive Images

```javascript
import Image from 'next/image'

export default function ResponsiveImage() {
  return (
    <div className="container">
      <Image
        src="/wide.jpg"
        alt="Responsive image"
        width={1200}
        height={600}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        style={{ width: '100%', height: 'auto' }}
      />
    </div>
  )
}
```

### Priority Loading

Mark above-the-fold images as priority:

```javascript
import Image from 'next/image'

export default function Hero() {
  return (
    <Image
      src="/hero.jpg"
      alt="Hero"
      width={1200}
      height={600}
      priority
    />
  )
}
```

### Image Quality

```javascript
<Image
  src="/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  quality={90} // 1-100, default is 75
/>
```

### Placeholder Blur

```javascript
import Image from 'next/image'
import profilePic from './profile.jpg' // Import local image

export default function Avatar() {
  return (
    <Image
      src={profilePic}
      alt="Profile"
      placeholder="blur" // Automatic blur-up placeholder
    />
  )
}
```

### Custom Placeholder

```javascript
<Image
  src="/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..." // Base64 encoded
/>
```

## Image Loader Configuration

### Custom Loader

```javascript
// next.config.js
module.exports = {
  images: {
    loader: 'custom',
    loaderFile: './my-loader.js',
  },
}

// my-loader.js
export default function myImageLoader({ src, width, quality }) {
  return `https://cdn.example.com/${src}?w=${width}&q=${quality || 75}`
}
```

### Cloudinary Loader

```javascript
// next.config.js
module.exports = {
  images: {
    loader: 'cloudinary',
    path: 'https://res.cloudinary.com/your-cloud-name/image/upload/',
  },
}
```

## Styling Images

### CSS Modules

```css
/* styles.module.css */
.imageContainer {
  position: relative;
  width: 100%;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
}
```

```javascript
import Image from 'next/image'
import styles from './styles.module.css'

export default function StyledImage() {
  return (
    <div className={styles.imageContainer}>
      <Image
        src="/photo.jpg"
        alt="Photo"
        fill
        style={{ objectFit: 'cover' }}
      />
    </div>
  )
}
```

### Tailwind CSS

```javascript
import Image from 'next/image'

export default function RoundedImage() {
  return (
    <div className="relative w-full h-96 rounded-lg overflow-hidden">
      <Image
        src="/photo.jpg"
        alt="Photo"
        fill
        className="object-cover"
      />
    </div>
  )
}
```

## Font Optimization with next/font

### Google Fonts

```javascript
// app/layout.js
import { Inter, Roboto_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
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

### Multiple Fonts

```javascript
// app/layout.js
import { Inter, Playfair_Display } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

```css
/* globals.css */
h1, h2, h3 {
  font-family: var(--font-playfair);
}

body {
  font-family: var(--font-inter);
}
```

### Font Weights and Styles

```javascript
import { Roboto } from 'next/font/google'

const roboto = Roboto({
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
})
```

### Variable Fonts

```javascript
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  // Variable fonts don't need weight specified
})
```

## Local Fonts

### Single Font File

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

### Multiple Font Files

```javascript
import localFont from 'next/font/local'

const myFont = localFont({
  src: [
    {
      path: './fonts/my-font-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/my-font-italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: './fonts/my-font-bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
})
```

### Font Variables

```javascript
import localFont from 'next/font/local'

const customFont = localFont({
  src: './fonts/custom.woff2',
  variable: '--font-custom',
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={customFont.variable}>
      <body>{children}</body>
    </html>
  )
}
```

```css
/* Use in CSS */
.heading {
  font-family: var(--font-custom);
}
```

## Font Display Strategies

```javascript
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // or 'auto', 'block', 'fallback', 'optional'
})
```

- `auto`: Browser default
- `block`: Short block period, infinite swap
- `swap`: No block period, infinite swap (recommended)
- `fallback`: Short block period, short swap period
- `optional`: Short block period, no swap period

## Preloading Fonts

Fonts are automatically preloaded when used in layouts:

```javascript
// app/layout.js - Font is preloaded automatically
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

## Using Fonts in Tailwind

```javascript
// app/layout.js
import { Inter, Roboto_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
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

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)'],
        mono: ['var(--font-roboto-mono)'],
      },
    },
  },
}
```

```javascript
// Use in components
<h1 className="font-sans">Sans Serif Heading</h1>
<code className="font-mono">Monospace Code</code>
```

## Image Patterns

### Gallery Grid

```javascript
import Image from 'next/image'

export default function Gallery({ images }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {images.map((image) => (
        <div key={image.id} className="relative aspect-square">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
          />
        </div>
      ))}
    </div>
  )
}
```

### Background Image

```javascript
import Image from 'next/image'

export default function Hero() {
  return (
    <div className="relative h-screen">
      <Image
        src="/hero-bg.jpg"
        alt="Hero background"
        fill
        priority
        style={{ objectFit: 'cover' }}
        quality={90}
      />
      <div className="relative z-10 text-white">
        <h1>Welcome</h1>
      </div>
    </div>
  )
}
```

### Avatar with Fallback

```javascript
'use client'

import Image from 'next/image'
import { useState } from 'react'

export default function Avatar({ src, alt, size = 40 }) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div
        className="rounded-full bg-gray-300 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {alt.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="rounded-full"
      onError={() => setError(true)}
    />
  )
}
```

## Best Practices

### Images

1. **Always use next/image** - Automatic optimization and lazy loading
2. **Specify width and height** - Prevents layout shift
3. **Use priority for above-the-fold images** - Faster initial load
4. **Configure remote patterns** - Secure external image sources
5. **Use appropriate sizes** - Responsive images for different screens
6. **Optimize quality** - Balance quality and file size
7. **Use blur placeholders** - Better perceived performance
8. **Leverage fill mode** - For container-based sizing

### Fonts

1. **Use next/font** - Automatic optimization and self-hosting
2. **Load fonts in layout** - Preload and avoid FOUT
3. **Use variable fonts** - Fewer files, more flexibility
4. **Limit font weights** - Only load what you need
5. **Use font-display: swap** - Prevent invisible text
6. **Create font variables** - Use CSS variables for flexibility
7. **Subset fonts** - Only include needed characters
8. **Use system fonts as fallbacks** - Better fallback experience

## Common Pitfalls

### Images

1. **Not using next/image** - Missing optimization benefits
2. **Forgetting width/height** - Layout shift issues
3. **Not configuring remote domains** - External images fail
4. **Using inline styles incorrectly** - Use style prop, not className for some properties
5. **Not using priority** - Slow LCP for hero images
6. **Over-optimizing quality** - Unnecessarily large files
7. **Not handling errors** - Broken image displays

### Fonts

1. **Loading fonts in components** - Fonts load too late
2. **Not using next/font** - Missing optimization
3. **Loading too many weights** - Slower page loads
4. **Not using variables** - Less flexible styling
5. **Forgetting display: swap** - Flash of invisible text
6. **Using @import in CSS** - Slower font loading
7. **Not subsetting fonts** - Larger file sizes

## Checklist

### Images
- [ ] Use next/image for all images
- [ ] Specify width and height or use fill
- [ ] Configure remote patterns for external images
- [ ] Add priority to above-the-fold images
- [ ] Use appropriate sizes for responsive images
- [ ] Implement blur placeholders
- [ ] Optimize quality settings
- [ ] Handle image errors gracefully
- [ ] Test on different screen sizes

### Fonts
- [ ] Use next/font for font loading
- [ ] Load fonts in root layout
- [ ] Only load needed font weights
- [ ] Use font-display: swap
- [ ] Create CSS variables for fonts
- [ ] Configure proper fallback fonts
- [ ] Test font loading performance
- [ ] Verify no FOUT/FOIT issues
