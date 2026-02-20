# Metadata Files

Metadata files are special files in Next.js that configure app icons, Open Graph images, and other metadata. These files are automatically processed and optimized.

## App Icons

### favicon.ico

```
app/
└── favicon.ico
```

Basic favicon file placed in the `app` directory.

**Supported formats:** `.ico`

**Generated HTML:**

```html
<link rel="icon" href="/favicon.ico" sizes="any" />
```

### icon

Image files that serve as app icons.

```
app/
├── icon.png
├── icon.jpg
├── icon.svg
└── icon.ico
```

**Supported formats:** `.ico`, `.jpg`, `.jpeg`, `.png`, `.svg`

**Multiple icons:**

```
app/
├── icon1.png
├── icon2.png
└── icon3.png
```

**Generated HTML:**

```html
<link rel="icon" href="/icon.png?v=1" type="image/png" sizes="32x32" />
```

### icon with Route Segment Config

Generate icons dynamically:

```tsx
// app/icon.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        A
      </div>
    ),
    {
      ...size,
    }
  )
}
```

### apple-icon

Apple-specific touch icons.

```
app/
├── apple-icon.png
├── apple-icon.jpg
└── apple-icon.jpeg
```

**Supported formats:** `.jpg`, `.jpeg`, `.png`

**Generated HTML:**

```html
<link rel="apple-touch-icon" href="/apple-icon.png" type="image/png" sizes="180x180" />
```

**Dynamic generation:**

```tsx
// app/apple-icon.tsx
import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 88,
          background: '#000',
          color: '#fff',
        }}
      >
        App
      </div>
    ),
    {
      ...size,
    }
  )
}
```

## Open Graph Images

### opengraph-image

Open Graph images for social media sharing.

```
app/
├── opengraph-image.png
├── opengraph-image.jpg
└── opengraph-image.gif
```

**Supported formats:** `.jpg`, `.jpeg`, `.png`, `.gif`

**Generated HTML:**

```html
<meta property="og:image" content="/opengraph-image.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

**Dynamic generation:**

```tsx
// app/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'About Acme'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        About Acme
      </div>
    ),
    {
      ...size,
    }
  )
}
```

**Route-specific images:**

```
app/
├── opengraph-image.png        # Default
└── about/
    └── opengraph-image.png    # /about specific
```

### Dynamic OG Images with Data

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Blog Post'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 48,
          background: 'linear-gradient(to bottom, #0066cc, #003d7a)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          padding: '40px',
        }}
      >
        <h1 style={{ fontSize: 72, fontWeight: 'bold', marginBottom: 20 }}>
          {post.title}
        </h1>
        <p style={{ fontSize: 32, opacity: 0.8 }}>{post.excerpt}</p>
      </div>
    ),
    {
      ...size,
    }
  )
}

async function getPost(slug: string) {
  // Fetch post data
  return {
    title: 'Sample Post',
    excerpt: 'This is a sample post excerpt',
  }
}
```

## Twitter Images

### twitter-image

Twitter-specific card images.

```
app/
├── twitter-image.png
├── twitter-image.jpg
└── twitter-image.gif
```

**Supported formats:** `.jpg`, `.jpeg`, `.png`, `.gif`

**Generated HTML:**

```html
<meta name="twitter:image" content="/twitter-image.png" />
<meta name="twitter:image:type" content="image/png" />
<meta name="twitter:image:width" content="1200" />
<meta name="twitter:image:height" content="630" />
```

**Dynamic generation:**

```tsx
// app/twitter-image.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Acme'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Acme
      </div>
    ),
    {
      ...size,
    }
  )
}
```

## SEO Files

### robots.txt

Configure web crawler access.

**Static file:**

```
# app/robots.txt
User-agent: *
Allow: /
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
```

**Dynamic generation:**

```ts
// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
    sitemap: 'https://acme.com/sitemap.xml',
  }
}
```

**Multiple user agents:**

```ts
// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: 'Googlebot',
        allow: ['/'],
        disallow: ['/private/'],
      },
      {
        userAgent: ['Applebot', 'Bingbot'],
        disallow: ['/'],
      },
    ],
    sitemap: 'https://acme.com/sitemap.xml',
  }
}
```

### sitemap.xml

Define site structure for search engines.

**Static file:**

```xml
<!-- app/sitemap.xml -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com</loc>
    <lastmod>2024-01-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2024-01-01</lastmod>
  </url>
</urlset>
```

**Dynamic generation:**

```ts
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://acme.com',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    {
      url: 'https://acme.com/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://acme.com/blog',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ]
}
```

**Dynamic sitemap with data:**

```ts
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts()

  const postUrls = posts.map((post) => ({
    url: `https://acme.com/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [
    {
      url: 'https://acme.com',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    ...postUrls,
  ]
}

async function getAllPosts() {
  // Fetch posts from database
  return []
}
```

**Multiple sitemaps:**

```ts
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://acme.com',
      lastModified: new Date(),
    },
  ]
}
```

```ts
// app/blog/sitemap.ts
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts()

  return posts.map((post) => ({
    url: `https://acme.com/blog/${post.slug}`,
    lastModified: post.publishedAt,
  }))
}
```

## Manifest File

### manifest.json / manifest.webmanifest

Web app manifest for Progressive Web Apps (PWA).

**Static file:**

```json
{
  "name": "My Next.js App",
  "short_name": "Next App",
  "description": "An application built with Next.js",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Dynamic generation:**

```ts
// app/manifest.ts
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Next.js App',
    short_name: 'Next.js',
    description: 'Next.js App',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff',
    theme_color: '#fff',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
```

## File Naming Conventions

Metadata files support numbered suffixes for multiple instances:

```
app/
├── icon1.png
├── icon2.png
├── apple-icon1.png
├── apple-icon2.png
├── opengraph-image1.png
└── opengraph-image2.png
```

## Route Segment Config

Dynamic metadata files can export configuration:

```tsx
export const runtime = 'edge' // 'edge' | 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Image description'
```

## Version History

- **v13.3.0**: Metadata files introduced
- **v13.4.0**: App Router stable
- **v14.0.0**: Enhanced metadata API

## Good to Know

- Metadata files are automatically optimized
- Static files take precedence over dynamic generation
- Can be placed in any route segment
- Support both static and dynamic generation
- OG images have recommended size: 1200x630
- Twitter images have recommended size: 1200x630
- App icons recommended: 180x180 (Apple), 32x32 (favicon)
- Use `.tsx` for dynamic generation
- Generated files are cached
- Can export route segment config options
