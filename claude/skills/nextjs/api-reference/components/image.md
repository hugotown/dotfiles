# Next.js Image Component

The `next/image` component extends the HTML `<img>` element with automatic image optimization, lazy loading, and responsive image serving.

## Import

```jsx
import Image from 'next/image'
```

## Basic Usage

```jsx
import Image from 'next/image'

export default function Page() {
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

## Props API Reference

### Required Props

#### src
- **Type**: `string | StaticImport`
- **Description**: Path to the image file
- Can be:
  - Local import: `import profilePic from './profile.jpg'`
  - Absolute path: `/images/profile.jpg`
  - External URL: `https://example.com/image.jpg`

```jsx
// Local import
import profilePic from './profile.jpg'
<Image src={profilePic} alt="Profile" />

// Absolute path
<Image src="/images/hero.jpg" alt="Hero" width={800} height={600} />

// External URL (requires next.config.js configuration)
<Image
  src="https://example.com/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
/>
```

#### alt
- **Type**: `string`
- **Description**: Alternative text for screen readers and when image fails to load
- **Required**: Yes (for accessibility)

```jsx
<Image src="/logo.png" alt="Company logo" width={200} height={100} />
```

#### width & height
- **Type**: `number | string`
- **Description**: Intrinsic width and height of the image in pixels
- **Required**: Yes (unless using `fill` or importing a static image)
- Used to calculate aspect ratio and prevent layout shift

```jsx
<Image src="/banner.jpg" alt="Banner" width={1200} height={400} />
```

### Optional Props

#### fill
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Makes image fill the parent container (requires parent to be `position: relative`)
- Replaces `width` and `height` props

```jsx
<div style={{ position: 'relative', width: '100%', height: '400px' }}>
  <Image
    src="/background.jpg"
    alt="Background"
    fill
    style={{ objectFit: 'cover' }}
  />
</div>
```

#### sizes
- **Type**: `string`
- **Description**: Media query-like string defining image sizes for responsive layouts
- Critical for performance with responsive images
- Tells browser what size image to download

```jsx
<Image
  src="/responsive.jpg"
  alt="Responsive image"
  width={800}
  height={600}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>

// Common patterns:
// Full width on mobile, half on tablet, third on desktop
sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"

// Full width on all screens
sizes="100vw"

// Fixed size
sizes="400px"
```

#### priority
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Preloads the image (disables lazy loading)
- Use for LCP (Largest Contentful Paint) images

```jsx
// Hero image - should load immediately
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority
/>
```

#### placeholder
- **Type**: `'blur' | 'empty'`
- **Default**: `'empty'`
- **Description**: Placeholder to use while image loads
- `'blur'` automatically generates blurred placeholder from static imports

```jsx
// Automatic blur placeholder (static import only)
import heroImage from './hero.jpg'
<Image src={heroImage} alt="Hero" placeholder="blur" />

// Manual blur with blurDataURL
<Image
  src="/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
/>
```

#### blurDataURL
- **Type**: `string`
- **Description**: Data URL for blur placeholder (must be base64-encoded)
- Only used when `placeholder="blur"`

```jsx
<Image
  src="/portrait.jpg"
  alt="Portrait"
  width={400}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
/>
```

#### quality
- **Type**: `number`
- **Default**: `75`
- **Range**: 1-100
- **Description**: Quality of optimized image

```jsx
// High quality for important images
<Image src="/product.jpg" alt="Product" width={800} height={800} quality={90} />

// Lower quality for thumbnails
<Image src="/thumb.jpg" alt="Thumbnail" width={100} height={100} quality={60} />
```

#### loading
- **Type**: `'lazy' | 'eager'`
- **Default**: `'lazy'`
- **Description**: Loading behavior (lazy loading is automatic)

```jsx
// Eager loading (use with priority for above-fold images)
<Image src="/hero.jpg" alt="Hero" width={1200} height={600} loading="eager" priority />
```

#### loader
- **Type**: `(params: ImageLoaderProps) => string`
- **Description**: Custom function to resolve image URLs
- Useful for custom image CDNs

```jsx
const myLoader = ({ src, width, quality }) => {
  return `https://cdn.example.com/${src}?w=${width}&q=${quality || 75}`
}

<Image
  loader={myLoader}
  src="profile.jpg"
  alt="Profile"
  width={500}
  height={500}
/>
```

#### style
- **Type**: `CSSProperties`
- **Description**: CSS styles to apply to the image

```jsx
<Image
  src="/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  style={{ borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
/>
```

#### onLoad
- **Type**: `(event: Event) => void`
- **Description**: Callback when image loads

```jsx
<Image
  src="/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  onLoad={(e) => console.log('Image loaded')}
/>
```

#### onError
- **Type**: `(event: Event) => void`
- **Description**: Callback when image fails to load

```jsx
<Image
  src="/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  onError={(e) => console.log('Image failed to load')}
/>
```

## Image Formats

Next.js automatically serves modern image formats (WebP, AVIF) when the browser supports them:

- **WebP**: ~30% smaller than JPEG
- **AVIF**: ~50% smaller than JPEG (when supported)

No configuration needed - automatic format detection and conversion.

## Configuration (next.config.js)

### Remote Images

To use external images, configure allowed domains:

```js
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

### Image Sizes

Configure device sizes for responsive images:

```js
module.exports = {
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
}
```

### Custom Loader

Configure a custom loader globally:

```js
module.exports = {
  images: {
    loader: 'custom',
    loaderFile: './my-loader.js',
  },
}
```

## Common Patterns

### Responsive Hero Image

```jsx
<div style={{ position: 'relative', width: '100%', height: '60vh' }}>
  <Image
    src="/hero.jpg"
    alt="Hero"
    fill
    priority
    sizes="100vw"
    style={{ objectFit: 'cover' }}
  />
</div>
```

### Product Grid

```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
  {products.map((product) => (
    <div key={product.id} style={{ position: 'relative', aspectRatio: '1/1' }}>
      <Image
        src={product.image}
        alt={product.name}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        style={{ objectFit: 'cover' }}
      />
    </div>
  ))}
</div>
```

### Background Image

```jsx
<div style={{ position: 'relative', minHeight: '100vh' }}>
  <Image
    src="/background.jpg"
    alt="Background"
    fill
    quality={100}
    style={{ objectFit: 'cover', zIndex: -1 }}
  />
  <div style={{ position: 'relative', zIndex: 1 }}>
    {/* Content goes here */}
  </div>
</div>
```

### Avatar with Fallback

```jsx
'use client'
import Image from 'next/image'
import { useState } from 'react'

export default function Avatar({ src, alt }) {
  const [imgSrc, setImgSrc] = useState(src)

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={40}
      height={40}
      style={{ borderRadius: '50%' }}
      onError={() => setImgSrc('/default-avatar.png')}
    />
  )
}
```

### Image Gallery with Blur Placeholder

```jsx
import Image from 'next/image'

const images = [
  { src: '/gallery/1.jpg', blurDataURL: '...' },
  { src: '/gallery/2.jpg', blurDataURL: '...' },
  { src: '/gallery/3.jpg', blurDataURL: '...' },
]

export default function Gallery() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
      {images.map((img, index) => (
        <Image
          key={index}
          src={img.src}
          alt={`Gallery image ${index + 1}`}
          width={400}
          height={300}
          placeholder="blur"
          blurDataURL={img.blurDataURL}
        />
      ))}
    </div>
  )
}
```

## Optimization Tips

1. **Always specify dimensions** to prevent layout shift
2. **Use `priority`** for above-the-fold images (especially LCP elements)
3. **Use `sizes`** prop for responsive images to optimize loading
4. **Use `placeholder="blur"`** for better perceived performance
5. **Optimize `quality`** based on image importance (60-80 for most cases)
6. **Use `fill`** for background images and containers
7. **Configure `remotePatterns`** restrictively for security

## Accessibility Considerations

1. **Always provide meaningful `alt` text**
2. Use **empty string for decorative images**: `alt=""`
3. **Describe the content**, not the image itself
4. Include **text alternatives** for complex images
5. Ensure **sufficient color contrast** for text overlays

```jsx
// Good alt text
<Image src="/chart.jpg" alt="Sales increased 50% in Q4 2024" width={800} height={400} />

// Decorative image
<Image src="/divider.png" alt="" width={100} height={10} />

// Poor alt text (avoid)
<Image src="/photo.jpg" alt="Image" width={800} height={600} />
```

## Performance Metrics

The Image component helps improve:

- **LCP (Largest Contentful Paint)**: Use `priority` for hero images
- **CLS (Cumulative Layout Shift)**: Automatic with width/height props
- **FID (First Input Delay)**: Lazy loading prevents blocking

## Troubleshooting

### Image not loading from external URL
- Add domain to `remotePatterns` in `next.config.js`

### Layout shift occurring
- Ensure `width` and `height` are specified (or use `fill`)

### Blur placeholder not working
- Only works with static imports or manual `blurDataURL`

### Image appears stretched
- Use `style={{ objectFit: 'cover' }}` or `objectFit: 'contain'`

### Slow image loading
- Use appropriate `sizes` prop
- Consider reducing `quality`
- Use `priority` for critical images
