# Script Optimization

The `next/script` component optimizes loading of third-party scripts with control over loading strategy and execution timing.

## Core Features

- **Loading Strategy Control**: Decide when scripts load relative to page hydration
- **Automatic Deduplication**: Same script won't load multiple times
- **Execution Control**: Control when scripts execute
- **Event Callbacks**: Monitor script loading lifecycle
- **Inline Script Support**: Optimize inline script execution

## Loading Strategies

### beforeInteractive

Load before Next.js hydration and before any page code runs. For critical scripts that must run early.

```tsx
import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Script
          src="https://example.com/critical-script.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  )
}
```

**Use Cases:**
- Bot detection scripts
- Cookie consent managers
- Security scripts
- Critical polyfills

**Important:** Only use in `app/layout.tsx` (root layout)

### afterInteractive (Default)

Load after page becomes interactive. Good for most third-party scripts.

```tsx
import Script from 'next/script'

export default function Page() {
  return (
    <>
      <Script
        src="https://example.com/script.js"
        strategy="afterInteractive" // Default, can be omitted
      />
      <div>Page content</div>
    </>
  )
}
```

**Use Cases:**
- Tag managers
- Analytics (non-critical)
- Ads
- Social media widgets
- Chat widgets

### lazyOnload

Load during browser idle time. For non-critical scripts.

```tsx
import Script from 'next/script'

export default function Page() {
  return (
    <>
      <Script
        src="https://example.com/non-critical.js"
        strategy="lazyOnload"
      />
      <div>Page content</div>
    </>
  )
}
```

**Use Cases:**
- Background trackers
- Non-essential analytics
- Social media share buttons
- Comment systems
- Heatmap tools

### worker (Experimental)

Load and execute scripts in a web worker using Partytown.

```tsx
import Script from 'next/script'

export default function Page() {
  return (
    <>
      <Script
        src="https://example.com/script.js"
        strategy="worker"
      />
      <div>Page content</div>
    </>
  )
}
```

Requires Partytown configuration:

```js
// next.config.js
module.exports = {
  experimental: {
    nextScriptWorkers: true,
  },
}
```

## Event Callbacks

### onLoad

Execute code after script loads successfully:

```tsx
'use client'

import Script from 'next/script'

export default function Page() {
  return (
    <>
      <Script
        src="https://example.com/script.js"
        onLoad={() => {
          console.log('Script loaded successfully')
          // Initialize script
          window.exampleScript.init()
        }}
      />
    </>
  )
}
```

### onReady

Execute code when script is ready and on every route change:

```tsx
'use client'

import Script from 'next/script'

export default function Page() {
  return (
    <>
      <Script
        src="https://example.com/script.js"
        onReady={() => {
          console.log('Script is ready')
          // Called on initial load and route changes
        }}
      />
    </>
  )
}
```

### onError

Handle script loading errors:

```tsx
'use client'

import Script from 'next/script'

export default function Page() {
  return (
    <>
      <Script
        src="https://example.com/script.js"
        onError={(error) => {
          console.error('Script failed to load:', error)
          // Fallback behavior or error reporting
        }}
      />
    </>
  )
}
```

### Combined Example

```tsx
'use client'

import Script from 'next/script'
import { useState } from 'react'

export default function Page() {
  const [scriptStatus, setScriptStatus] = useState('loading')

  return (
    <>
      <Script
        src="https://example.com/script.js"
        strategy="afterInteractive"
        onLoad={() => {
          setScriptStatus('loaded')
          console.log('Script loaded')
        }}
        onReady={() => {
          console.log('Script ready for use')
        }}
        onError={(error) => {
          setScriptStatus('error')
          console.error('Failed to load:', error)
        }}
      />

      <div>Script Status: {scriptStatus}</div>
    </>
  )
}
```

## Inline Scripts

### Basic Inline Script

```tsx
import Script from 'next/script'

export default function Page() {
  return (
    <>
      <Script id="show-banner">
        {`console.log('Inline script executed')`}
      </Script>
    </>
  )
}
```

**Note:** `id` is required for inline scripts.

### Inline Script with Strategy

```tsx
import Script from 'next/script'

export default function Page() {
  return (
    <>
      <Script id="init-config" strategy="beforeInteractive">
        {`
          window.CONFIG = {
            apiUrl: '${process.env.NEXT_PUBLIC_API_URL}',
            environment: '${process.env.NODE_ENV}'
          };
        `}
      </Script>
    </>
  )
}
```

### Inline Script with Dangerously Set

For complex inline scripts:

```tsx
import Script from 'next/script'

export default function Page() {
  return (
    <>
      <Script
        id="complex-script"
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              console.log('Complex inline script');
              // More complex logic here
            })();
          `,
        }}
      />
    </>
  )
}
```

## Common Third-Party Scripts

### Google Analytics (GA4)

```tsx
// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
          `}
        </Script>
        {children}
      </body>
    </html>
  )
}
```

### Google Tag Manager

```tsx
import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Script
          id="gtm"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${process.env.NEXT_PUBLIC_GTM_ID}');
            `,
          }}
        />
        {children}
      </body>
    </html>
  )
}
```

### Facebook Pixel

```tsx
'use client'

import Script from 'next/script'

export default function FacebookPixel() {
  return (
    <>
      <Script
        id="facebook-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${process.env.NEXT_PUBLIC_FB_PIXEL_ID}');
            fbq('track', 'PageView');
          `,
        }}
      />
    </>
  )
}
```

### Intercom Chat Widget

```tsx
'use client'

import Script from 'next/script'

export default function Intercom() {
  return (
    <>
      <Script
        id="intercom"
        strategy="lazyOnload"
        onLoad={() => {
          window.Intercom('boot', {
            app_id: process.env.NEXT_PUBLIC_INTERCOM_APP_ID,
          })
        }}
      >
        {`
          (function(){var w=window;var ic=w.Intercom;if(typeof ic==="function"){
            ic('reattach_activator');ic('update',w.intercomSettings);}else{
            var d=document;var i=function(){i.c(arguments);};i.q=[];
            i.c=function(args){i.q.push(args);};w.Intercom=i;var l=function(){
            var s=d.createElement('script');s.type='text/javascript';s.async=true;
            s.src='https://widget.intercom.io/widget/${process.env.NEXT_PUBLIC_INTERCOM_APP_ID}';
            var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x);};
            if(document.readyState==='complete'){l();}else if(w.attachEvent){
            w.attachEvent('onload',l);}else{w.addEventListener('load',l,false);}}})();
        `}
      </Script>
    </>
  )
}
```

### Stripe

```tsx
'use client'

import Script from 'next/script'
import { useState } from 'react'

export default function StripeForm() {
  const [stripeLoaded, setStripeLoaded] = useState(false)

  return (
    <>
      <Script
        src="https://js.stripe.com/v3/"
        strategy="lazyOnload"
        onLoad={() => {
          setStripeLoaded(true)
          console.log('Stripe.js loaded')
        }}
      />

      {stripeLoaded && (
        <div id="payment-form">
          {/* Stripe payment form */}
        </div>
      )}
    </>
  )
}
```

## Advanced Patterns

### Conditional Script Loading

```tsx
'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

export default function ConditionalScript() {
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    // Load script based on user interaction or other conditions
    const hasConsent = localStorage.getItem('analytics-consent')
    if (hasConsent === 'true') {
      setShouldLoad(true)
    }
  }, [])

  return (
    <>
      {shouldLoad && (
        <Script
          src="https://example.com/analytics.js"
          strategy="afterInteractive"
        />
      )}
    </>
  )
}
```

### Script Loading Component

Create a reusable component for script management:

```tsx
// components/script-loader.tsx
'use client'

import Script from 'next/script'
import { useState } from 'react'

interface ScriptLoaderProps {
  src: string
  strategy?: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker'
  onLoadCallback?: () => void
}

export default function ScriptLoader({
  src,
  strategy = 'afterInteractive',
  onLoadCallback,
}: ScriptLoaderProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <>
      <Script
        src={src}
        strategy={strategy}
        onLoad={() => {
          setLoaded(true)
          onLoadCallback?.()
        }}
        onError={() => {
          setError(true)
        }}
      />

      {process.env.NODE_ENV === 'development' && (
        <div style={{ display: 'none' }}>
          Script: {src} - {loaded ? 'Loaded' : error ? 'Error' : 'Loading'}
        </div>
      )}
    </>
  )
}
```

## Performance Optimization

### Defer Non-Critical Scripts

```tsx
import Script from 'next/script'

export default function Page() {
  return (
    <>
      {/* Critical - load after interactive */}
      <Script
        src="https://example.com/analytics.js"
        strategy="afterInteractive"
      />

      {/* Non-critical - lazy load */}
      <Script
        src="https://example.com/social-widget.js"
        strategy="lazyOnload"
      />
    </>
  )
}
```

### Minimize Script Size

Load only necessary parts:

```tsx
// Bad - loading entire library
<Script src="https://cdn.example.com/library-full.js" />

// Good - loading only needed module
<Script src="https://cdn.example.com/library-analytics-only.js" />
```

### Use Async/Defer Attributes

```tsx
import Script from 'next/script'

export default function Page() {
  return (
    <Script
      src="https://example.com/script.js"
      strategy="afterInteractive"
      async // Load asynchronously
    />
  )
}
```

## Measurement

### Monitor Script Performance

```tsx
'use client'

import Script from 'next/script'
import { useEffect } from 'react'

export default function ScriptPerformance() {
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes('example.com')) {
          console.log('Script timing:', {
            name: entry.name,
            duration: entry.duration,
            transferSize: entry.transferSize,
          })
        }
      }
    })

    observer.observe({ entryTypes: ['resource'] })

    return () => observer.disconnect()
  }, [])

  return (
    <Script
      src="https://example.com/script.js"
      strategy="afterInteractive"
    />
  )
}
```

## Best Practices

1. **Choose Appropriate Strategy**: Use `lazyOnload` for non-critical scripts
2. **Use Event Callbacks**: Monitor loading for initialization
3. **Minimize Inline Scripts**: Keep them small and focused
4. **Deduplication**: Let Next.js handle it, don't manually track
5. **Environment Variables**: Keep sensitive data in env vars
6. **Error Handling**: Always handle script loading failures
7. **Conditional Loading**: Load scripts only when needed
8. **Performance Monitoring**: Track script impact on page performance

## Common Issues

### Script Not Loading

Ensure correct strategy and placement:

```tsx
// Wrong - beforeInteractive in page component
export default function Page() {
  return <Script strategy="beforeInteractive" src="..." />
}

// Correct - beforeInteractive in root layout
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Script strategy="beforeInteractive" src="..." />
        {children}
      </body>
    </html>
  )
}
```

### Script Executes Too Early

Use appropriate strategy:

```tsx
// If script needs DOM to be ready
<Script strategy="afterInteractive" src="..." />

// If script can wait
<Script strategy="lazyOnload" src="..." />
```

### Multiple Script Instances

Next.js automatically deduplicates, but ensure same src:

```tsx
// Both will deduplicate automatically
<Script src="https://example.com/script.js" />
<Script src="https://example.com/script.js" />
```

## Resources

- [Next.js Script Component Documentation](https://nextjs.org/docs/app/api-reference/components/script)
- [Script Optimization Guide](https://nextjs.org/docs/app/building-your-application/optimizing/scripts)
- [Third-Party Script Performance](https://web.dev/third-party-javascript/)
