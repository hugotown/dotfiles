---
name: pages-router-data-fetching
description: Complete guide to data fetching in Next.js Pages Router covering getStaticProps, getStaticPaths, getServerSideProps, getInitialProps, and client-side fetching with SWR and React Query.
---

# Pages Router Data Fetching

Next.js Pages Router provides several methods for fetching data, each suited to different use cases and rendering strategies.

## Overview

Data fetching methods in Pages Router:

1. **getStaticProps** - Fetch data at build time (SSG)
2. **getStaticPaths** - Define dynamic paths for SSG
3. **getServerSideProps** - Fetch data on each request (SSR)
4. **getInitialProps** - Legacy method (not recommended)
5. **Client-side fetching** - Fetch in the browser with SWR, React Query, or useEffect

## getStaticProps (Static Site Generation)

`getStaticProps` runs at build time in production and allows you to fetch data to pre-render pages.

### Basic Usage

```typescript
import { GetStaticProps } from 'next';

interface Post {
  id: string;
  title: string;
  content: string;
}

interface BlogProps {
  posts: Post[];
}

export default function Blog({ posts }: BlogProps) {
  return (
    <div>
      {posts.map((post) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}

export const getStaticProps: GetStaticProps<BlogProps> = async () => {
  const posts = await fetchPosts();

  return {
    props: {
      posts,
    },
  };
};
```

### Fetching from Different Sources

#### External API

```typescript
export const getStaticProps: GetStaticProps = async () => {
  const res = await fetch('https://api.example.com/posts');
  const posts = await res.json();

  return {
    props: {
      posts,
    },
  };
};
```

#### Database

```typescript
import { db } from '../lib/database';

export const getStaticProps: GetStaticProps = async () => {
  const posts = await db.post.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return {
    props: {
      posts: JSON.parse(JSON.stringify(posts)), // Serialize dates
    },
  };
};
```

#### File System

```typescript
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

export const getStaticProps: GetStaticProps = async () => {
  const postsDirectory = path.join(process.cwd(), 'content/posts');
  const filenames = await fs.readdir(postsDirectory);

  const posts = await Promise.all(
    filenames.map(async (filename) => {
      const filePath = path.join(postsDirectory, filename);
      const fileContents = await fs.readFile(filePath, 'utf8');
      const { data, content } = matter(fileContents);

      return {
        slug: filename.replace(/\.md$/, ''),
        title: data.title,
        date: data.date,
        content,
      };
    })
  );

  return {
    props: {
      posts,
    },
  };
};
```

### Return Values

#### Props

```typescript
export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {
      data: 'your data',
    },
  };
};
```

#### Revalidate (ISR)

```typescript
export const getStaticProps: GetStaticProps = async () => {
  const data = await fetchData();

  return {
    props: { data },
    revalidate: 60, // Revalidate every 60 seconds
  };
};
```

#### Not Found

```typescript
export const getStaticProps: GetStaticProps = async () => {
  const data = await fetchData();

  if (!data) {
    return {
      notFound: true, // Returns 404 page
    };
  }

  return {
    props: { data },
  };
};
```

#### Redirect

```typescript
export const getStaticProps: GetStaticProps = async () => {
  const isAvailable = await checkAvailability();

  if (!isAvailable) {
    return {
      redirect: {
        destination: '/maintenance',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};
```

### Context Object

```typescript
import { GetStaticProps } from 'next';

export const getStaticProps: GetStaticProps = async (context) => {
  // Access parameters
  const { params } = context; // { slug: 'my-post' }

  // Access preview mode
  const { preview, previewData } = context;

  // Access locale (i18n)
  const { locale, defaultLocale, locales } = context;

  return {
    props: {},
  };
};
```

### TypeScript Types

```typescript
import { GetStaticProps, InferGetStaticPropsType } from 'next';

export const getStaticProps = (async () => {
  const posts = await fetchPosts();
  return {
    props: { posts },
  };
}) satisfies GetStaticProps;

// Infer types from getStaticProps
export default function Blog({
  posts,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return <div>{posts.length} posts</div>;
}
```

## getStaticPaths (Dynamic Routes)

`getStaticPaths` specifies which dynamic routes to pre-render.

### Basic Usage

```typescript
import { GetStaticPaths, GetStaticProps } from 'next';
import { ParsedUrlQuery } from 'querystring';

interface Params extends ParsedUrlQuery {
  slug: string;
}

interface PostProps {
  post: {
    slug: string;
    title: string;
    content: string;
  };
}

export const getStaticPaths: GetStaticPaths<Params> = async () => {
  const posts = await fetchAllPosts();

  const paths = posts.map((post) => ({
    params: { slug: post.slug },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<PostProps, Params> = async ({
  params,
}) => {
  const post = await fetchPost(params!.slug);

  return {
    props: {
      post,
    },
  };
};

export default function Post({ post }: PostProps) {
  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  );
}
```

### Multiple Dynamic Segments

```typescript
// pages/[category]/[product].tsx
import { GetStaticPaths } from 'next';

interface Params extends ParsedUrlQuery {
  category: string;
  product: string;
}

export const getStaticPaths: GetStaticPaths<Params> = async () => {
  const products = await fetchAllProducts();

  const paths = products.map((product) => ({
    params: {
      category: product.category,
      product: product.slug,
    },
  }));

  return {
    paths,
    fallback: 'blocking',
  };
};
```

### Catch-All Routes

```typescript
// pages/docs/[...slug].tsx
export const getStaticPaths: GetStaticPaths = async () => {
  const docs = await fetchAllDocs();

  const paths = docs.map((doc) => ({
    params: {
      slug: doc.path.split('/'), // ['guide', 'getting-started']
    },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = params?.slug as string[];
  const doc = await fetchDoc(slug.join('/'));

  return {
    props: { doc },
  };
};
```

### Fallback Options

#### fallback: false

```typescript
export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [
      { params: { id: '1' } },
      { params: { id: '2' } },
    ],
    fallback: false, // 404 for all other paths
  };
};
```

#### fallback: true

```typescript
import { useRouter } from 'next/router';

export default function Post({ post }: PostProps) {
  const router = useRouter();

  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  return <article>{post.title}</article>;
}

export const getStaticPaths: GetStaticPaths = async () => {
  // Only pre-render critical paths
  const popularPosts = await fetchPopularPosts();

  return {
    paths: popularPosts.map((post) => ({
      params: { slug: post.slug },
    })),
    fallback: true, // Generate other pages on-demand
  };
};
```

#### fallback: 'blocking'

```typescript
export const getStaticPaths: GetStaticPaths = async () => {
  const popularPosts = await fetchPopularPosts();

  return {
    paths: popularPosts.map((post) => ({
      params: { slug: post.slug },
    })),
    fallback: 'blocking', // SSR on first request, then cache
  };
};

// No need to check router.isFallback
```

### Internationalization

```typescript
export const getStaticPaths: GetStaticPaths = async ({ locales }) => {
  const posts = await fetchAllPosts();
  const paths: any[] = [];

  // Generate paths for all locales
  locales?.forEach((locale) => {
    posts.forEach((post) => {
      paths.push({
        params: { slug: post.slug },
        locale,
      });
    });
  });

  return {
    paths,
    fallback: false,
  };
};
```

## getServerSideProps (Server-Side Rendering)

`getServerSideProps` runs on every request, allowing you to fetch data server-side.

### Basic Usage

```typescript
import { GetServerSideProps } from 'next';

interface DashboardProps {
  data: any;
  timestamp: string;
}

export const getServerSideProps: GetServerSideProps<
  DashboardProps
> = async () => {
  const data = await fetchRealtimeData();

  return {
    props: {
      data,
      timestamp: new Date().toISOString(),
    },
  };
};

export default function Dashboard({ data, timestamp }: DashboardProps) {
  return (
    <div>
      <p>Last updated: {timestamp}</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

### Request and Response

```typescript
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  // Access cookies
  const token = req.cookies.authToken;

  // Access headers
  const userAgent = req.headers['user-agent'];

  // Set response headers
  res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=59');

  // Fetch data with authentication
  const data = await fetchProtectedData(token);

  return {
    props: { data },
  };
};
```

### Authentication

```typescript
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  const userData = await fetchUserData(session.user.id);

  return {
    props: {
      session,
      userData,
    },
  };
};
```

### Query Parameters

```typescript
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const page = parseInt(query.page as string) || 1;
  const search = query.search as string || '';
  const category = query.category as string;

  const results = await searchProducts({
    page,
    search,
    category,
  });

  return {
    props: {
      results,
      page,
      search,
      category,
    },
  };
};
```

### Error Handling

```typescript
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  try {
    const data = await fetchData(params?.id as string);

    if (!data) {
      return {
        notFound: true,
      };
    }

    return {
      props: { data },
    };
  } catch (error) {
    console.error('Error fetching data:', error);

    // Redirect to error page
    return {
      redirect: {
        destination: '/error',
        permanent: false,
      },
    };

    // Or return error props
    // return {
    //   props: {
    //     error: 'Failed to load data',
    //   },
    // };
  }
};
```

### Context Object

```typescript
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const {
    params,      // Route parameters
    query,       // Query string
    req,         // HTTP request
    res,         // HTTP response
    preview,     // Preview mode
    previewData, // Preview data
    resolvedUrl, // Resolved URL
    locale,      // Current locale
    locales,     // All locales
    defaultLocale, // Default locale
  } = context;

  return {
    props: {},
  };
};
```

## getInitialProps (Legacy)

`getInitialProps` is the legacy data fetching method. Avoid using it in new code.

### Basic Usage (Not Recommended)

```typescript
import { NextPageContext } from 'next';

interface PageProps {
  data: any;
}

Page.getInitialProps = async (ctx: NextPageContext): Promise<PageProps> => {
  const data = await fetchData();
  return { data };
};

export default function Page({ data }: PageProps) {
  return <div>{data}</div>;
}
```

### Why Avoid getInitialProps

1. **Disables Automatic Static Optimization** - Pages can't be statically optimized
2. **Less Performant** - Runs on both server and client
3. **More Complex** - Harder to reason about when code runs
4. **Deprecated** - Use `getStaticProps` or `getServerSideProps` instead

### Migration from getInitialProps

```typescript
// Before (getInitialProps)
Page.getInitialProps = async () => {
  const data = await fetchData();
  return { data };
};

// After (getStaticProps) - if data doesn't change often
export const getStaticProps: GetStaticProps = async () => {
  const data = await fetchData();
  return {
    props: { data },
    revalidate: 60,
  };
};

// After (getServerSideProps) - if data is request-specific
export const getServerSideProps: GetServerSideProps = async () => {
  const data = await fetchData();
  return {
    props: { data },
  };
};
```

## Client-Side Data Fetching

Fetch data in the browser for user-specific or frequently changing data.

### Using useEffect

```typescript
import { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/user');

        if (!res.ok) {
          throw new Error('Failed to fetch user');
        }

        const data = await res.json();
        setUser(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <div>No user found</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

### Using SWR (Recommended)

SWR is a React Hooks library for data fetching by Vercel.

#### Basic Usage

```typescript
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Profile() {
  const { data, error, isLoading } = useSWR('/api/user', fetcher);

  if (error) return <div>Failed to load</div>;
  if (isLoading) return <div>Loading...</div>;

  return <div>Hello {data.name}!</div>;
}
```

#### Configuration

```typescript
import useSWR from 'swr';

export default function Dashboard() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/dashboard',
    fetcher,
    {
      refreshInterval: 3000, // Refresh every 3 seconds
      revalidateOnFocus: true, // Revalidate on window focus
      revalidateOnReconnect: true, // Revalidate on network reconnect
      dedupingInterval: 2000, // Dedupe requests within 2 seconds
      errorRetryCount: 3, // Retry 3 times on error
      shouldRetryOnError: true,
      onSuccess: (data) => {
        console.log('Data loaded:', data);
      },
      onError: (error) => {
        console.error('Error loading data:', error);
      },
    }
  );

  return <div>{data && JSON.stringify(data)}</div>;
}
```

#### Global Configuration

```typescript
// pages/_app.tsx
import { SWRConfig } from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function App({ Component, pageProps }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        refreshInterval: 3000,
        revalidateOnFocus: false,
      }}
    >
      <Component {...pageProps} />
    </SWRConfig>
  );
}
```

#### Mutations

```typescript
import useSWR from 'swr';

export default function UserProfile() {
  const { data, mutate } = useSWR('/api/user', fetcher);

  async function updateProfile(newData: any) {
    // Optimistic update
    mutate({ ...data, ...newData }, false);

    // Send request
    await fetch('/api/user', {
      method: 'PATCH',
      body: JSON.stringify(newData),
    });

    // Revalidate
    mutate();
  }

  return (
    <div>
      <button onClick={() => updateProfile({ name: 'New Name' })}>
        Update Name
      </button>
    </div>
  );
}
```

#### Conditional Fetching

```typescript
import useSWR from 'swr';

export default function Post({ postId }: { postId?: string }) {
  // Only fetch if postId exists
  const { data } = useSWR(postId ? `/api/posts/${postId}` : null, fetcher);

  return <div>{data?.title}</div>;
}
```

#### Pagination

```typescript
import useSWR from 'swr';
import { useState } from 'react';

export default function Posts() {
  const [page, setPage] = useState(1);
  const { data, error, isLoading } = useSWR(
    `/api/posts?page=${page}`,
    fetcher
  );

  return (
    <div>
      {data?.posts.map((post) => (
        <article key={post.id}>{post.title}</article>
      ))}
      <button onClick={() => setPage(page - 1)} disabled={page === 1}>
        Previous
      </button>
      <button onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
}
```

### Using React Query

React Query (TanStack Query) provides advanced data fetching capabilities.

#### Setup

```typescript
// pages/_app.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 1000, // 5 seconds
    },
  },
});

export default function App({ Component, pageProps }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Component {...pageProps} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

#### Basic Query

```typescript
import { useQuery } from '@tanstack/react-query';

interface Post {
  id: string;
  title: string;
}

export default function Posts() {
  const { data, error, isLoading, refetch } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: () => fetch('/api/posts').then((res) => res.json()),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading posts</div>;

  return (
    <div>
      {data?.map((post) => (
        <article key={post.id}>{post.title}</article>
      ))}
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

#### Mutations

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CreatePostData {
  title: string;
  content: string;
}

export default function CreatePost() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (newPost: CreatePostData) =>
      fetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(newPost),
      }).then((res) => res.json()),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error) => {
      console.error('Error creating post:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    mutation.mutate({
      title: formData.get('title') as string,
      content: formData.get('content') as string,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" placeholder="Title" />
      <textarea name="content" placeholder="Content" />
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create Post'}
      </button>
      {mutation.isError && <div>Error creating post</div>}
    </form>
  );
}
```

#### Dependent Queries

```typescript
import { useQuery } from '@tanstack/react-query';

export default function UserPosts({ userId }: { userId: string }) {
  // First query
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetch(`/api/users/${userId}`).then((res) => res.json()),
  });

  // Second query depends on first
  const { data: posts } = useQuery({
    queryKey: ['posts', user?.id],
    queryFn: () =>
      fetch(`/api/users/${user!.id}/posts`).then((res) => res.json()),
    enabled: !!user, // Only run if user exists
  });

  return <div>{posts?.length} posts</div>;
}
```

## Combining Strategies

### Hybrid Approach

```typescript
import { GetStaticProps } from 'next';
import useSWR from 'swr';

interface PageProps {
  initialPosts: Post[];
}

// Pre-render with initial data
export const getStaticProps: GetStaticProps<PageProps> = async () => {
  const posts = await fetchPosts();

  return {
    props: {
      initialPosts: posts,
    },
    revalidate: 60,
  };
};

// Keep data fresh on client
export default function Blog({ initialPosts }: PageProps) {
  const { data: posts } = useSWR('/api/posts', fetcher, {
    fallbackData: initialPosts,
    refreshInterval: 10000, // Refresh every 10 seconds
  });

  return (
    <div>
      {posts?.map((post) => (
        <article key={post.id}>{post.title}</article>
      ))}
    </div>
  );
}
```

## Best Practices

### 1. Choose the Right Method

- **getStaticProps**: Static content, SEO important, data doesn't change often
- **getServerSideProps**: Request-specific data, authentication, real-time data
- **Client-side**: User-specific data, no SEO needed, frequently changing data

### 2. Optimize Data Fetching

```typescript
// Parallel fetching
export const getStaticProps: GetStaticProps = async () => {
  const [posts, categories, tags] = await Promise.all([
    fetchPosts(),
    fetchCategories(),
    fetchTags(),
  ]);

  return {
    props: { posts, categories, tags },
  };
};
```

### 3. Handle Errors Gracefully

```typescript
export const getStaticProps: GetStaticProps = async () => {
  try {
    const data = await fetchData();
    return { props: { data } };
  } catch (error) {
    console.error('Error fetching data:', error);
    return {
      props: { data: null },
      revalidate: 10, // Retry sooner
    };
  }
};
```

### 4. Type Safety

```typescript
import { GetStaticProps, InferGetStaticPropsType } from 'next';

export const getStaticProps = (async () => {
  return {
    props: {
      posts: await fetchPosts(),
    },
  };
}) satisfies GetStaticProps;

export default function Page({
  posts,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return <div>{posts.length}</div>;
}
```

### 5. Serialize Data Properly

```typescript
import { GetStaticProps } from 'next';

export const getStaticProps: GetStaticProps = async () => {
  const data = await db.findMany();

  return {
    props: {
      // Serialize dates and other non-JSON types
      data: JSON.parse(JSON.stringify(data)),
    },
  };
};
```

## Resources

- [Next.js Data Fetching](https://nextjs.org/docs/pages/building-your-application/data-fetching)
- [SWR Documentation](https://swr.vercel.app/)
- [React Query Documentation](https://tanstack.com/query/latest)
