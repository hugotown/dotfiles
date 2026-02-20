# Metadata & SEO Optimization

Next.js provides a Metadata API for defining SEO-friendly metadata in your application, supporting both static and dynamic metadata generation.

## Core Concepts

### Metadata Object

Export a `metadata` object from any layout or page:

```tsx
// app/layout.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My App',
  description: 'My app description',
}

export default function RootLayout({ children }) {
  return <html>{children}</html>
}
```

### generateMetadata Function

For dynamic metadata based on params or data:

```tsx
// app/blog/[slug]/page.tsx
import { Metadata } from 'next'

export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.slug)

  return {
    title: post.title,
    description: post.excerpt,
  }
}

export default function Page({ params }) {
  // Page component
}
```

## Basic Metadata

### Title

```tsx
import { Metadata } from 'next'

// Simple string
export const metadata: Metadata = {
  title: 'My Page Title',
}

// With template
export const metadata: Metadata = {
  title: {
    default: 'My App',
    template: '%s | My App', // Creates "Page Title | My App"
  },
}
```

### Description

```tsx
export const metadata: Metadata = {
  description: 'A comprehensive description of my page for search engines',
}
```

### Keywords

```tsx
export const metadata: Metadata = {
  keywords: ['next.js', 'react', 'javascript', 'typescript'],
}
```

### Authors

```tsx
export const metadata: Metadata = {
  authors: [
    { name: 'John Doe', url: 'https://example.com' },
    { name: 'Jane Smith' },
  ],
}
```

### Creator & Publisher

```tsx
export const metadata: Metadata = {
  creator: 'John Doe',
  publisher: 'Acme Inc',
}
```

## Open Graph

For social media sharing (Facebook, LinkedIn, etc.):

```tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  openGraph: {
    title: 'My Page Title',
    description: 'Page description for social sharing',
    url: 'https://example.com',
    siteName: 'My Site',
    images: [
      {
        url: 'https://example.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'My OG Image',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
}
```

### Open Graph Article

```tsx
export const metadata: Metadata = {
  openGraph: {
    type: 'article',
    title: 'Article Title',
    description: 'Article description',
    publishedTime: '2024-01-01T00:00:00.000Z',
    modifiedTime: '2024-01-02T00:00:00.000Z',
    authors: ['John Doe', 'Jane Smith'],
    tags: ['technology', 'web development'],
    images: [
      {
        url: 'https://example.com/article-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
  },
}
```

## Twitter Cards

```tsx
export const metadata: Metadata = {
  twitter: {
    card: 'summary_large_image',
    title: 'My Page Title',
    description: 'Page description for Twitter',
    creator: '@username',
    images: ['https://example.com/twitter-image.jpg'],
  },
}
```

### Twitter Card Types

```tsx
// Large image card
export const metadata: Metadata = {
  twitter: {
    card: 'summary_large_image',
    title: 'Title',
    description: 'Description',
    images: ['https://example.com/large.jpg'],
  },
}

// Summary card
export const metadata: Metadata = {
  twitter: {
    card: 'summary',
    title: 'Title',
    description: 'Description',
    images: ['https://example.com/small.jpg'],
  },
}

// App card
export const metadata: Metadata = {
  twitter: {
    card: 'app',
    title: 'App Title',
    description: 'App Description',
    app: {
      id: {
        iphone: '123456789',
        ipad: '123456789',
        googleplay: 'com.example.app',
      },
    },
  },
}
```

## Dynamic Metadata

### Using Route Parameters

```tsx
// app/products/[id]/page.tsx
import { Metadata } from 'next'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.id)

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: [product.image],
      type: 'product',
    },
  }
}

export default function ProductPage({ params }: Props) {
  // Component
}
```

### Using Search Params

```tsx
// app/search/page.tsx
import { Metadata } from 'next'

interface Props {
  searchParams: { q: string }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = searchParams.q

  return {
    title: `Search Results for "${query}"`,
    description: `Find ${query} on our site`,
  }
}

export default function SearchPage({ searchParams }: Props) {
  // Component
}
```

### Fetching External Data

```tsx
// app/blog/[slug]/page.tsx
import { Metadata } from 'next'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Fetch data
  const post = await fetch(`https://api.example.com/posts/${params.slug}`)
    .then((res) => res.json())

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      images: [
        {
          url: post.coverImage,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage],
    },
  }
}
```

## JSON-LD Structured Data

### Article Schema

```tsx
export default function BlogPost({ post }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author.name,
      url: post.author.url,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>{/* Article content */}</article>
    </>
  )
}
```

### Product Schema

```tsx
export default function Product({ product }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images,
    sku: product.sku,
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `https://example.com/products/${product.id}`,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div>{/* Product content */}</div>
    </>
  )
}
```

### Organization Schema

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'My Company',
    url: 'https://example.com',
    logo: 'https://example.com/logo.png',
    sameAs: [
      'https://twitter.com/mycompany',
      'https://facebook.com/mycompany',
      'https://linkedin.com/company/mycompany',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-555-555-5555',
      contactType: 'Customer Service',
    },
  }

  return (
    <html>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  )
}
```

### Breadcrumb Schema

```tsx
export default function Page({ breadcrumbs }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `https://example.com${item.path}`,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav>{/* Breadcrumb UI */}</nav>
    </>
  )
}
```

## Robots & Indexing

### Robots Meta

```tsx
export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}
```

### No Index Example

```tsx
// app/admin/layout.tsx
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}
```

## Canonical URLs

```tsx
export const metadata: Metadata = {
  alternates: {
    canonical: 'https://example.com/page',
  },
}
```

### With Language Alternates

```tsx
export const metadata: Metadata = {
  alternates: {
    canonical: 'https://example.com/page',
    languages: {
      'en-US': 'https://example.com/en/page',
      'es-ES': 'https://example.com/es/page',
      'fr-FR': 'https://example.com/fr/page',
    },
  },
}
```

## Icons & Favicons

### Basic Icons

```tsx
export const metadata: Metadata = {
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
}
```

### Multiple Icons

```tsx
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/icon.png' },
      { url: '/icon-dark.png', media: '(prefers-color-scheme: dark)' },
    ],
    apple: [
      { url: '/apple-icon.png' },
      { url: '/apple-icon-x3.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/apple-touch-icon-precomposed.png',
      },
    ],
  },
}
```

## Manifest

```tsx
export const metadata: Metadata = {
  manifest: '/manifest.json',
}
```

## Viewport

```tsx
export const metadata: Metadata = {
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
}
```

## Verification

```tsx
export const metadata: Metadata = {
  verification: {
    google: 'google-site-verification-code',
    yandex: 'yandex-verification-code',
    yahoo: 'yahoo-verification-code',
    other: {
      me: ['my-email@example.com', 'https://example.com'],
    },
  },
}
```

## Complete Example

```tsx
// app/blog/[slug]/page.tsx
import { Metadata } from 'next'

interface Props {
  params: { slug: string }
}

async function getPost(slug: string) {
  const res = await fetch(`https://api.example.com/posts/${slug}`)
  return res.json()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug)

  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.tags,
    authors: [{ name: post.author.name, url: post.author.url }],
    creator: post.author.name,
    publisher: 'My Blog',

    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://example.com/blog/${params.slug}`,
      siteName: 'My Blog',
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author.name],
      tags: post.tags,
      images: [
        {
          url: post.coverImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },

    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      creator: `@${post.author.twitter}`,
      images: [post.coverImage],
    },

    alternates: {
      canonical: `https://example.com/blog/${params.slug}`,
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
  }
}

export default async function BlogPost({ params }: Props) {
  const post = await getPost(params.slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author.name,
      url: post.author.url,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>
        <h1>{post.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>
    </>
  )
}
```

## Best Practices

1. **Use Title Templates**: Create consistent titles across pages
2. **Unique Descriptions**: Write unique descriptions for each page
3. **Optimize for Social**: Include Open Graph and Twitter Card data
4. **Add Structured Data**: Use JSON-LD for rich search results
5. **Set Canonical URLs**: Prevent duplicate content issues
6. **Control Indexing**: Use robots meta appropriately
7. **Dynamic Metadata**: Generate metadata based on content
8. **Image Optimization**: Use proper dimensions for social images (1200x630)

## Testing Tools

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)

## Resources

- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Schema.org](https://schema.org/)
