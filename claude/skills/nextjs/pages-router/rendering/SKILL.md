---
name: pages-router-rendering
description: Complete guide to rendering strategies in Next.js Pages Router including SSG, SSR, ISR, CSR, and Automatic Static Optimization with performance optimization techniques.
---

# Pages Router Rendering Strategies

Next.js Pages Router provides multiple rendering strategies to optimize performance and user experience. Understanding when and how to use each strategy is crucial for building performant applications.

## Overview

Next.js supports five main rendering strategies:

1. **Static Site Generation (SSG)** - Pre-render at build time
2. **Server-Side Rendering (SSR)** - Render on each request
3. **Incremental Static Regeneration (ISR)** - Update static content after build
4. **Client-Side Rendering (CSR)** - Render in the browser
5. **Automatic Static Optimization** - Automatically static when possible

## Static Site Generation (SSG)

SSG pre-renders pages at build time. The HTML is generated once and reused for each request.

### Basic SSG with getStaticProps

```typescript
import { GetStaticProps } from 'next';

interface Post {
  id: string;
  title: string;
  content: string;
}

interface HomeProps {
  posts: Post[];
}

export default function Home({ posts }: HomeProps) {
  return (
    <div>
      <h1>Blog Posts</h1>
      {posts.map((post) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  // Fetch data from API, database, or file system
  const posts = await fetchPosts();

  return {
    props: {
      posts,
    },
  };
};
```

### When to Use SSG

Use SSG when:

- The page can be pre-rendered ahead of a user's request
- The data is available at build time
- The page is the same for all users
- The page should be SEO-friendly and very fast

**Examples**: Marketing pages, blog posts, documentation, product listings

### SSG with External Data

```typescript
import { GetStaticProps } from 'next';
import { fetchFromAPI, fetchFromDatabase, readFromFileSystem } from '../lib/data';

interface PageProps {
  apiData: any;
  dbData: any;
  fileData: any;
}

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  // Fetch from external API
  const apiData = await fetchFromAPI('https://api.example.com/data');

  // Fetch from database
  const dbData = await fetchFromDatabase();

  // Read from file system
  const fileData = await readFromFileSystem('./content/data.json');

  return {
    props: {
      apiData,
      dbData,
      fileData,
    },
  };
};

export default function Page({ apiData, dbData, fileData }: PageProps) {
  return <div>{/* Render your data */}</div>;
}
```

### Dynamic SSG with getStaticPaths

For dynamic routes, use `getStaticPaths` to specify which paths to pre-render:

```typescript
import { GetStaticProps, GetStaticPaths } from 'next';
import { ParsedUrlQuery } from 'querystring';

interface Post {
  slug: string;
  title: string;
  content: string;
  publishedAt: string;
}

interface Params extends ParsedUrlQuery {
  slug: string;
}

interface PostProps {
  post: Post;
}

export default function Post({ post }: PostProps) {
  return (
    <article>
      <h1>{post.title}</h1>
      <time>{new Date(post.publishedAt).toLocaleDateString()}</time>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}

export const getStaticPaths: GetStaticPaths<Params> = async () => {
  const posts = await fetchAllPosts();

  const paths = posts.map((post) => ({
    params: { slug: post.slug },
  }));

  return {
    paths,
    fallback: false, // false, true, or 'blocking'
  };
};

export const getStaticProps: GetStaticProps<PostProps, Params> = async ({
  params,
}) => {
  const post = await fetchPost(params!.slug);

  if (!post) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      post,
    },
  };
};
```

### Fallback Options

The `fallback` option in `getStaticPaths` determines behavior for paths not returned:

#### fallback: false

```typescript
export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
    fallback: false, // Any other path will 404
  };
};
```

**Use when**: You have a small number of paths and want strict control.

#### fallback: true

```typescript
import { useRouter } from 'next/router';

export default function Post({ post }: PostProps) {
  const router = useRouter();

  // Show loading state while page is being generated
  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  return <article>{post.title}</article>;
}

export const getStaticPaths: GetStaticPaths = async () => {
  // Only pre-render most popular posts
  const popularPosts = await fetchPopularPosts();

  return {
    paths: popularPosts.map((post) => ({ params: { slug: post.slug } })),
    fallback: true, // Other paths will be generated on-demand
  };
};
```

**Use when**: You have a large number of pages and want to pre-render only the most important ones.

#### fallback: 'blocking'

```typescript
export const getStaticPaths: GetStaticPaths = async () => {
  const popularPosts = await fetchPopularPosts();

  return {
    paths: popularPosts.map((post) => ({ params: { slug: post.slug } })),
    fallback: 'blocking', // Will SSR on first request, then cache
  };
};

// No need to check router.isFallback
export default function Post({ post }: PostProps) {
  return <article>{post.title}</article>;
}
```

**Use when**: You want on-demand generation without showing a loading state.

## Incremental Static Regeneration (ISR)

ISR allows you to update static content after deployment without rebuilding the entire site.

### Basic ISR

```typescript
import { GetStaticProps } from 'next';

interface PageProps {
  data: any;
  generatedAt: string;
}

export default function Page({ data, generatedAt }: PageProps) {
  return (
    <div>
      <p>Generated at: {generatedAt}</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const data = await fetchData();

  return {
    props: {
      data,
      generatedAt: new Date().toISOString(),
    },
    revalidate: 60, // Revalidate every 60 seconds
  };
};
```

### How ISR Works

1. Initial request serves the cached page
2. After `revalidate` time passes, next request still serves cached page
3. Next.js regenerates the page in the background
4. Once regenerated, cached page is updated
5. Subsequent requests get the new page

### ISR with Dynamic Routes

```typescript
import { GetStaticProps, GetStaticPaths } from 'next';

export const getStaticPaths: GetStaticPaths = async () => {
  const products = await fetchPopularProducts();

  return {
    paths: products.map((p) => ({ params: { id: p.id } })),
    fallback: 'blocking', // Works well with ISR
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const product = await fetchProduct(params!.id);

  if (!product) {
    return {
      notFound: true,
      revalidate: 10, // Revalidate 404s too
    };
  }

  return {
    props: {
      product,
    },
    revalidate: 300, // Revalidate every 5 minutes
  };
};
```

### On-Demand Revalidation

Revalidate specific pages on-demand using the revalidate API:

```typescript
// pages/api/revalidate.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check for secret to confirm this is a valid request
  if (req.query.secret !== process.env.REVALIDATE_TOKEN) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    const path = req.query.path as string;

    // Revalidate the path
    await res.revalidate(path);

    return res.json({ revalidated: true });
  } catch (err) {
    return res.status(500).send('Error revalidating');
  }
}
```

Trigger revalidation:

```bash
curl 'http://localhost:3000/api/revalidate?path=/blog/post-1&secret=YOUR_TOKEN'
```

### ISR Best Practices

```typescript
export const getStaticProps: GetStaticProps = async (context) => {
  try {
    const data = await fetchData();

    return {
      props: { data },
      revalidate: 60,
    };
  } catch (error) {
    // Return fallback data or notFound
    console.error('Error fetching data:', error);

    return {
      props: { data: null },
      revalidate: 10, // Retry sooner on error
    };
  }
};
```

## Server-Side Rendering (SSR)

SSR renders the page on each request. Use for pages with frequently changing data or user-specific content.

### Basic SSR with getServerSideProps

```typescript
import { GetServerSideProps } from 'next';

interface PageProps {
  data: any;
  timestamp: string;
}

export default function Page({ data, timestamp }: PageProps) {
  return (
    <div>
      <p>Rendered at: {timestamp}</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<PageProps> = async () => {
  const data = await fetchRealtimeData();

  return {
    props: {
      data,
      timestamp: new Date().toISOString(),
    },
  };
};
```

### When to Use SSR

Use SSR when:

- Data changes frequently
- Page content is user-specific
- You need access to request-time information
- SEO is important and data must be fresh

**Examples**: Personalized dashboards, real-time data, user profiles

### SSR with Request Context

```typescript
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';

interface DashboardProps {
  user: any;
  data: any;
}

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (
  context
) => {
  // Access cookies
  const cookies = context.req.cookies;

  // Access headers
  const userAgent = context.req.headers['user-agent'];

  // Get session
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  // Fetch user-specific data
  const data = await fetchUserData(session.user.id);

  return {
    props: {
      user: session.user,
      data,
    },
  };
};

export default function Dashboard({ user, data }: DashboardProps) {
  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

### SSR with Dynamic Routes

```typescript
import { GetServerSideProps } from 'next';
import { ParsedUrlQuery } from 'querystring';

interface Params extends ParsedUrlQuery {
  userId: string;
}

interface UserProfileProps {
  user: any;
}

export const getServerSideProps: GetServerSideProps<
  UserProfileProps,
  Params
> = async ({ params, query, req, res }) => {
  const userId = params!.userId;

  // Access query parameters
  const tab = query.tab || 'overview';

  // Fetch user data
  const user = await fetchUser(userId);

  if (!user) {
    return {
      notFound: true,
    };
  }

  // Set cache headers
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=10, stale-while-revalidate=59'
  );

  return {
    props: {
      user,
    },
  };
};

export default function UserProfile({ user }: UserProfileProps) {
  return <div>{user.name}</div>;
}
```

### SSR Error Handling

```typescript
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const data = await fetchData();

    return {
      props: { data },
    };
  } catch (error) {
    console.error('Error fetching data:', error);

    // Return error page
    return {
      props: {
        error: 'Failed to load data',
      },
    };

    // Or redirect
    // return {
    //   redirect: {
    //     destination: '/error',
    //     permanent: false,
    //   },
    // };

    // Or show 404
    // return {
    //   notFound: true,
    // };
  }
};
```

## Client-Side Rendering (CSR)

CSR renders content in the browser using JavaScript. Useful for user-specific data that doesn't need SEO.

### Using useEffect

```typescript
import { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
}

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/user');
        const data = await res.json();
        setUser(data);
      } catch (err) {
        setError('Failed to load user');
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>No user found</div>;

  return <div>Hello, {user.name}</div>;
}
```

### Using SWR (Recommended)

```typescript
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Profile() {
  const { data, error, isLoading } = useSWR('/api/user', fetcher);

  if (error) return <div>Failed to load</div>;
  if (isLoading) return <div>Loading...</div>;

  return <div>Hello, {data.name}</div>;
}
```

### SWR with Revalidation

```typescript
import useSWR from 'swr';

export default function Dashboard() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/dashboard',
    fetcher,
    {
      refreshInterval: 3000, // Refresh every 3 seconds
      revalidateOnFocus: true, // Revalidate when window gains focus
      revalidateOnReconnect: true, // Revalidate when network reconnects
    }
  );

  const handleUpdate = async () => {
    // Optimistically update
    mutate({ ...data, updated: true }, false);

    // Make API request
    await updateDashboard();

    // Revalidate
    mutate();
  };

  return (
    <div>
      {data && <div>{JSON.stringify(data)}</div>}
      <button onClick={handleUpdate}>Update</button>
    </div>
  );
}
```

### Using React Query

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Post {
  id: string;
  title: string;
}

export default function Posts() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: () => fetch('/api/posts').then((res) => res.json()),
  });

  const mutation = useMutation({
    mutationFn: (newPost: Omit<Post, 'id'>) =>
      fetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(newPost),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading posts</div>;

  return (
    <div>
      {data?.map((post) => (
        <article key={post.id}>{post.title}</article>
      ))}
    </div>
  );
}
```

## Automatic Static Optimization

Pages without `getServerSideProps` or `getInitialProps` are automatically statically optimized.

```typescript
// This page is automatically static
export default function About() {
  return <div>About Page</div>;
}

// No getServerSideProps or getInitialProps
```

### Checking if Optimized

```typescript
import { useRouter } from 'next/router';

export default function Page() {
  const router = useRouter();

  // In production, router.query will be empty for static pages
  // until hydration completes
  console.log('Is ready:', router.isReady);

  return <div>Page</div>;
}
```

## Hybrid Rendering

Combine multiple strategies in a single application:

```
pages/
├── index.tsx                    # SSG - Marketing page
├── about.tsx                    # Static - About page
├── blog/
│   ├── index.tsx               # SSG - Blog listing
│   └── [slug].tsx              # ISR - Blog posts
├── dashboard/
│   ├── index.tsx               # SSR - User dashboard
│   └── profile.tsx             # SSR - User profile
└── products/
    ├── index.tsx               # SSG - Product listing
    └── [id].tsx                # ISR - Product details
```

## Performance Optimization

### 1. Optimize getStaticProps

```typescript
import { GetStaticProps } from 'next';

export const getStaticProps: GetStaticProps = async () => {
  // Parallel data fetching
  const [posts, categories, authors] = await Promise.all([
    fetchPosts(),
    fetchCategories(),
    fetchAuthors(),
  ]);

  // Only return necessary data
  const optimizedPosts = posts.map((post) => ({
    id: post.id,
    title: post.title,
    excerpt: post.excerpt,
    // Don't include large fields like content
  }));

  return {
    props: {
      posts: optimizedPosts,
      categories,
      authors,
    },
    revalidate: 3600, // 1 hour
  };
};
```

### 2. Optimize getServerSideProps

```typescript
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  // Set cache headers for CDN
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=10, stale-while-revalidate=59'
  );

  // Parallel data fetching
  const data = await fetchData();

  return {
    props: { data },
  };
};
```

### 3. Reduce Bundle Size

```typescript
// Dynamic imports
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('../components/HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false, // Disable SSR for client-only components
});

export default function Page() {
  return (
    <div>
      <HeavyComponent />
    </div>
  );
}
```

### 4. Optimize Images

```typescript
import Image from 'next/image';

export default function Gallery() {
  return (
    <div>
      <Image
        src="/hero.jpg"
        alt="Hero"
        width={1200}
        height={600}
        priority // Load above the fold images first
      />
      <Image
        src="/product.jpg"
        alt="Product"
        width={400}
        height={300}
        loading="lazy" // Lazy load below the fold
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,..."
      />
    </div>
  );
}
```

## Choosing the Right Strategy

### Decision Tree

```
Is the data user-specific or requires authentication?
├─ Yes → Use SSR or CSR
│  ├─ Needs SEO? → SSR
│  └─ No SEO needed? → CSR
└─ No → Can data be fetched at build time?
   ├─ Yes → Use SSG
   │  ├─ Data changes occasionally? → Use ISR
   │  └─ Data is fully static? → Use SSG
   └─ No → Use SSR
```

### Comparison Table

| Strategy | When to Use | SEO | Performance | Fresh Data |
|----------|-------------|-----|-------------|------------|
| SSG | Static content | ✅ Excellent | ✅ Fastest | ❌ Build time only |
| ISR | Semi-static content | ✅ Excellent | ✅ Very Fast | ⚠️ Eventual |
| SSR | Dynamic/User content | ✅ Good | ⚠️ Slower | ✅ Always fresh |
| CSR | User-specific, no SEO | ❌ Poor | ⚠️ Varies | ✅ Real-time |
| Auto Static | Pure static pages | ✅ Excellent | ✅ Fastest | ❌ Static only |

## Best Practices

1. **Prefer Static When Possible**: SSG and ISR are fastest
2. **Use ISR for Semi-Dynamic Content**: Balance freshness and performance
3. **Reserve SSR for Truly Dynamic Pages**: User dashboards, real-time data
4. **Use CSR for User Interactions**: Client-side state, user preferences
5. **Optimize Data Fetching**: Fetch in parallel, return minimal data
6. **Implement Proper Caching**: Use cache headers with SSR
7. **Handle Errors Gracefully**: Always handle fetch errors
8. **Monitor Performance**: Use Next.js Analytics or similar tools

## Migration to App Router

### SSG Migration

```typescript
// Pages Router
export async function getStaticProps() {
  const data = await fetchData();
  return { props: { data } };
}

// App Router
export default async function Page() {
  const data = await fetchData();
  return <div>{data}</div>;
}
```

### ISR Migration

```typescript
// Pages Router
export async function getStaticProps() {
  return {
    props: { data },
    revalidate: 60,
  };
}

// App Router
export const revalidate = 60;
export default async function Page() {
  const data = await fetchData();
  return <div>{data}</div>;
}
```

### SSR Migration

```typescript
// Pages Router
export async function getServerSideProps() {
  const data = await fetchData();
  return { props: { data } };
}

// App Router
export const dynamic = 'force-dynamic';
export default async function Page() {
  const data = await fetchData();
  return <div>{data}</div>;
}
```

## Resources

- [Next.js Data Fetching](https://nextjs.org/docs/pages/building-your-application/data-fetching)
- [Rendering Strategies](https://nextjs.org/docs/pages/building-your-application/rendering)
- [SWR Documentation](https://swr.vercel.app/)
- [React Query Documentation](https://tanstack.com/query/latest)
