---
name: building-with-pages-router
description: Documents Next.js Pages Router for legacy applications including page-based routing, data fetching with getStaticProps/getServerSideProps, and API routes. Use when maintaining Pages Router projects or migrating to App Router.
---

# Next.js Pages Router

The Pages Router is the traditional routing system in Next.js, used in versions prior to Next.js 13's App Router. While the App Router is now recommended for new projects, the Pages Router remains widely used in production applications and is fully supported.

## Overview

The Pages Router uses a file-system based routing mechanism where files in the `pages/` directory automatically become routes. Each file exports a React component that represents a page.

## Key Concepts

### 1. File-Based Routing

Files in the `pages/` directory map to URL routes:

```
pages/
├── index.js          → /
├── about.js          → /about
├── blog/
│   ├── index.js      → /blog
│   └── [slug].js     → /blog/:slug
└── api/
    └── hello.js      → /api/hello
```

### 2. Special Files

- **_app.js**: Custom App component that initializes pages
- **_document.js**: Custom Document for server-side rendering markup
- **_error.js**: Custom error page
- **404.js**: Custom 404 page
- **500.js**: Custom 500 error page

### 3. Data Fetching Methods

The Pages Router provides specific methods for data fetching:

- `getStaticProps`: Fetch data at build time (SSG)
- `getStaticPaths`: Define dynamic routes for SSG
- `getServerSideProps`: Fetch data on each request (SSR)
- `getInitialProps`: Legacy data fetching (not recommended)

### 4. Rendering Strategies

- **Static Site Generation (SSG)**: Pre-render at build time
- **Server-Side Rendering (SSR)**: Render on each request
- **Incremental Static Regeneration (ISR)**: Update static pages after build
- **Client-Side Rendering (CSR)**: Render in the browser
- **Automatic Static Optimization**: Automatically static when no server-side data

## Basic Page Example

```typescript
// pages/index.tsx
import { GetStaticProps } from 'next';
import Head from 'next/head';

interface HomeProps {
  title: string;
  description: string;
}

export default function Home({ title, description }: HomeProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Head>
      <main>
        <h1>{title}</h1>
        <p>{description}</p>
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  return {
    props: {
      title: 'Welcome to Next.js',
      description: 'A React framework for production',
    },
  };
};
```

## Custom App (_app.js)

The `_app.js` file is used to override the default App component and persist layout across page changes:

```typescript
// pages/_app.tsx
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import '../styles/globals.css';

export default function App({
  Component,
  pageProps: { session, ...pageProps }
}: AppProps) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
```

### Common Use Cases for _app.js

- Global CSS imports
- Layout persistence
- Global state management
- Error boundaries
- Analytics integration
- Authentication providers

## Custom Document (_document.js)

The `_document.js` file augments the HTML document structure:

```typescript
// pages/_document.tsx
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

### Important Notes on _document.js

- Only runs on the server
- Cannot include application logic or event handlers
- Used to augment `<html>` and `<body>` tags
- Typically used for custom fonts, meta tags, or third-party scripts

## Environment and Configuration

### Environment Variables

```javascript
// next.config.js
module.exports = {
  env: {
    CUSTOM_KEY: 'my-value',
  },
};
```

Access in pages:

```javascript
export default function Page() {
  return <div>{process.env.CUSTOM_KEY}</div>;
}
```

### Next.js Config

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['example.com'],
  },
  i18n: {
    locales: ['en', 'fr', 'de'],
    defaultLocale: 'en',
  },
};

module.exports = nextConfig;
```

## Built-in Components

### Link Component

```typescript
import Link from 'next/link';

export default function Navigation() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
      <Link href="/blog/[slug]" as="/blog/hello-world">
        Blog Post
      </Link>
    </nav>
  );
}
```

### Image Component

```typescript
import Image from 'next/image';

export default function ProfilePic() {
  return (
    <Image
      src="/profile.jpg"
      alt="Profile Picture"
      width={500}
      height={500}
      priority
    />
  );
}
```

### Head Component

```typescript
import Head from 'next/head';

export default function Page() {
  return (
    <>
      <Head>
        <title>Page Title</title>
        <meta name="description" content="Page description" />
        <meta property="og:title" content="Page Title" />
      </Head>
      <main>Page content</main>
    </>
  );
}
```

## TypeScript Support

### Page Props Types

```typescript
import { GetStaticProps, GetStaticPaths, GetServerSideProps } from 'next';
import { ParsedUrlQuery } from 'querystring';

interface PageProps {
  data: string;
}

interface PageParams extends ParsedUrlQuery {
  slug: string;
}

export const getStaticProps: GetStaticProps<PageProps, PageParams> = async (context) => {
  const { params } = context;

  return {
    props: {
      data: `Data for ${params?.slug}`,
    },
  };
};

export const getStaticPaths: GetStaticPaths<PageParams> = async () => {
  return {
    paths: [
      { params: { slug: 'hello' } },
      { params: { slug: 'world' } },
    ],
    fallback: false,
  };
};
```

### API Route Types

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';

type Data = {
  message: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  res.status(200).json({ message: 'Hello from Next.js!' });
}
```

## Best Practices

### 1. Data Fetching

- Use `getStaticProps` for pages that can be pre-rendered
- Use `getServerSideProps` only when you need request-time data
- Prefer ISR over SSR when possible for better performance
- Use client-side fetching for user-specific or frequently changing data

### 2. Performance

- Optimize images with the Next.js Image component
- Use dynamic imports for code splitting
- Implement proper caching strategies
- Minimize client-side JavaScript

### 3. SEO

- Use the Head component for meta tags
- Implement proper Open Graph tags
- Generate sitemaps for static pages
- Use structured data when appropriate

### 4. Code Organization

```
pages/
├── _app.tsx           # Global app wrapper
├── _document.tsx      # HTML document structure
├── index.tsx          # Home page
├── about.tsx          # About page
├── api/               # API routes
│   └── auth/
│       └── [...nextauth].ts
└── [category]/        # Dynamic routes
    ├── index.tsx
    └── [slug].tsx

components/            # Shared components
├── Layout.tsx
├── Header.tsx
└── Footer.tsx

lib/                   # Utility functions
├── api.ts
└── utils.ts

styles/                # Stylesheets
├── globals.css
└── Home.module.css
```

## Migration to App Router

When migrating from Pages Router to App Router, consider:

### Key Differences

1. **File conventions**: `page.js` instead of individual files
2. **Data fetching**: Server Components with async/await instead of `getStaticProps`
3. **Layouts**: Built-in layout support with `layout.js`
4. **Loading states**: `loading.js` for Suspense boundaries
5. **Error handling**: `error.js` for error boundaries

### Migration Strategy

```typescript
// Pages Router (pages/blog/[slug].tsx)
export default function BlogPost({ post }) {
  return <article>{post.title}</article>;
}

export async function getStaticProps({ params }) {
  const post = await fetchPost(params.slug);
  return { props: { post } };
}

export async function getStaticPaths() {
  const posts = await fetchAllPosts();
  return {
    paths: posts.map((post) => ({
      params: { slug: post.slug },
    })),
    fallback: false,
  };
}
```

```typescript
// App Router (app/blog/[slug]/page.tsx)
export default async function BlogPost({ params }) {
  const post = await fetchPost(params.slug);
  return <article>{post.title}</article>;
}

export async function generateStaticParams() {
  const posts = await fetchAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}
```

### Incremental Migration

You can run both routers simultaneously:

```javascript
// next.config.js
module.exports = {
  experimental: {
    appDir: true, // Enable App Router
  },
};
```

The App Router (in `app/`) takes precedence over Pages Router (in `pages/`) for matching routes.

## Common Patterns

### Layout Pattern

```typescript
// components/Layout.tsx
import { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}

// pages/_app.tsx
import Layout from '../components/Layout';

export default function App({ Component, pageProps }) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
```

### Per-Page Layouts

```typescript
// pages/index.tsx
import { ReactElement } from 'react';
import Layout from '../components/Layout';
import type { NextPageWithLayout } from './_app';

const Home: NextPageWithLayout = () => {
  return <div>Home Page</div>;
};

Home.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default Home;

// pages/_app.tsx
import { ReactElement, ReactNode } from 'react';
import type { NextPage } from 'next';
import type { AppProps } from 'next/app';

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

export default function App({ Component, pageProps }: AppPropsWithLayout) {
  const getLayout = Component.getLayout ?? ((page) => page);
  return getLayout(<Component {...pageProps} />);
}
```

### Authentication Pattern

```typescript
// lib/auth.ts
import { GetServerSideProps } from 'next';

export function withAuth(getServerSidePropsFunc?: GetServerSideProps) {
  return async (context) => {
    const session = await getSession(context);

    if (!session) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }

    if (getServerSidePropsFunc) {
      return getServerSidePropsFunc(context);
    }

    return {
      props: { session },
    };
  };
}

// pages/dashboard.tsx
export const getServerSideProps = withAuth(async (context) => {
  const data = await fetchDashboardData();
  return {
    props: { data },
  };
});
```

## Related Skills

- [Routing](/skills/nextjs/pages-router/routing/SKILL.md) - Detailed routing patterns
- [Rendering](/skills/nextjs/pages-router/rendering/SKILL.md) - Rendering strategies
- [Data Fetching](/skills/nextjs/pages-router/data-fetching/SKILL.md) - Data fetching methods
- [API Routes](/skills/nextjs/pages-router/api-routes/SKILL.md) - Building API endpoints

## Resources

- [Next.js Pages Router Documentation](https://nextjs.org/docs/pages)
- [Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [TypeScript with Pages Router](https://nextjs.org/docs/pages/building-your-application/configuring/typescript)
