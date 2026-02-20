# Redirects Configuration

Redirects allow you to redirect incoming requests from one path to another. Configure redirects in `next.config.js`.

## Basic Redirect

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/old-path',
        destination: '/new-path',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
```

## Redirect Object Properties

```typescript
{
  source: string          // Incoming request path pattern
  destination: string     // Path to redirect to
  permanent: boolean      // Use 308 (true) or 307 (false) status code
  basePath?: false        // Don't include basePath (default: true)
  locale?: false          // Don't include locale (default: true)
  has?: HasMatcher[]      // Additional conditions
  missing?: HasMatcher[]  // Inverse of has
}
```

## Permanent vs Temporary Redirects

### Permanent Redirect (308)

```javascript
{
  source: '/old-blog',
  destination: '/blog',
  permanent: true, // 308 status code
}
```

Use for:
- Permanently moved content
- SEO transfer (passes link equity)
- Cached by browsers

### Temporary Redirect (307)

```javascript
{
  source: '/maintenance',
  destination: '/coming-soon',
  permanent: false, // 307 status code
}
```

Use for:
- Temporary redirects
- A/B testing
- Maintenance pages

## Path Matching

### Exact Match

```javascript
{
  source: '/about',
  destination: '/about-us',
  permanent: true,
}
```

### Wildcard Path Matching

```javascript
{
  source: '/blog/:slug',
  destination: '/news/:slug',
  permanent: true,
}

// Matches: /blog/hello → /news/hello
```

### Catch-all Route

```javascript
{
  source: '/old-blog/:slug*',
  destination: '/blog/:slug*',
  permanent: true,
}

// Matches: /old-blog/a/b/c → /blog/a/b/c
```

### Regex Path Matching

```javascript
{
  source: '/post/:slug(\\d{1,})',
  destination: '/news/:slug',
  permanent: true,
}

// Matches: /post/123 → /news/123
// Doesn't match: /post/abc
```

## Named Parameters

```javascript
{
  source: '/user/:username/post/:postId',
  destination: '/users/:username/posts/:postId',
  permanent: true,
}

// /user/john/post/123 → /users/john/posts/123
```

## External Redirects

```javascript
{
  source: '/blog',
  destination: 'https://blog.example.com',
  permanent: true,
}
```

## Conditional Redirects

### Using `has` Matcher

```javascript
{
  source: '/specific-page',
  has: [
    {
      type: 'header',
      key: 'x-redirect-me',
    },
  ],
  destination: '/another-page',
  permanent: false,
}
```

### Header Matching

```javascript
{
  source: '/admin',
  has: [
    {
      type: 'header',
      key: 'x-authorized-user',
      value: 'true',
    },
  ],
  destination: '/admin/dashboard',
  permanent: false,
}
```

### Cookie Matching

```javascript
{
  source: '/home',
  has: [
    {
      type: 'cookie',
      key: 'authorized',
      value: 'true',
    },
  ],
  destination: '/dashboard',
  permanent: false,
}
```

### Query String Matching

```javascript
{
  source: '/search',
  has: [
    {
      type: 'query',
      key: 'type',
      value: 'product',
    },
  ],
  destination: '/products/search',
  permanent: false,
}
```

### Host Matching

```javascript
{
  source: '/:path*',
  has: [
    {
      type: 'host',
      value: 'old-domain.com',
    },
  ],
  destination: 'https://new-domain.com/:path*',
  permanent: true,
}
```

## Using `missing` Matcher

Redirect when condition is NOT met:

```javascript
{
  source: '/protected',
  missing: [
    {
      type: 'cookie',
      key: 'authorized',
    },
  ],
  destination: '/login',
  permanent: false,
}
```

## Multiple Conditions

```javascript
{
  source: '/premium-content',
  has: [
    {
      type: 'cookie',
      key: 'subscription',
      value: 'premium',
    },
    {
      type: 'header',
      key: 'x-verified',
      value: 'true',
    },
  ],
  destination: '/premium/content',
  permanent: false,
}
```

## basePath and Locale

### Excluding basePath

```javascript
{
  source: '/old-path',
  destination: '/new-path',
  basePath: false, // Don't prepend basePath
  permanent: true,
}
```

### Excluding Locale

```javascript
{
  source: '/nl/blog/:slug',
  destination: '/en/blog/:slug',
  locale: false, // Don't include locale prefix
  permanent: true,
}
```

## Common Redirect Patterns

### Remove Trailing Slash

```javascript
{
  source: '/:path+/',
  destination: '/:path+',
  permanent: true,
}
```

### Add Trailing Slash

```javascript
{
  source: '/:path+',
  destination: '/:path+/',
  permanent: true,
}
```

### Lowercase URLs

```javascript
{
  source: '/:path*',
  has: [
    {
      type: 'header',
      key: 'x-lowercase',
      value: 'true',
    },
  ],
  destination: '/:path*',
  permanent: true,
}
```

### Old Domain to New Domain

```javascript
{
  source: '/:path*',
  has: [
    {
      type: 'host',
      value: 'old-site.com',
    },
  ],
  destination: 'https://new-site.com/:path*',
  permanent: true,
}
```

### Redirect Based on User Agent

```javascript
{
  source: '/mobile-app',
  has: [
    {
      type: 'header',
      key: 'user-agent',
      value: '(.*Mobile.*)',
    },
  ],
  destination: '/app/mobile',
  permanent: false,
}
```

### Redirect Old Blog Structure

```javascript
{
  source: '/blog/:year/:month/:day/:slug',
  destination: '/posts/:slug',
  permanent: true,
}

// /blog/2023/01/15/hello → /posts/hello
```

### Redirect with Query Parameters

```javascript
{
  source: '/old-search',
  has: [
    {
      type: 'query',
      key: 'q',
    },
  ],
  destination: '/search?query=:q',
  permanent: true,
}
```

## Complete Example

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Simple redirect
      {
        source: '/about',
        destination: '/about-us',
        permanent: true,
      },

      // Redirect with parameters
      {
        source: '/user/:username',
        destination: '/profile/:username',
        permanent: true,
      },

      // External redirect
      {
        source: '/blog',
        destination: 'https://blog.example.com',
        permanent: true,
      },

      // Conditional redirect
      {
        source: '/premium',
        has: [
          {
            type: 'cookie',
            key: 'subscription',
            value: 'premium',
          },
        ],
        destination: '/premium/dashboard',
        permanent: false,
      },

      // Redirect missing auth
      {
        source: '/protected/:path*',
        missing: [
          {
            type: 'cookie',
            key: 'session',
          },
        ],
        destination: '/login',
        permanent: false,
      },

      // Domain redirect
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'old-domain.com',
          },
        ],
        destination: 'https://new-domain.com/:path*',
        permanent: true,
      },

      // Catch-all redirect
      {
        source: '/old-site/:path*',
        destination: '/new-site/:path*',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
```

## Dynamic Redirects

```javascript
async redirects() {
  // Fetch redirects from database or API
  const redirectsFromDB = await fetchRedirects()

  const staticRedirects = [
    {
      source: '/about',
      destination: '/about-us',
      permanent: true,
    },
  ]

  return [...staticRedirects, ...redirectsFromDB]
}
```

## Best Practices

1. **Use permanent redirects for SEO**: When content has permanently moved
2. **Be specific with patterns**: Avoid overly broad catch-all redirects
3. **Test redirects**: Verify redirect chains and loops
4. **Order matters**: More specific redirects should come first
5. **Limit redirect chains**: Avoid multiple redirect hops
6. **Use 307 for temporary**: Don't cache temporary redirects
7. **Document complex redirects**: Add comments for regex patterns

## Common Issues

### Redirect Loops

```javascript
// Bad: Creates loop
{
  source: '/page-a',
  destination: '/page-b',
  permanent: true,
}
{
  source: '/page-b',
  destination: '/page-a',
  permanent: true,
}
```

### Incorrect Regex

```javascript
// Bad: Doesn't escape special characters
{
  source: '/blog/:slug.',
  destination: '/posts/:slug',
  permanent: true,
}

// Good: Properly escaped
{
  source: '/blog/:slug\\.',
  destination: '/posts/:slug',
  permanent: true,
}
```

### Missing Parameters

```javascript
// Bad: :slug not used in destination
{
  source: '/blog/:slug',
  destination: '/posts',
  permanent: true,
}

// Good: :slug preserved
{
  source: '/blog/:slug',
  destination: '/posts/:slug',
  permanent: true,
}
```

## Testing Redirects

```bash
# Test with curl
curl -I http://localhost:3000/old-path

# Expected response:
# HTTP/1.1 308 Permanent Redirect
# Location: /new-path
```

## Performance Considerations

1. **Redirects are fast**: Handled at the edge in production
2. **Async is fine**: Database lookups are acceptable
3. **Cache responses**: Consider caching dynamic redirects
4. **Limit complexity**: Too many conditional checks can slow things down
