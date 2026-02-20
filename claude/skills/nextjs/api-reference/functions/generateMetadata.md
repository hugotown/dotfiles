# generateMetadata

The `generateMetadata()` function allows you to generate dynamic metadata for your pages, including title, description, Open Graph data, and more.

## Function Signature

```typescript
import { Metadata, ResolvingMetadata } from 'next'

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata>
```

## Parameters

### `props`
- **params**: Dynamic route parameters
- **searchParams**: URL search parameters

### `parent`
- **Type**: `ResolvingMetadata`
- **Description**: Promise that resolves to parent route segment metadata

## Return Value

Returns a `Metadata` object with page metadata.

## Metadata Object Fields

```typescript
type Metadata = {
  // Basic metadata
  title?: string | TemplateString
  description?: string
  keywords?: string | string[]
  authors?: Author | Author[]
  creator?: string
  publisher?: string
  category?: string

  // App metadata
  applicationName?: string
  generator?: string

  // Referrer
  referrer?: ReferrerEnum

  // Robots
  robots?: string | Robots

  // Open Graph
  openGraph?: OpenGraph

  // Twitter
  twitter?: Twitter

  // Icons
  icons?: Icons

  // Verification
  verification?: Verification

  // Alternates
  alternates?: Alternates

  // Manifest
  manifest?: string | URL

  // Other
  other?: Record<string, string>
}
```

## Usage Examples

### Basic Metadata

```typescript
// app/page.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Home',
  description: 'Welcome to my website'
}

export default function Page() {
  return <div>Home Page</div>
}
```

### Dynamic Metadata

```typescript
// app/posts/[id]/page.tsx
import { Metadata } from 'next'

type Props = {
  params: { id: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  const post = await getPost(params.id)

  return {
    title: post.title,
    description: post.excerpt
  }
}

export default function Page({ params }: Props) {
  return <div>Post {params.id}</div>
}
```

### With Parent Metadata

```typescript
import { Metadata, ResolvingMetadata } from 'next'

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const post = await getPost(params.id)

  // Optionally access and extend parent metadata
  const previousImages = (await parent).openGraph?.images || []

  return {
    title: post.title,
    openGraph: {
      images: [post.image, ...previousImages]
    }
  }
}
```

### Complete Example with All Fields

```typescript
import { Metadata } from 'next'

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const post = await getPost(params.slug)

  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.tags,
    authors: [
      { name: post.author.name, url: post.author.url }
    ],
    creator: post.author.name,
    publisher: 'My Blog',
    category: post.category,

    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://myblog.com/posts/${params.slug}`,
      siteName: 'My Blog',
      images: [
        {
          url: post.image,
          width: 1200,
          height: 630,
          alt: post.title
        }
      ],
      locale: 'en_US',
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author.name]
    },

    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [post.image],
      creator: '@myblog'
    },

    robots: {
      index: post.published,
      follow: post.published,
      nocache: !post.published
    },

    alternates: {
      canonical: `https://myblog.com/posts/${params.slug}`,
      languages: {
        'en-US': `https://myblog.com/en/posts/${params.slug}`,
        'es-ES': `https://myblog.com/es/posts/${params.slug}`
      }
    }
  }
}
```

### Open Graph Metadata

```typescript
export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const product = await getProduct(params.id)

  return {
    title: product.name,
    description: product.description,

    openGraph: {
      title: product.name,
      description: product.description,
      url: `https://shop.com/products/${params.id}`,
      siteName: 'My Shop',
      images: [
        {
          url: product.image,
          width: 1200,
          height: 630,
          alt: product.name
        }
      ],
      type: 'website'
    }
  }
}
```

### Twitter Card Metadata

```typescript
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const article = await getArticle(params.slug)

  return {
    title: article.title,

    twitter: {
      card: 'summary_large_image',
      site: '@mysite',
      creator: '@author',
      title: article.title,
      description: article.excerpt,
      images: [article.coverImage]
    }
  }
}
```

### Dynamic Title Template

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  title: {
    template: '%s | My Website',
    default: 'My Website'
  }
}

// app/about/page.tsx
export const metadata: Metadata = {
  title: 'About'  // Will become "About | My Website"
}

// app/posts/[id]/page.tsx
export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const post = await getPost(params.id)

  return {
    title: post.title  // Will become "Post Title | My Website"
  }
}
```

### Icons Metadata

```typescript
export const metadata: Metadata = {
  icons: {
    icon: '/favicon.ico',
    shortcut: '/shortcut-icon.png',
    apple: '/apple-icon.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/apple-touch-icon-precomposed.png'
    }
  }
}
```

### Verification Metadata

```typescript
export const metadata: Metadata = {
  verification: {
    google: 'google-site-verification-code',
    yandex: 'yandex-verification-code',
    yahoo: 'yahoo-verification-code',
    other: {
      me: ['my-email@example.com', 'https://example.com']
    }
  }
}
```

### Robots Metadata

```typescript
export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const post = await getPost(params.id)

  return {
    title: post.title,
    robots: {
      index: post.published,
      follow: post.published,
      nocache: !post.published,
      googleBot: {
        index: post.published,
        follow: post.published,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1
      }
    }
  }
}
```

### Alternate Languages

```typescript
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  return {
    alternates: {
      canonical: `https://example.com/${params.slug}`,
      languages: {
        'en-US': `https://example.com/en/${params.slug}`,
        'es-ES': `https://example.com/es/${params.slug}`,
        'fr-FR': `https://example.com/fr/${params.slug}`
      }
    }
  }
}
```

### Manifest

```typescript
export const metadata: Metadata = {
  manifest: '/manifest.json',
  applicationName: 'My App',
  appleWebApp: {
    capable: true,
    title: 'My App',
    statusBarStyle: 'black-translucent'
  }
}
```

### With Fallbacks

```typescript
export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  try {
    const post = await getPost(params.id)

    return {
      title: post.title,
      description: post.excerpt
    }
  } catch (error) {
    return {
      title: 'Post Not Found',
      description: 'The requested post could not be found'
    }
  }
}
```

### E-commerce Product

```typescript
export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const product = await getProduct(params.id)

  return {
    title: `${product.name} - $${product.price}`,
    description: product.description,
    keywords: product.tags,

    openGraph: {
      title: product.name,
      description: product.description,
      images: product.images.map(img => ({
        url: img.url,
        width: img.width,
        height: img.height,
        alt: product.name
      })),
      type: 'product',
      url: `https://shop.com/products/${params.id}`
    },

    other: {
      'product:price:amount': product.price.toString(),
      'product:price:currency': 'USD',
      'product:availability': product.inStock ? 'in stock' : 'out of stock'
    }
  }
}
```

### Article/Blog Post

```typescript
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const post = await getPost(params.slug)

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.author.name }],
    keywords: post.tags,

    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author.name],
      images: [
        {
          url: post.coverImage,
          width: 1200,
          height: 630,
          alt: post.title
        }
      ],
      url: `https://blog.com/posts/${params.slug}`
    },

    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage]
    }
  }
}
```

## Best Practices

1. **Always Provide Title and Description**
   ```typescript
   export async function generateMetadata(): Promise<Metadata> {
     return {
       title: 'Page Title',
       description: 'Page description for SEO'
     }
   }
   ```

2. **Use Title Templates**
   ```typescript
   // In layout.tsx
   export const metadata: Metadata = {
     title: {
       template: '%s | Site Name',
       default: 'Site Name'
     }
   }
   ```

3. **Include Open Graph for Social Sharing**
   ```typescript
   openGraph: {
     title: 'Title',
     description: 'Description',
     images: ['/og-image.jpg'],
     url: 'https://example.com'
   }
   ```

4. **Handle Missing Data Gracefully**
   ```typescript
   const post = await getPost(id)

   return {
     title: post?.title || 'Default Title',
     description: post?.excerpt || 'Default description'
   }
   ```

5. **Use Proper Image Dimensions**
   ```typescript
   openGraph: {
     images: [
       {
         url: '/og-image.jpg',
         width: 1200,
         height: 630,  // Recommended OG image size
         alt: 'Image description'
       }
     ]
   }
   ```

6. **Set Robots Correctly**
   ```typescript
   robots: {
     index: isPublished,
     follow: isPublished,
     nocache: isDraft
   }
   ```

## Common Patterns

### SEO-Optimized Blog

```typescript
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const post = await getPost(params.slug)

  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.tags.join(', '),
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      images: [post.image]
    },
    alternates: {
      canonical: `https://example.com/blog/${params.slug}`
    }
  }
}
```

### Multi-language Site

```typescript
export async function generateMetadata(
  { params }: { params: { lang: string; slug: string } }
): Promise<Metadata> {
  const page = await getPage(params.lang, params.slug)

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: `https://example.com/${params.lang}/${params.slug}`,
      languages: {
        'en': `/en/${params.slug}`,
        'es': `/es/${params.slug}`,
        'fr': `/fr/${params.slug}`
      }
    }
  }
}
```

## Notes

- `generateMetadata()` is only called on the server
- Returned metadata is automatically merged with parent metadata
- Static metadata (exported `metadata` constant) is preferred when possible
- Metadata is deduped automatically
- Only works in page and layout files
- Parent metadata is available via the `parent` parameter

## Related

- [generateViewport](./generateViewport.md) - Viewport configuration
- [generateStaticParams](./generateStaticParams.md) - Generate static params
- [Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) - Full documentation
