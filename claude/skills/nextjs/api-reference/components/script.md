# Next.js Script Component

The `next/script` component extends the HTML `<script>` element with optimized loading strategies for third-party scripts.

## Import

```jsx
import Script from 'next/script'
```

## Basic Usage

```jsx
import Script from 'next/script'

export default function Page() {
  return (
    <>
      <Script src="https://example.com/script.js" />
    </>
  )
}
```

## Props API Reference

### src
- **Type**: `string`
- **Description**: URL of external script
- **Required**: Yes (unless using inline script)

```jsx
<Script src="https://example.com/analytics.js" />
```

### strategy
- **Type**: `'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker'`
- **Default**: `'afterInteractive'`
- **Description**: Loading strategy for the script

#### beforeInteractive
- Loads before page becomes interactive
- Injected in server HTML
- **Use for**: Critical scripts needed immediately

```jsx
<Script
  src="https://example.com/critical.js"
  strategy="beforeInteractive"
/>
```

#### afterInteractive (default)
- Loads after page becomes interactive
- **Use for**: Analytics, tag managers, non-critical scripts

```jsx
<Script
  src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"
  strategy="afterInteractive"
/>
```

#### lazyOnload
- Loads during idle time
- **Use for**: Chat widgets, social embeds, non-essential scripts

```jsx
<Script
  src="https://connect.facebook.net/en_US/sdk.js"
  strategy="lazyOnload"
/>
```

#### worker (Experimental)
- Loads in a web worker via Partytown
- **Use for**: Offloading heavy scripts to background thread

```jsx
<Script
  src="https://example.com/heavy-script.js"
  strategy="worker"
/>
```

### onLoad
- **Type**: `() => void`
- **Description**: Callback executed after script loads

```jsx
<Script
  src="https://example.com/script.js"
  onLoad={() => {
    console.log('Script loaded')
  }}
/>
```

### onReady
- **Type**: `() => void`
- **Description**: Callback executed after script loads and every time component mounts

```jsx
<Script
  src="https://example.com/script.js"
  onReady={() => {
    console.log('Script ready')
  }}
/>
```

### onError
- **Type**: `(error: Error) => void`
- **Description**: Callback executed when script fails to load

```jsx
<Script
  src="https://example.com/script.js"
  onError={(error) => {
    console.error('Script failed to load', error)
  }}
/>
```

### id
- **Type**: `string`
- **Description**: Unique identifier for the script

```jsx
<Script
  id="google-analytics"
  src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"
/>
```

### nonce
- **Type**: `string`
- **Description**: Cryptographic nonce for Content Security Policy

```jsx
<Script
  src="https://example.com/script.js"
  nonce="RANDOM_NONCE"
/>
```

### data-* attributes
- **Type**: `string`
- **Description**: Custom data attributes

```jsx
<Script
  src="https://example.com/script.js"
  data-domain="example.com"
  data-api="/api/event"
/>
```

## Loading Strategies in Detail

### Strategy Selection Guide

| Strategy | Loading Time | Use Case | Example |
|----------|-------------|----------|---------|
| `beforeInteractive` | Before hydration | Critical scripts | Polyfills, A/B testing |
| `afterInteractive` | After hydration | Analytics, ads | Google Analytics, GTM |
| `lazyOnload` | During idle time | Non-essential | Chat widgets, social |
| `worker` | In web worker | Heavy scripts | Complex analytics |

### beforeInteractive

**When to use:**
- Polyfills
- Bot detection
- Cookie consent managers
- A/B testing frameworks

**Placement:**
- Must be in `app/layout.js` (root layout)
- Loaded before any Next.js code

```jsx
// app/layout.js
import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Script
          src="https://cdn.example.com/polyfill.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  )
}
```

### afterInteractive

**When to use:**
- Google Analytics
- Google Tag Manager
- Facebook Pixel
- Most third-party scripts

**Placement:**
- Any component
- Loads after page is interactive

```jsx
<Script
  src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"
  strategy="afterInteractive"
/>
```

### lazyOnload

**When to use:**
- Chat widgets (Intercom, Drift)
- Social media embeds
- Comment systems
- Non-critical marketing scripts

**Placement:**
- Any component
- Deferred until browser idle time

```jsx
<Script
  src="https://widget.intercom.io/widget/APP_ID"
  strategy="lazyOnload"
/>
```

### worker (Experimental)

**When to use:**
- Heavy analytics scripts
- Complex tracking code
- Resource-intensive third-party scripts

**Setup required:**
```jsx
// next.config.js
module.exports = {
  experimental: {
    nextScriptWorkers: true,
  },
}
```

```jsx
<Script
  src="https://example.com/heavy-analytics.js"
  strategy="worker"
/>
```

## Common Patterns

### Google Analytics

```jsx
import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'GA_MEASUREMENT_ID');
          `}
        </Script>
      </body>
    </html>
  )
}
```

### Google Tag Manager

```jsx
<Script
  id="gtm"
  strategy="afterInteractive"
  dangerouslySetInnerHTML={{
    __html: `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','GTM_ID');
    `,
  }}
/>
```

### Facebook Pixel

```jsx
<Script
  id="facebook-pixel"
  strategy="afterInteractive"
>
  {`
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', 'PIXEL_ID');
    fbq('track', 'PageView');
  `}
</Script>
```

### Intercom Chat Widget

```jsx
<Script
  id="intercom"
  strategy="lazyOnload"
  onLoad={() => {
    window.Intercom('boot', {
      app_id: 'YOUR_APP_ID',
    })
  }}
>
  {`
    (function(){var w=window;var ic=w.Intercom;if(typeof ic==="function"){
    ic('reattach_activator');ic('update',w.intercomSettings);}else{var d=document;
    var i=function(){i.c(arguments);};i.q=[];i.c=function(args){i.q.push(args);};
    w.Intercom=i;var l=function(){var s=d.createElement('script');s.type='text/javascript';
    s.async=true;s.src='https://widget.intercom.io/widget/YOUR_APP_ID';
    var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x);};
    if(document.readyState==='complete'){l();}else if(w.attachEvent){
    w.attachEvent('onload',l);}else{w.addEventListener('load',l,false);}}})();
  `}
</Script>
```

### Stripe.js

```jsx
'use client'

import Script from 'next/script'
import { useState } from 'react'

export default function CheckoutForm() {
  const [stripeLoaded, setStripeLoaded] = useState(false)

  return (
    <>
      <Script
        src="https://js.stripe.com/v3/"
        onLoad={() => setStripeLoaded(true)}
        strategy="afterInteractive"
      />

      {stripeLoaded && (
        <div>
          {/* Stripe checkout form */}
        </div>
      )}
    </>
  )
}
```

### reCAPTCHA

```jsx
<Script
  src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
  strategy="afterInteractive"
  onLoad={() => {
    window.grecaptcha.ready(() => {
      console.log('reCAPTCHA ready')
    })
  }}
/>
```

### Hotjar Analytics

```jsx
<Script
  id="hotjar"
  strategy="afterInteractive"
>
  {`
    (function(h,o,t,j,a,r){
      h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
      h._hjSettings={hjid:HOTJAR_ID,hjsv:6};
      a=o.getElementsByTagName('head')[0];
      r=o.createElement('script');r.async=1;
      r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
      a.appendChild(r);
    })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
  `}
</Script>
```

### Inline Script with Data

```jsx
'use client'

import Script from 'next/script'

export default function Page({ user }) {
  return (
    <Script
      id="user-data"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          window.__USER__ = ${JSON.stringify(user)};
        `,
      }}
    />
  )
}
```

### Conditional Script Loading

```jsx
'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

export default function ConditionalScript() {
  const [shouldLoadScript, setShouldLoadScript] = useState(false)

  useEffect(() => {
    // Load script based on user consent
    const hasConsent = localStorage.getItem('analytics-consent')
    setShouldLoadScript(hasConsent === 'true')
  }, [])

  if (!shouldLoadScript) return null

  return (
    <Script
      src="https://analytics.example.com/script.js"
      strategy="afterInteractive"
    />
  )
}
```

### Multiple Scripts with Dependencies

```jsx
'use client'

import Script from 'next/script'
import { useState } from 'react'

export default function DependentScripts() {
  const [jqueryLoaded, setJqueryLoaded] = useState(false)

  return (
    <>
      {/* Load jQuery first */}
      <Script
        src="https://code.jquery.com/jquery-3.6.0.min.js"
        strategy="afterInteractive"
        onLoad={() => setJqueryLoaded(true)}
      />

      {/* Load jQuery plugin after jQuery is ready */}
      {jqueryLoaded && (
        <Script
          src="https://example.com/jquery-plugin.js"
          strategy="afterInteractive"
        />
      )}
    </>
  )
}
```

### Dynamic Script Loading

```jsx
'use client'

import Script from 'next/script'

export default function DynamicScript({ scriptUrl }) {
  return (
    <Script
      src={scriptUrl}
      strategy="lazyOnload"
      onLoad={() => console.log(`Script loaded: ${scriptUrl}`)}
      onError={() => console.error(`Script failed: ${scriptUrl}`)}
    />
  )
}
```

## Inline Scripts

### Basic Inline Script

```jsx
<Script id="inline-script" strategy="afterInteractive">
  {`console.log('Inline script executed')`}
</Script>
```

### Inline Script with dangerouslySetInnerHTML

```jsx
<Script
  id="config"
  strategy="beforeInteractive"
  dangerouslySetInnerHTML={{
    __html: `
      window.CONFIG = {
        apiUrl: '${process.env.NEXT_PUBLIC_API_URL}',
        environment: '${process.env.NODE_ENV}'
      };
    `,
  }}
/>
```

## Performance Optimization

### Best Practices

1. **Choose appropriate strategy**:
   - Use `beforeInteractive` sparingly
   - Prefer `afterInteractive` for most scripts
   - Use `lazyOnload` for non-critical scripts

2. **Minimize script size**:
   - Use minified versions
   - Remove unused scripts
   - Consider async/defer alternatives

3. **Monitor performance**:
   - Check Core Web Vitals impact
   - Use Chrome DevTools Performance panel
   - Monitor Third-Party script impact

4. **Use web workers** for heavy scripts:
   - Enable with `strategy="worker"`
   - Offload expensive operations

### Performance Metrics Impact

```jsx
// Good - lazy loaded chat widget
<Script
  src="https://widget.example.com/chat.js"
  strategy="lazyOnload"
/>

// Bad - blocks initial render
<script src="https://widget.example.com/chat.js"></script>
```

## Content Security Policy

### With Nonce

```jsx
// middleware.js
export function middleware(request) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const cspHeader = `
    script-src 'self' 'nonce-${nonce}' https://trusted.com;
  `

  const response = NextResponse.next()
  response.headers.set('Content-Security-Policy', cspHeader)
  response.headers.set('x-nonce', nonce)

  return response
}
```

```jsx
import Script from 'next/script'
import { headers } from 'next/headers'

export default function Page() {
  const nonce = headers().get('x-nonce')

  return (
    <Script
      src="https://trusted.com/script.js"
      nonce={nonce}
      strategy="afterInteractive"
    />
  )
}
```

## Troubleshooting

### Script not loading
- Check browser console for errors
- Verify URL is correct and accessible
- Check Content Security Policy settings
- Ensure strategy is appropriate

### Script loading too early/late
- Adjust strategy (`beforeInteractive`, `afterInteractive`, `lazyOnload`)
- Use `onLoad` callback to verify loading
- Check network tab in DevTools

### Multiple instances loading
- Use `id` prop to prevent duplicates
- Place script in layout for app-wide usage
- Check for duplicate Script components

### Performance issues
- Use `lazyOnload` for non-critical scripts
- Consider `worker` strategy for heavy scripts
- Monitor with Lighthouse/Chrome DevTools

## Accessibility

Scripts should not negatively impact accessibility:

1. **Maintain keyboard navigation**: Ensure scripts don't break keyboard access
2. **Screen reader compatibility**: Test with screen readers
3. **Focus management**: Scripts shouldn't steal or lose focus
4. **No blocking**: Don't block user interactions

## Security Best Practices

1. **Use HTTPS**: Only load scripts over HTTPS
2. **Implement CSP**: Use Content Security Policy with nonces
3. **Verify sources**: Only load scripts from trusted domains
4. **Regular updates**: Keep third-party scripts updated
5. **Monitor scripts**: Use Subresource Integrity (SRI) when possible

```jsx
<Script
  src="https://trusted.com/script.js"
  integrity="sha384-HASH"
  crossOrigin="anonymous"
  strategy="afterInteractive"
/>
```

## Migration from next/head

```jsx
// Old (next/head)
import Head from 'next/head'

<Head>
  <script src="https://example.com/script.js" />
</Head>

// New (next/script)
import Script from 'next/script'

<Script src="https://example.com/script.js" strategy="afterInteractive" />
```

## Common Third-Party Integrations

- **Analytics**: Google Analytics, Plausible, Fathom
- **Marketing**: Facebook Pixel, LinkedIn Insight, Twitter
- **Tag Managers**: Google Tag Manager, Segment
- **Customer Support**: Intercom, Zendesk, Drift
- **Error Tracking**: Sentry, Bugsnag
- **A/B Testing**: Optimizely, VWO
- **Payment**: Stripe, PayPal
- **Maps**: Google Maps, Mapbox
- **Social**: Facebook SDK, Twitter widgets

Each integration should use the appropriate loading strategy based on its criticality.
