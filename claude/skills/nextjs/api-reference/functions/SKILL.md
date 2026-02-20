---
name: nextjs-functions-reference
description: Documents Next.js functions and hooks including data fetching, navigation, metadata generation, caching, and request handling. Use when implementing server functions, client hooks, or handling requests/responses.
---

# Next.js Functions Reference

This skill provides comprehensive documentation for Next.js functions and hooks across different categories:

## Server Functions
Functions that run on the server side for data fetching, routing, and metadata:
- `fetch` - Extended fetch API with caching and revalidation
- `headers` - Read incoming request headers
- `cookies` - Read and set HTTP cookies
- `redirect` / `permanentRedirect` - Server-side redirects
- `notFound` - Trigger 404 not found pages
- `revalidatePath` - Revalidate cached data by path
- `revalidateTag` - Revalidate cached data by tag
- `generateMetadata` - Generate dynamic page metadata
- `generateStaticParams` - Generate static route parameters
- `generateSitemaps` - Generate XML sitemaps
- `generateViewport` - Configure viewport settings

## Caching Functions
Functions for controlling cache behavior:
- `cacheLife` - Configure cache duration
- `cacheTag` - Tag cached content
- `unstable_cache` - Legacy caching function

## Client Hooks
React hooks for client-side navigation and routing:
- `useRouter` - Programmatic navigation
- `usePathname` - Get current pathname
- `useSearchParams` - Access query parameters
- `useParams` - Access route parameters
- `useSelectedLayoutSegment` - Get active layout segment

## Request/Response Objects
Extended objects for handling HTTP requests and responses:
- `NextRequest` - Extended Request object with Next.js utilities
- `NextResponse` - Extended Response object with Next.js utilities

## Usage
Reference the specific function documentation file for detailed information including:
- Function signatures
- Parameters and types
- Return values
- Code examples
- Best practices
- Common patterns
