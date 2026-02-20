# Image Optimization Configuration

Next.js provides built-in image optimization through the `next/image` component. Configure image optimization settings in `next.config.js`.

## Basic Configuration

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Image domains (deprecated, use remotePatterns)
    domains: ['example.com', 'cdn.example.com'],

    // Remote patterns (recommended)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
        port: '',
        pathname: '/images/**',
      },
    ],

    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],

    // Image sizes for image srcset
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Image formats
    formats: ['image/webp'],

    // Minimum cache TTL (seconds)
    minimumCacheTTL: 60,

    // Disable static imports
    disableStaticImages: false,

    // Allow SVG images
    dangerouslyAllowSVG: false,

    // Content security policy for SVG
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",

    // Content disposition type
    contentDispositionType: 'inline',

    // Unoptimized mode
    unoptimized: false,
  },
}

module.exports = nextConfig
```

## Remote Patterns Configuration

Remote patterns provide fine-grained control over which external images can be optimized.

### Basic Remote Pattern

```javascript
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
      },
    ],
  },
}
```

### With Port and Pathname

```javascript
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
        port: '',
        pathname: '/images/**',
      },
    ],
  },
}
```

### Multiple Patterns

```javascript
const nextConfig = {
  images: {
    remotePatterns: [
      // Allow all images from example.com
      {
        protocol: 'https',
        hostname: 'example.com',
      },
      // Allow only /avatars/ from cdn.example.com
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
        pathname: '/avatars/**',
      },
      // Allow subdomains
      {
        protocol: 'https',
        hostname: '**.example.com',
      },
    ],
  },
}
```

### Wildcard Patterns

```javascript
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
        pathname: '/my-bucket/**',
      },
    ],
  },
}
```

## Domains Configuration (Deprecated)

**Note**: `domains` is deprecated in favor of `remotePatterns`.

```javascript
const nextConfig = {
  images: {
    domains: [
      'example.com',
      'cdn.example.com',
      'images.example.com',
    ],
  },
}
```

## Device Sizes and Image Sizes

Configure responsive image breakpoints:

```javascript
const nextConfig = {
  images: {
    // Breakpoints for srcset when using responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],

    // Smaller sizes for images with fixed sizes
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
}
```

How they're used:
- **deviceSizes**: Used for `layout="responsive"` or `layout="fill"`
- **imageSizes**: Used for `layout="fixed"` or `layout="intrinsic"`

## Image Formats

Configure which image formats to serve:

```javascript
const nextConfig = {
  images: {
    // Serve WebP and AVIF (if browser supports)
    formats: ['image/avif', 'image/webp'],
  },
}
```

Default format order:
1. AVIF (if in formats array and browser supports)
2. WebP (if in formats array and browser supports)
3. Original format

## Custom Loader

Use a custom image loader for external image optimization services:

```javascript
const nextConfig = {
  images: {
    loader: 'custom',
    loaderFile: './my-loader.js',
  },
}
```

Loader file (`my-loader.js`):

```javascript
export default function myImageLoader({ src, width, quality }) {
  return `https://example.com/${src}?w=${width}&q=${quality || 75}`
}
```

### Built-in Loaders

```javascript
const nextConfig = {
  images: {
    // Options: 'default', 'imgix', 'cloudinary', 'akamai', 'custom'
    loader: 'imgix',
  },
}
```

#### Imgix Loader

```javascript
const nextConfig = {
  images: {
    loader: 'imgix',
    path: 'https://example.imgix.net/',
  },
}
```

#### Cloudinary Loader

```javascript
const nextConfig = {
  images: {
    loader: 'cloudinary',
    path: 'https://res.cloudinary.com/demo/image/upload/',
  },
}
```

#### Akamai Loader

```javascript
const nextConfig = {
  images: {
    loader: 'akamai',
    path: 'https://example.com/',
  },
}
```

## Caching Configuration

```javascript
const nextConfig = {
  images: {
    // Minimum cache time in seconds (default: 60)
    minimumCacheTTL: 60,
  },
}
```

Cache behavior:
- Browser caches images based on `Cache-Control` headers
- Next.js sets `Cache-Control: public, max-age=60, must-revalidate`
- `minimumCacheTTL` sets the minimum cache duration

## SVG Support

```javascript
const nextConfig = {
  images: {
    // Allow SVG images (use with caution)
    dangerouslyAllowSVG: true,

    // Set CSP header for SVG to prevent XSS
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
}
```

**Warning**: SVGs can contain executable code. Only enable if you trust the source.

## Static Image Imports

```javascript
const nextConfig = {
  images: {
    // Disable static image imports
    disableStaticImages: false,
  },
}
```

When `false` (default), you can import images:

```javascript
import logo from './logo.png'

<Image src={logo} alt="Logo" />
```

## Unoptimized Mode

Disable image optimization entirely:

```javascript
const nextConfig = {
  images: {
    unoptimized: true,
  },
}
```

Use cases:
- Self-hosted images already optimized
- Using external optimization service
- Development/testing

## Content Disposition

```javascript
const nextConfig = {
  images: {
    // 'inline' (default) or 'attachment'
    contentDispositionType: 'attachment',
  },
}
```

- `inline`: Browser displays image
- `attachment`: Browser downloads image

## Complete Example

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false,
    contentDispositionType: 'inline',
  },
}

module.exports = nextConfig
```

## Environment-Specific Configuration

```javascript
const isDevelopment = process.env.NODE_ENV === 'development'

const nextConfig = {
  images: {
    // Disable optimization in development for faster builds
    unoptimized: isDevelopment,

    remotePatterns: [
      {
        protocol: 'https',
        hostname: isDevelopment ? 'dev-cdn.example.com' : 'cdn.example.com',
      },
    ],
  },
}
```

## Best Practices

1. **Use remotePatterns**: More secure and flexible than `domains`
2. **Specify pathname**: Limit optimization to specific paths
3. **Configure formats**: Use modern formats (AVIF, WebP) for better performance
4. **Set appropriate cache TTL**: Balance freshness and performance
5. **Be careful with SVG**: Only enable if you trust the source
6. **Optimize device sizes**: Match your actual breakpoints
7. **Use custom loaders**: For specialized CDN requirements

## Common Patterns

### S3/CloudFront Configuration

```javascript
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: '**.s3.amazonaws.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
}
```

### Multi-CDN Setup

```javascript
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn1.example.com' },
      { protocol: 'https', hostname: 'cdn2.example.com' },
      { protocol: 'https', hostname: 'images.example.com' },
    ],
  },
}
```

### Development vs Production

```javascript
const isDev = process.env.NODE_ENV !== 'production'

const nextConfig = {
  images: {
    unoptimized: isDev,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: isDev ? 'localhost' : 'cdn.example.com',
        port: isDev ? '3000' : '',
      },
    ],
  },
}
```

## Troubleshooting

### Images not loading
- Check remote pattern matches exactly
- Verify protocol, hostname, and pathname
- Check for CORS issues

### Slow image optimization
- Reduce `deviceSizes` and `imageSizes`
- Use external CDN with custom loader
- Consider `unoptimized: true` for pre-optimized images

### Large bundle size
- Enable `disableStaticImages` if importing many images
- Use remote images instead of static imports
