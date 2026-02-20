# Image Optimization

The `next/image` component extends the HTML `<img>` element with automatic image optimization features.

## Core Features

### Automatic Optimization
- **Format Selection**: Automatically serves WebP or AVIF when supported
- **Size Optimization**: Generates multiple sizes for responsive images
- **Quality Tuning**: Configurable quality settings (default: 75)
- **Lazy Loading**: Images load as they enter the viewport
- **Blur Placeholder**: Optional blur-up effect while loading

## Basic Implementation

### Local Images

```tsx
import Image from 'next/image'
import profilePic from '../public/profile.jpg'

export default function Page() {
  return (
    <Image
      src={profilePic}
      alt="Profile picture"
      // width and height are automatically provided
      // for imported images
      placeholder="blur" // Optional blur-up while loading
    />
  )
}
```

### Remote Images

```tsx
import Image from 'next/image'

export default function Page() {
  return (
    <Image
      src="https://example.com/image.jpg"
      alt="Description"
      width={500}
      height={300}
      // Required for remote images
    />
  )
}
```

## Advanced Configurations

### Priority Loading

For above-the-fold images (LCP candidates):

```tsx
<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  priority // Disables lazy loading, preloads the image
/>
```

### Responsive Images

#### Using Fill Layout

```tsx
<div style={{ position: 'relative', width: '100%', height: '400px' }}>
  <Image
    src="/background.jpg"
    alt="Background"
    fill
    style={{ objectFit: 'cover' }}
  />
</div>
```

#### Using Sizes Property

```tsx
<Image
  src="/responsive.jpg"
  alt="Responsive image"
  width={1200}
  height={800}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  // Tells the browser how much space the image will take
/>
```

### Image Quality

```tsx
<Image
  src="/high-quality.jpg"
  alt="High quality image"
  width={800}
  height={600}
  quality={90} // 1-100, default is 75
/>
```

### Placeholder Options

#### Blur Placeholder (Local Images)

```tsx
import Image from 'next/image'
import mountains from '../public/mountains.jpg'

<Image
  src={mountains}
  placeholder="blur"
  alt="Mountains"
/>
```

#### Custom Blur Data URL

```tsx
<Image
  src="/external-image.jpg"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..." // Base64 encoded
  alt="External image"
/>
```

#### Empty Placeholder

```tsx
<Image
  src="/image.jpg"
  width={800}
  height={600}
  placeholder="empty" // No placeholder
  alt="Image"
/>
```

## Image Loader Configuration

### Custom Loader

For using external image services:

```tsx
// app/image-loader.ts
export default function imageLoader({ src, width, quality }) {
  return `https://cdn.example.com/${src}?w=${width}&q=${quality || 75}`
}
```

```tsx
// Usage in component
import Image from 'next/image'
import imageLoader from './image-loader'

<Image
  loader={imageLoader}
  src="image.jpg"
  width={800}
  height={600}
  alt="Image"
/>
```

### Global Loader Configuration

```js
// next.config.js
module.exports = {
  images: {
    loader: 'custom',
    loaderFile: './app/image-loader.ts',
  },
}
```

## Remote Image Patterns

Configure allowed remote image sources:

```js
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
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
  },
}
```

## Device Sizes Configuration

Customize responsive breakpoints:

```js
// next.config.js
module.exports = {
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
}
```

## Image Formats

Enable AVIF support (slower but better compression):

```js
// next.config.js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
}
```

## Common Patterns

### Hero Image

```tsx
<div className="relative h-screen w-full">
  <Image
    src="/hero.jpg"
    alt="Hero"
    fill
    priority
    quality={90}
    style={{ objectFit: 'cover' }}
  />
  <div className="relative z-10">
    {/* Content on top of image */}
  </div>
</div>
```

### Grid of Images

```tsx
<div className="grid grid-cols-3 gap-4">
  {images.map((img) => (
    <div key={img.id} className="relative aspect-square">
      <Image
        src={img.src}
        alt={img.alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        style={{ objectFit: 'cover' }}
      />
    </div>
  ))}
</div>
```

### Thumbnail with Lightbox

```tsx
'use client'

import Image from 'next/image'
import { useState } from 'react'

export default function Gallery({ images }) {
  const [selectedImage, setSelectedImage] = useState(null)

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {images.map((img) => (
          <div
            key={img.id}
            className="relative aspect-square cursor-pointer"
            onClick={() => setSelectedImage(img)}
          >
            <Image
              src={img.thumbnail}
              alt={img.alt}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              style={{ objectFit: 'cover' }}
            />
          </div>
        ))}
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <Image
            src={selectedImage.full}
            alt={selectedImage.alt}
            width={1200}
            height={800}
            quality={95}
          />
          <button onClick={() => setSelectedImage(null)}>Close</button>
        </div>
      )}
    </>
  )
}
```

## Performance Optimization

### LCP Optimization

For images that are the Largest Contentful Paint element:

```tsx
<Image
  src="/lcp-image.jpg"
  alt="Main content"
  width={1200}
  height={600}
  priority // Critical for LCP
  quality={85}
/>
```

### Lazy Loading Strategy

```tsx
// Above the fold - disable lazy loading
<Image src="/hero.jpg" priority />

// Below the fold - default lazy loading
<Image src="/feature.jpg" loading="lazy" />

// Far below the fold - can use even more aggressive lazy loading
<Image src="/footer.jpg" loading="lazy" />
```

## Measurement

### Monitor Image Performance

```tsx
import Image from 'next/image'

<Image
  src="/image.jpg"
  alt="Image"
  width={800}
  height={600}
  onLoadingComplete={(result) => {
    console.log('Image loaded:', result.naturalWidth, result.naturalHeight)
  }}
  onError={(error) => {
    console.error('Image failed to load:', error)
  }}
/>
```

## Best Practices

1. **Always Use next/image**: For automatic optimization
2. **Set Priority for LCP**: Use `priority` for above-the-fold images
3. **Configure Sizes**: For responsive images to avoid oversized downloads
4. **Use Blur Placeholders**: Improves perceived performance
5. **Optimize Source Images**: Don't serve unnecessarily large originals
6. **Configure Remote Patterns**: Explicitly allow external image sources
7. **Monitor Loading**: Track image performance in production
8. **Use Appropriate Quality**: Balance quality vs. file size (75-85 is usually optimal)

## Common Issues

### CLS (Cumulative Layout Shift)

Always specify width and height or use fill with a sized container:

```tsx
// Good - no layout shift
<Image src="/img.jpg" width={800} height={600} alt="..." />

// Good - with sized container
<div style={{ position: 'relative', width: '800px', height: '600px' }}>
  <Image src="/img.jpg" fill alt="..." />
</div>

// Bad - causes layout shift
<Image src="/img.jpg" alt="..." />
```

### Remote Images Not Loading

Ensure remote patterns are configured:

```js
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'your-domain.com',
      },
    ],
  },
}
```

## Resources

- [Next.js Image Component Documentation](https://nextjs.org/docs/app/api-reference/components/image)
- [Image Optimization Best Practices](https://nextjs.org/docs/app/building-your-application/optimizing/images)
