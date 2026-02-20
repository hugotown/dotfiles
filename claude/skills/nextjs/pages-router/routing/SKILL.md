---
name: pages-router-routing
description: Comprehensive guide to routing in Next.js Pages Router including file-based routing, dynamic routes, catch-all routes, linking, navigation, and API routes.
---

# Pages Router Routing

The Pages Router uses a file-system based routing mechanism where files in the `pages/` directory automatically become routes.

## File-Based Routing

### Basic Routes

Each file in the `pages/` directory maps to a route:

```
pages/
├── index.tsx              → /
├── about.tsx              → /about
├── contact.tsx            → /contact
└── blog/
    ├── index.tsx          → /blog
    └── first-post.tsx     → /blog/first-post
```

### Index Routes

Files named `index` map to the root of the directory:

```typescript
// pages/index.tsx → /
export default function HomePage() {
  return <h1>Home Page</h1>;
}

// pages/blog/index.tsx → /blog
export default function BlogIndex() {
  return <h1>Blog Index</h1>;
}
```

## Dynamic Routes

Dynamic route segments are created using square brackets `[param]`.

### Single Dynamic Route

```typescript
// pages/blog/[slug].tsx → /blog/:slug
import { useRouter } from 'next/router';
import { GetStaticProps, GetStaticPaths } from 'next';

interface Post {
  slug: string;
  title: string;
  content: string;
}

interface BlogPostProps {
  post: Post;
}

export default function BlogPost({ post }: BlogPostProps) {
  const router = useRouter();

  // Fallback handling
  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  // Fetch list of posts
  const posts = await fetchAllPosts();

  const paths = posts.map((post) => ({
    params: { slug: post.slug },
  }));

  return {
    paths,
    fallback: false, // or 'blocking' or true
  };
};

export const getStaticProps: GetStaticProps<BlogPostProps> = async ({ params }) => {
  const post = await fetchPost(params?.slug as string);

  return {
    props: {
      post,
    },
    revalidate: 60, // ISR: revalidate every 60 seconds
  };
};
```

### Multiple Dynamic Segments

```typescript
// pages/shop/[category]/[product].tsx → /shop/:category/:product
import { GetStaticProps, GetStaticPaths } from 'next';
import { ParsedUrlQuery } from 'querystring';

interface Params extends ParsedUrlQuery {
  category: string;
  product: string;
}

interface ProductProps {
  category: string;
  product: string;
  data: any;
}

export default function Product({ category, product, data }: ProductProps) {
  return (
    <div>
      <h1>Category: {category}</h1>
      <h2>Product: {product}</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths<Params> = async () => {
  const products = await fetchAllProducts();

  const paths = products.map((item) => ({
    params: {
      category: item.category,
      product: item.slug,
    },
  }));

  return { paths, fallback: 'blocking' };
};

export const getStaticProps: GetStaticProps<ProductProps, Params> = async ({
  params,
}) => {
  const data = await fetchProduct(params!.category, params!.product);

  return {
    props: {
      category: params!.category,
      product: params!.product,
      data,
    },
  };
};
```

## Catch-All Routes

Catch-all routes match all paths at a certain level.

### Basic Catch-All

```typescript
// pages/docs/[...slug].tsx → /docs/*, /docs/a, /docs/a/b, /docs/a/b/c
import { GetStaticProps, GetStaticPaths } from 'next';

interface DocsProps {
  slug: string[];
  content: string;
}

export default function Docs({ slug, content }: DocsProps) {
  return (
    <div>
      <nav>Path: {slug.join(' / ')}</nav>
      <article>{content}</article>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const docs = await fetchAllDocs();

  const paths = docs.map((doc) => ({
    params: { slug: doc.path.split('/') },
  }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps<DocsProps> = async ({ params }) => {
  const slug = params?.slug as string[];
  const content = await fetchDocContent(slug.join('/'));

  return {
    props: {
      slug,
      content,
    },
  };
};
```

### Optional Catch-All

Optional catch-all routes also match the route without any parameters:

```typescript
// pages/docs/[[...slug]].tsx → /docs, /docs/a, /docs/a/b
export default function Docs({ slug = [] }: { slug?: string[] }) {
  if (slug.length === 0) {
    return <div>Documentation Home</div>;
  }

  return (
    <div>
      <h1>{slug.join(' / ')}</h1>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = (params?.slug as string[]) || [];

  return {
    props: {
      slug,
    },
  };
};
```

## Linking and Navigation

### Link Component

The `Link` component enables client-side navigation:

```typescript
import Link from 'next/link';

export default function Navigation() {
  return (
    <nav>
      {/* Basic link */}
      <Link href="/">Home</Link>

      {/* Link with string interpolation */}
      <Link href="/blog/my-post">Blog Post</Link>

      {/* Link with object */}
      <Link
        href={{
          pathname: '/blog/[slug]',
          query: { slug: 'my-post' },
        }}
      >
        Blog Post
      </Link>

      {/* Link with hash */}
      <Link href="/about#team">About Team</Link>

      {/* External link (uses <a> tag) */}
      <a href="https://example.com" target="_blank" rel="noopener noreferrer">
        External Link
      </a>
    </nav>
  );
}
```

### Link Props

```typescript
import Link from 'next/link';

export default function AdvancedLinks() {
  return (
    <>
      {/* Replace history instead of push */}
      <Link href="/about" replace>
        About (Replace)
      </Link>

      {/* Scroll to top (default: true) */}
      <Link href="/blog" scroll={false}>
        Blog (No Scroll)
      </Link>

      {/* Prefetch (default: true in production) */}
      <Link href="/products" prefetch={false}>
        Products (No Prefetch)
      </Link>

      {/* Custom className and styling */}
      <Link href="/contact" className="nav-link">
        Contact
      </Link>

      {/* Passing props to child */}
      <Link href="/dashboard" legacyBehavior>
        <a className="custom-link">Dashboard</a>
      </Link>
    </>
  );
}
```

### Active Link Pattern

```typescript
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';

interface ActiveLinkProps {
  href: string;
  children: ReactNode;
  activeClassName?: string;
}

export function ActiveLink({
  href,
  children,
  activeClassName = 'active',
}: ActiveLinkProps) {
  const router = useRouter();
  const isActive = router.pathname === href;

  return (
    <Link href={href} className={isActive ? activeClassName : ''}>
      {children}
    </Link>
  );
}

// Usage
export default function Nav() {
  return (
    <nav>
      <ActiveLink href="/">Home</ActiveLink>
      <ActiveLink href="/about">About</ActiveLink>
      <ActiveLink href="/contact">Contact</ActiveLink>
    </nav>
  );
}
```

### Programmatic Navigation

Use the `useRouter` hook for programmatic navigation:

```typescript
import { useRouter } from 'next/router';
import { FormEvent } from 'react';

export default function SearchForm() {
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('query') as string;

    // Push new route
    await router.push(`/search?q=${encodeURIComponent(query)}`);

    // Or with object syntax
    await router.push({
      pathname: '/search',
      query: { q: query },
    });
  };

  const handleBack = () => {
    router.back(); // Go back
  };

  const handleReplace = () => {
    router.replace('/new-path'); // Replace current history entry
  };

  const handleReload = () => {
    router.reload(); // Reload current page
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="query" placeholder="Search..." />
      <button type="submit">Search</button>
      <button type="button" onClick={handleBack}>
        Back
      </button>
    </form>
  );
}
```

### Router Object

```typescript
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function RouterInfo() {
  const router = useRouter();

  useEffect(() => {
    console.log('Current pathname:', router.pathname); // /blog/[slug]
    console.log('Route:', router.route); // /blog/[slug]
    console.log('Query:', router.query); // { slug: 'my-post' }
    console.log('As path:', router.asPath); // /blog/my-post
    console.log('Base path:', router.basePath); // ''
    console.log('Locale:', router.locale); // 'en'
    console.log('Is ready:', router.isReady); // true when router is ready
    console.log('Is preview:', router.isPreview); // Preview mode status
  }, [router]);

  return <div>Check console for router info</div>;
}
```

### Route Change Events

```typescript
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function RouteChangeHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleStart = (url: string) => {
      console.log(`Loading: ${url}`);
    };

    const handleComplete = (url: string) => {
      console.log(`Finished loading: ${url}`);
    };

    const handleError = (err: Error, url: string) => {
      console.error(`Error loading ${url}:`, err);
    };

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleError);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleError);
    };
  }, [router]);

  return <div>Route change events are being logged</div>;
}
```

## API Routes

API routes provide a solution to build a public API with Next.js.

### Basic API Route

```typescript
// pages/api/hello.ts → /api/hello
import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  message: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({ message: 'Hello from Next.js!' });
}
```

### Dynamic API Routes

```typescript
// pages/api/posts/[id].ts → /api/posts/:id
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const post = await fetchPost(id as string);
    return res.status(200).json(post);
  }

  if (req.method === 'PUT') {
    const post = await updatePost(id as string, req.body);
    return res.status(200).json(post);
  }

  if (req.method === 'DELETE') {
    await deletePost(id as string);
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

### Catch-All API Routes

```typescript
// pages/api/[...path].ts → /api/*
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;

  // path is an array: /api/a/b/c → ['a', 'b', 'c']
  console.log('API path:', path);

  res.status(200).json({
    path,
    method: req.method,
  });
}
```

## Custom Error Pages

### 404 Page

```typescript
// pages/404.tsx
import Link from 'next/link';

export default function Custom404() {
  return (
    <div className="error-page">
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link href="/">Go back home</Link>
    </div>
  );
}
```

### 500 Page

```typescript
// pages/500.tsx
export default function Custom500() {
  return (
    <div className="error-page">
      <h1>500 - Server Error</h1>
      <p>Something went wrong on our end.</p>
    </div>
  );
}
```

### Custom Error Page

```typescript
// pages/_error.tsx
import { NextPageContext } from 'next';

interface ErrorProps {
  statusCode?: number;
}

function Error({ statusCode }: ErrorProps) {
  return (
    <div>
      <h1>
        {statusCode
          ? `An error ${statusCode} occurred on server`
          : 'An error occurred on client'}
      </h1>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
```

## Special Pages

### _app.tsx

Global app wrapper that persists across page navigations:

```typescript
// pages/_app.tsx
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from '../components/Layout';
import '../styles/globals.css';

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <QueryClientProvider client={queryClient}>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

### _document.tsx

Custom HTML document structure:

```typescript
// pages/_document.tsx
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#000000" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

## Middleware (Experimental in Pages Router)

```typescript
// middleware.ts (root level)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Redirect to login if not authenticated
  const isAuthenticated = request.cookies.get('auth-token');

  if (!isAuthenticated && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/dashboard/:path*',
};
```

## Internationalization (i18n)

### Configuration

```javascript
// next.config.js
module.exports = {
  i18n: {
    locales: ['en', 'fr', 'es'],
    defaultLocale: 'en',
    localeDetection: true,
  },
};
```

### Using Locale in Pages

```typescript
import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';

interface PageProps {
  translations: Record<string, string>;
}

export default function Page({ translations }: PageProps) {
  const router = useRouter();
  const { locale, locales, defaultLocale } = router;

  return (
    <div>
      <p>Current locale: {locale}</p>
      <p>Available locales: {locales?.join(', ')}</p>
      <h1>{translations.title}</h1>
    </div>
  );
}

export const getStaticProps: GetStaticProps<PageProps> = async ({ locale }) => {
  const translations = await import(`../locales/${locale}.json`);

  return {
    props: {
      translations: translations.default,
    },
  };
};
```

### Locale Switching

```typescript
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function LocaleSwitcher() {
  const router = useRouter();
  const { locales, locale: activeLocale } = router;

  return (
    <div>
      {locales?.map((locale) => (
        <Link
          key={locale}
          href={router.asPath}
          locale={locale}
          className={locale === activeLocale ? 'active' : ''}
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
```

## Best Practices

### 1. Route Organization

```
pages/
├── index.tsx                 # Home page
├── about.tsx                 # Static pages at root
├── contact.tsx
├── (auth)/                   # Group related pages
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
├── blog/                     # Blog section
│   ├── index.tsx            # Blog listing
│   ├── [slug].tsx           # Individual posts
│   └── category/
│       └── [name].tsx       # Category pages
└── api/                     # API routes
    ├── auth/
    │   └── [...nextauth].ts
    └── posts/
        ├── index.ts
        └── [id].ts
```

### 2. Route Naming

- Use kebab-case for file names: `blog-post.tsx`
- Use descriptive names: `product-details.tsx` not `pd.tsx`
- Group related routes in folders

### 3. Dynamic Route Patterns

- Use `[param]` for single segments
- Use `[...param]` for catch-all routes
- Use `[[...param]]` for optional catch-all
- Always validate params in `getStaticProps`/`getServerSideProps`

### 4. Link Optimization

- Always use `<Link>` for internal navigation
- Prefetching is automatic in production
- Disable prefetch for less important pages
- Use `replace` instead of `push` when appropriate

### 5. API Route Security

- Always validate request methods
- Implement authentication/authorization
- Sanitize and validate input data
- Use environment variables for secrets
- Set appropriate CORS headers

## Migration from Pages Router to App Router

### Route Comparison

```typescript
// Pages Router: pages/blog/[slug].tsx
export default function BlogPost({ post }) {
  return <article>{post.title}</article>;
}

export async function getStaticProps({ params }) {
  const post = await getPost(params.slug);
  return { props: { post } };
}

export async function getStaticPaths() {
  const posts = await getAllPosts();
  return {
    paths: posts.map((p) => ({ params: { slug: p.slug } })),
    fallback: false,
  };
}
```

```typescript
// App Router: app/blog/[slug]/page.tsx
export default async function BlogPost({ params }) {
  const post = await getPost(params.slug);
  return <article>{post.title}</article>;
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}
```

### Navigation Comparison

Both use the same `Link` component and `useRouter` hook, with minor API differences.

## Common Patterns

### Protected Routes

```typescript
// lib/withAuth.tsx
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';

export function withAuth(gssp: GetServerSideProps): GetServerSideProps {
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

    return gssp(context);
  };
}

// pages/dashboard.tsx
export const getServerSideProps = withAuth(async () => {
  // Your logic here
  return { props: {} };
});
```

### Breadcrumbs

```typescript
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Breadcrumbs() {
  const router = useRouter();
  const pathSegments = router.asPath.split('/').filter((segment) => segment);

  return (
    <nav aria-label="Breadcrumb">
      <ol>
        <li>
          <Link href="/">Home</Link>
        </li>
        {pathSegments.map((segment, index) => {
          const href = '/' + pathSegments.slice(0, index + 1).join('/');
          const isLast = index === pathSegments.length - 1;

          return (
            <li key={href}>
              {isLast ? (
                <span>{segment}</span>
              ) : (
                <Link href={href}>{segment}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

## Resources

- [Next.js Routing Documentation](https://nextjs.org/docs/pages/building-your-application/routing)
- [API Routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes)
- [Dynamic Routes](https://nextjs.org/docs/pages/building-your-application/routing/dynamic-routes)
