# Supported Browsers

## Overview

Next.js supports all modern browsers with zero configuration. The framework automatically handles browser compatibility through transpilation, polyfills, and modern JavaScript features, ensuring your application works across a wide range of browsers and devices.

## Default Browser Support

### Production Builds

Next.js targets the following browsers by default:

```
Chrome >= 64
Edge >= 79
Firefox >= 67
Opera >= 51
Safari >= 12
```

**Key Points:**
- No Internet Explorer support by default
- ES2017+ features are used
- Modern JavaScript syntax
- Automatic polyfills for supported browsers

### Development Mode

Development mode uses a more modern baseline:

```
Latest Chrome, Firefox, Safari, Edge
```

**Benefits:**
- Faster development builds
- Better debugging experience
- Modern dev tools support

## Browser Configuration

### Using Browserslist

Configure browser targets with browserslist:

```json
// package.json
{
  "browserslist": [
    "> 0.5%",
    "last 2 versions",
    "Firefox ESR",
    "not dead"
  ]
}
```

**Common queries:**
```json
{
  "browserslist": {
    "production": [
      "> 0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
```

### Separate .browserslistrc File

```
# .browserslistrc

# Production
[production]
> 0.5%
last 2 versions
not dead
not ie 11

# Development
[development]
last 1 chrome version
last 1 firefox version
last 1 safari version
```

## Polyfills

### Automatic Polyfills

Next.js includes polyfills automatically:

**Polyfilled features:**
- `fetch()` (via `whatwg-fetch`)
- `Object.assign()`
- `Promise`
- `Array.from()`
- `Array.prototype.includes()`
- `String.prototype.includes()`
- `Map`, `Set`

### Custom Polyfills

Add custom polyfills in `_app.js`:

```javascript
// pages/_app.js
import 'core-js/stable'
import 'regenerator-runtime/runtime'

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
```

**Conditional polyfills:**
```javascript
// pages/_app.js
if (typeof window !== 'undefined') {
  // Client-side only polyfills
  if (!('IntersectionObserver' in window)) {
    import('intersection-observer')
  }

  if (!('ResizeObserver' in window)) {
    import('@juggle/resize-observer').then((module) => {
      window.ResizeObserver = module.ResizeObserver
    })
  }
}

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
```

### Feature Detection

Use feature detection instead of browser detection:

```javascript
'use client'

import { useState, useEffect } from 'react'

export default function FeatureComponent() {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    // Check for feature support
    if ('IntersectionObserver' in window) {
      setSupported(true)
    } else {
      // Load polyfill or fallback
      import('intersection-observer').then(() => {
        setSupported(true)
      })
    }
  }, [])

  if (!supported) {
    return <div>Loading...</div>
  }

  return <div>Feature supported!</div>
}
```

## Browser-Specific Features

### CSS Features

Next.js handles CSS compatibility automatically:

```css
/* Modern CSS */
.container {
  display: grid;
  gap: 1rem;
  container-type: inline-size; /* Autoprefixed */
}

/* Compiled to: */
.container {
  display: -ms-grid;
  display: grid;
  gap: 1rem;
  -webkit-container-type: inline-size;
  -moz-container-type: inline-size;
  container-type: inline-size;
}
```

**PostCSS configuration:**
```javascript
// postcss.config.js
module.exports = {
  plugins: {
    'postcss-preset-env': {
      stage: 3,
      features: {
        'nesting-rules': true,
        'custom-properties': true,
      },
    },
    autoprefixer: {
      flexbox: 'no-2009',
      grid: 'autoplace',
    },
  },
}
```

### JavaScript Features

Modern JavaScript is transpiled automatically:

```javascript
// Modern JS (source)
const data = await fetch('/api/data')
const items = data?.items ?? []
const unique = [...new Set(items)]

// Transpiled for older browsers
// (async/await, optional chaining, nullish coalescing)
```

**Configure transpilation:**
```javascript
// next.config.js
module.exports = {
  // Transpile specific packages
  transpilePackages: ['@acme/ui', 'lodash-es'],

  compiler: {
    // SWC compiler options
  },
}
```

## Internet Explorer Support

### Legacy Support (Not Recommended)

If you must support IE 11:

```javascript
// next.config.js
module.exports = {
  // Enable legacy browser support
  experimental: {
    legacyBrowsers: true,
  },

  // Transpile more code
  transpilePackages: ['your-packages'],
}
```

**Add IE 11 polyfills:**
```javascript
// pages/_app.js
import 'core-js/stable'
import 'regenerator-runtime/runtime'
import 'whatwg-fetch'
import 'url-polyfill'
import 'intersection-observer'

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
```

**Browserslist for IE 11:**
```json
{
  "browserslist": [
    "ie 11",
    "> 0.5%",
    "last 2 versions"
  ]
}
```

**Warning:** IE 11 support significantly increases bundle size and decreases performance.

## Mobile Browser Support

### iOS Safari

Full support for modern iOS versions:

```
iOS Safari >= 12.2
```

**iOS-specific considerations:**
```javascript
// Handle iOS quirks
if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
  // iOS-specific code
  document.body.style.webkitUserSelect = 'none'
}
```

### Android Chrome

Support for recent Android versions:

```
Chrome Android >= 64
```

**Android-specific handling:**
```javascript
// Detect Android
const isAndroid = /Android/i.test(navigator.userAgent)

if (isAndroid) {
  // Android-specific optimizations
}
```

### Progressive Web Apps

Next.js supports PWA features:

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
})

module.exports = withPWA({
  // Next.js config
})
```

## Testing Browser Compatibility

### Local Testing

**Using BrowserStack:**
```bash
# Install BrowserStack local
npm install -g browserstack-local

# Start local tunnel
browserstack-local --key YOUR_KEY

# Test on real devices
```

**Using Playwright:**
```bash
npm install -D @playwright/test

# playwright.config.js
module.exports = {
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['iPhone 12'] } },
  ],
}
```

### Automated Testing

```javascript
// tests/browser-compat.test.js
import { test, expect } from '@playwright/test'

test.describe('Browser Compatibility', () => {
  test('works in Chrome', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await expect(page).toHaveTitle(/Home/)
  })

  test('works in Safari', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit')
    await page.goto('http://localhost:3000')
    await expect(page).toHaveTitle(/Home/)
  })
})
```

### Manual Testing

**Browser DevTools:**
```javascript
// Emulate different browsers
// Chrome DevTools > Settings > Devices
// Add custom devices

// Network throttling for slow connections
// DevTools > Network > Throttling

// Coverage analysis
// DevTools > Coverage
// See unused CSS/JS
```

## Feature Detection

### Client-Side Detection

```javascript
'use client'

import { useEffect, useState } from 'react'

export default function BrowserFeatures() {
  const [features, setFeatures] = useState({})

  useEffect(() => {
    setFeatures({
      // Modern APIs
      intersectionObserver: 'IntersectionObserver' in window,
      resizeObserver: 'ResizeObserver' in window,
      webGL: !!document.createElement('canvas').getContext('webgl'),
      serviceWorker: 'serviceWorker' in navigator,

      // Storage
      localStorage: typeof localStorage !== 'undefined',
      sessionStorage: typeof sessionStorage !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined',

      // Media
      webRTC: 'RTCPeerConnection' in window,
      mediaDevices: 'mediaDevices' in navigator,

      // Permissions
      permissions: 'permissions' in navigator,
      geolocation: 'geolocation' in navigator,
    })
  }, [])

  return (
    <div>
      <h2>Supported Features</h2>
      <ul>
        {Object.entries(features).map(([feature, supported]) => (
          <li key={feature}>
            {feature}: {supported ? '✅' : '❌'}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Server-Side Detection

```javascript
// app/api/browser/route.ts
import { NextRequest } from 'next/server'
import { userAgent } from 'next/server'

export async function GET(request: NextRequest) {
  const { browser, device, os } = userAgent(request)

  return Response.json({
    browser: browser.name,
    version: browser.version,
    device: device.type,
    os: os.name,
  })
}
```

## Performance by Browser

### Optimize for Target Browsers

```javascript
// next.config.js
module.exports = {
  compiler: {
    // Remove console in production (except errors)
    removeConsole: {
      exclude: ['error'],
    },
  },

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },

  // Enable compression
  compress: true,
}
```

### Code Splitting by Browser

```javascript
'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

// Load heavy components only for modern browsers
const ModernComponent = dynamic(() => import('./ModernComponent'))
const LegacyComponent = dynamic(() => import('./LegacyComponent'))

export default function AdaptiveComponent() {
  const [isModern, setIsModern] = useState(false)

  useEffect(() => {
    // Check for modern features
    const modern = 'IntersectionObserver' in window &&
                   'ResizeObserver' in window
    setIsModern(modern)
  }, [])

  return isModern ? <ModernComponent /> : <LegacyComponent />
}
```

## Best Practices

### 1. Use Feature Detection

```javascript
// ✅ Good: Feature detection
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}

// ❌ Bad: User agent sniffing
if (navigator.userAgent.includes('Chrome')) {
  // Don't do this
}
```

### 2. Progressive Enhancement

```javascript
export default function EnhancedForm() {
  return (
    <form action="/api/submit" method="POST">
      {/* Works without JS */}
      <input type="email" name="email" required />
      <button type="submit">Submit</button>
    </form>
  )
}

// Enhance with JS
'use client'

export default function EnhancedFormClient() {
  const handleSubmit = async (e) => {
    e.preventDefault()
    // Enhanced submission with fetch
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" name="email" required />
      <button type="submit">Submit</button>
    </form>
  )
}
```

### 3. Graceful Degradation

```javascript
export default function VideoPlayer() {
  return (
    <video controls>
      <source src="/video.mp4" type="video/mp4" />
      <source src="/video.webm" type="video/webm" />
      {/* Fallback for browsers without video support */}
      <p>
        Your browser doesn't support HTML5 video.
        <a href="/video.mp4">Download the video</a>.
      </p>
    </video>
  )
}
```

### 4. Monitor Real-World Usage

```javascript
// Track browser usage
import { useEffect } from 'react'

export default function Analytics() {
  useEffect(() => {
    // Send browser info to analytics
    const browserData = {
      userAgent: navigator.userAgent,
      vendor: navigator.vendor,
      platform: navigator.platform,
      language: navigator.language,
    }

    // Send to analytics service
    fetch('/api/analytics', {
      method: 'POST',
      body: JSON.stringify(browserData),
    })
  }, [])

  return null
}
```

### 5. Test Regularly

```bash
# Cross-browser testing checklist
# ✅ Chrome/Edge (latest)
# ✅ Firefox (latest)
# ✅ Safari (latest)
# ✅ Mobile Safari (iOS 12+)
# ✅ Chrome Mobile (latest)
# ✅ Samsung Internet (if targeting Android)
```

## Debugging Browser Issues

### Browser-Specific CSS

```css
/* Safari-specific styles */
@supports (-webkit-appearance: none) {
  .safari-only {
    /* Safari styles */
  }
}

/* Firefox-specific styles */
@-moz-document url-prefix() {
  .firefox-only {
    /* Firefox styles */
  }
}

/* Modern browsers only */
@supports (display: grid) {
  .modern-layout {
    display: grid;
  }
}
```

### Console Logging

```javascript
// Conditional logging for debugging
if (process.env.NODE_ENV === 'development') {
  console.log('Browser:', navigator.userAgent)
  console.log('Features:', {
    fetch: typeof fetch !== 'undefined',
    promise: typeof Promise !== 'undefined',
    intersectionObserver: 'IntersectionObserver' in window,
  })
}
```

## Resources

- [Browserslist](https://browsersl.ist/)
- [Can I Use](https://caniuse.com/)
- [MDN Browser Compatibility](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Page_structures/Compatibility_tables)
- [Next.js Browser Support](https://nextjs.org/docs/architecture/supported-browsers)
- [Autoprefixer](https://github.com/postcss/autoprefixer)
- [Core-js](https://github.com/zloirock/core-js)
