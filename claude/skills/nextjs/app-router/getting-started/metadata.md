# Metadata

Learn how to configure SEO metadata in Next.js App Router for better search engine optimization and social sharing.

## Static Metadata

Define metadata using the `metadata` export in layouts and pages.

### Basic Metadata

```javascript
// app/page.js
export const metadata = {
  title: 'Home | My App',
  description: 'Welcome to my application',
}

export default function Page() {
  return <h1>Home</h1>
}
```

### Complete Metadata Object

```javascript
// app/layout.js
export const metadata = {
  title: 'My App',
  description: 'A comprehensive application',
  keywords: ['nextjs', 'react', 'javascript'],
  authors: [{ name: 'John Doe', url: 'https://johndoe.com' }],
  creator: 'John Doe',
  publisher: 'My Company',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://myapp.com'),
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/en-US',
      'es-ES': '/es-ES',
    },
  },
  openGraph: {
    title: 'My App',
    description: 'A comprehensive application',
    url: 'https://myapp.com',
    siteName: 'My App',
    images: [
      {
        url: 'https://myapp.com/og.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My App',
    description: 'A comprehensive application',
    creator: '@johndoe',
    images: ['https://myapp.com/twitter.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/shortcut-icon.png',
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
}
```

## Template Metadata

Use templates to share common metadata structure:

```javascript
// app/layout.js
export const metadata = {
  title: {
    template: '%s | My App',
    default: 'My App',
  },
  description: 'My application',
}

// app/blog/page.js
export const metadata = {
  title: 'Blog', // Becomes "Blog | My App"
}

// app/about/page.js
export const metadata = {
  title: 'About', // Becomes "About | My App"
}
```

### Absolute Title

Override the template:

```javascript
export const metadata = {
  title: {
    absolute: 'Login', // Just "Login", ignores template
  },
}
```

## Dynamic Metadata

Generate metadata based on dynamic data using `generateMetadata`:

```javascript
// app/blog/[slug]/page.js
export async function generateMetadata({ params, searchParams }) {
  const post = await getPost(params.slug)

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [post.image],
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author.name],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [post.image],
    },
  }
}

export default async function BlogPost({ params }) {
  const post = await getPost(params.slug)

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
```

### With TypeScript

```typescript
// app/blog/[slug]/page.tsx
import { Metadata } from 'next'

interface PageProps {
  params: { slug: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await getPost(params.slug)

  return {
    title: post.title,
    description: post.excerpt,
  }
}

export default async function Page({ params }: PageProps) {
  const post = await getPost(params.slug)
  return <article>{post.content}</article>
}
```

## Open Graph Images

### Static OG Image

```javascript
export const metadata = {
  openGraph: {
    title: 'My Page',
    description: 'Page description',
    images: [
      {
        url: 'https://example.com/og.png',
        width: 1200,
        height: 630,
        alt: 'My Page OG Image',
      },
    ],
  },
}
```

### Dynamic OG Image

```javascript
export async function generateMetadata({ params }) {
  const product = await getProduct(params.id)

  return {
    openGraph: {
      title: product.name,
      description: product.description,
      images: [
        {
          url: product.image,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
    },
  }
}
```

### Generated OG Images (ImageResponse)

```javascript
// app/blog/[slug]/opengraph-image.js
import { ImageResponse } from 'next/og'

export const alt = 'Blog Post'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image({ params }) {
  const post = await getPost(params.slug)

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 64,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {post.title}
      </div>
    ),
    {
      ...size,
    }
  )
}
```

### Custom Fonts in OG Images

```javascript
import { ImageResponse } from 'next/og'

export default async function Image() {
  const fontData = await fetch(
    new URL('./Inter-Bold.ttf', import.meta.url)
  ).then((res) => res.arrayBuffer())

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 64,
          fontFamily: 'Inter',
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Hello World
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Inter',
          data: fontData,
          style: 'normal',
        },
      ],
    }
  )
}
```

## Favicon and Icons

### Static Icons

```javascript
// app/layout.js
export const metadata = {
  icons: {
    icon: '/favicon.ico',
    shortcut: '/shortcut-icon.png',
    apple: '/apple-icon.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/apple-touch-icon-precomposed.png',
    },
  },
}
```

### File-Based Icons

Create these files in the app directory:
- `app/favicon.ico`
- `app/icon.png`
- `app/apple-icon.png`

### Dynamic Icons

```javascript
// app/icon.js
import { ImageResponse } from 'next/og'

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
          background: 'blue',
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

## Robots.txt

### Static robots.txt

```javascript
// app/robots.js
export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
    sitemap: 'https://myapp.com/sitemap.xml',
  }
}
```

### Multiple Rules

```javascript
export default function robots() {
  return {
    rules: [
      {
        userAgent: 'Googlebot',
        allow: ['/'],
        disallow: ['/admin/'],
      },
      {
        userAgent: ['Applebot', 'Bingbot'],
        disallow: ['/'],
      },
    ],
    sitemap: 'https://myapp.com/sitemap.xml',
  }
}
```

## Sitemap

### Static Sitemap

```javascript
// app/sitemap.js
export default function sitemap() {
  return [
    {
      url: 'https://myapp.com',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    {
      url: 'https://myapp.com/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://myapp.com/blog',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ]
}
```

### Dynamic Sitemap

```javascript
// app/sitemap.js
export default async function sitemap() {
  const posts = await getPosts()

  const postEntries = posts.map((post) => ({
    url: `https://myapp.com/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [
    {
      url: 'https://myapp.com',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    ...postEntries,
  ]
}
```

## Canonical URLs

```javascript
// app/blog/[slug]/page.js
export async function generateMetadata({ params }) {
  return {
    alternates: {
      canonical: `/blog/${params.slug}`,
    },
  }
}
```

## Metadata Inheritance

Metadata is inherited from parent layouts:

```javascript
// app/layout.js
export const metadata = {
  title: {
    template: '%s | My App',
    default: 'My App',
  },
  description: 'Default description',
}

// app/blog/layout.js
export const metadata = {
  description: 'Read our blog posts', // Overrides parent
  // title template is inherited
}

// app/blog/[slug]/page.js
export const metadata = {
  title: 'Post Title', // Uses template from root layout
  // description is inherited from blog layout
}
```

## JSON-LD Structured Data

```javascript
// app/blog/[slug]/page.js
export async function generateMetadata({ params }) {
  const post = await getPost(params.slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    image: post.image,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author.name,
    },
  }

  return {
    title: post.title,
    description: post.excerpt,
    other: {
      'script:ld+json': JSON.stringify(jsonLd),
    },
  }
}

export default function BlogPost({ params }) {
  return <article>...</article>
}
```

Or add it directly to the page:

```javascript
export default async function BlogPost({ params }) {
  const post = await getPost(params.slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>{post.content}</article>
    </>
  )
}
```

## Viewport and Theme Color

```javascript
// app/layout.js
export const metadata = {
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}
```

## Verification

```javascript
export const metadata = {
  verification: {
    google: 'google-site-verification-code',
    yandex: 'yandex-verification-code',
    other: {
      me: ['email@example.com', 'https://example.com'],
    },
  },
}
```

## Best Practices

1. **Use metadata templates** - Consistent titles across pages
2. **Set meaningful descriptions** - 150-160 characters for SEO
3. **Configure Open Graph** - Better social media sharing
4. **Add Twitter Cards** - Optimized Twitter previews
5. **Generate dynamic OG images** - Unique images per page
6. **Use canonical URLs** - Prevent duplicate content issues
7. **Create sitemaps** - Help search engines discover content
8. **Add structured data** - Rich search results
9. **Set proper robots** - Control search engine crawling
10. **Optimize for mobile** - Set viewport metadata

## Common Pitfalls

1. **Forgetting metadata base** - Relative URLs won't work
2. **Not using templates** - Duplicated title strings
3. **Missing OG images** - Poor social sharing experience
4. **Too long descriptions** - Truncated in search results
5. **Not setting canonical** - SEO duplicate content issues
6. **Missing alt text** - Accessibility and SEO issues
7. **Hardcoding URLs** - Issues in different environments
8. **Not updating sitemap** - Missing new pages
9. **Ignoring Twitter cards** - Missed Twitter optimization
10. **No structured data** - Missing rich results

## SEO Checklist

- [ ] Set meaningful titles (50-60 characters)
- [ ] Write compelling descriptions (150-160 characters)
- [ ] Configure Open Graph metadata
- [ ] Add Twitter Card metadata
- [ ] Set canonical URLs
- [ ] Create favicon and app icons
- [ ] Generate sitemap.xml
- [ ] Configure robots.txt
- [ ] Add structured data (JSON-LD)
- [ ] Set viewport metadata
- [ ] Configure theme colors
- [ ] Add verification codes
- [ ] Test with social media debuggers
- [ ] Validate with Google Search Console
- [ ] Check mobile-friendliness
