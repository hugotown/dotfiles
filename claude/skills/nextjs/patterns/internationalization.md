# Internationalization (i18n) in Next.js

Complete guide to implementing internationalization in Next.js applications, including routing strategies, translation management, locale detection, and RTL support.

## Table of Contents

1. [Built-in i18n Routing](#built-in-i18n-routing)
2. [App Router i18n](#app-router-i18n)
3. [Translation Management](#translation-management)
4. [Locale Detection](#locale-detection)
5. [RTL Support](#rtl-support)
6. [SEO for Multilingual Sites](#seo-for-multilingual-sites)
7. [Best Practices](#best-practices)

## Built-in i18n Routing (Pages Router)

### Configuration

```javascript
// next.config.js
module.exports = {
  i18n: {
    locales: ['en', 'es', 'fr', 'de', 'ja'],
    defaultLocale: 'en',
    localeDetection: true,
    domains: [
      {
        domain: 'example.com',
        defaultLocale: 'en',
      },
      {
        domain: 'example.es',
        defaultLocale: 'es',
      },
      {
        domain: 'example.fr',
        defaultLocale: 'fr',
      },
    ],
  },
}
```

### Accessing Locale

```typescript
// pages/index.tsx
import { useRouter } from 'next/router'

export default function HomePage() {
  const { locale, locales, defaultLocale } = useRouter()

  return (
    <div>
      <p>Current locale: {locale}</p>
      <p>Default locale: {defaultLocale}</p>
      <p>Available locales: {locales?.join(', ')}</p>
    </div>
  )
}
```

### Locale Switching

```typescript
// components/LanguageSwitcher.tsx
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function LanguageSwitcher() {
  const router = useRouter()
  const { locales, locale: currentLocale, pathname, query, asPath } = router

  return (
    <div>
      {locales?.map((locale) => (
        <Link
          key={locale}
          href={{ pathname, query }}
          locale={locale}
          className={locale === currentLocale ? 'active' : ''}
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </div>
  )
}
```

## App Router i18n

The App Router doesn't have built-in i18n routing. Implement it manually using route groups and middleware.

### Project Structure

```
app/
├── [lang]/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── about/
│   │   └── page.tsx
│   └── blog/
│       └── [slug]/
│           └── page.tsx
├── middleware.ts
└── i18n/
    ├── config.ts
    ├── dictionaries/
    │   ├── en.json
    │   ├── es.json
    │   ├── fr.json
    │   └── de.json
    └── server.ts
```

### i18n Configuration

```typescript
// i18n/config.ts
export const i18n = {
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr', 'de', 'ja'],
} as const

export type Locale = (typeof i18n)['locales'][number]

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
}
```

### Middleware for Locale Detection

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { i18n } from './i18n/config'

function getLocale(request: NextRequest): string {
  // 1. Check URL parameter
  const pathname = request.nextUrl.pathname
  const pathnameLocale = i18n.locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )
  if (pathnameLocale) return pathnameLocale

  // 2. Check cookie
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value
  if (cookieLocale && i18n.locales.includes(cookieLocale as any)) {
    return cookieLocale
  }

  // 3. Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language')
  if (acceptLanguage) {
    const headerLocale = acceptLanguage
      .split(',')[0]
      .split('-')[0]
      .toLowerCase()
    if (i18n.locales.includes(headerLocale as any)) {
      return headerLocale
    }
  }

  // 4. Fall back to default
  return i18n.defaultLocale
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip if pathname already includes locale
  const pathnameHasLocale = i18n.locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) return

  // Redirect to locale-prefixed URL
  const locale = getLocale(request)
  const newUrl = new URL(`/${locale}${pathname}`, request.url)
  newUrl.search = request.nextUrl.search

  const response = NextResponse.redirect(newUrl)
  response.cookies.set('NEXT_LOCALE', locale)

  return response
}

export const config = {
  matcher: [
    // Skip all internal paths (_next, api, etc.)
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
```

### Dictionary Loading

```typescript
// i18n/server.ts
import 'server-only'
import type { Locale } from './config'

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  es: () => import('./dictionaries/es.json').then((module) => module.default),
  fr: () => import('./dictionaries/fr.json').then((module) => module.default),
  de: () => import('./dictionaries/de.json').then((module) => module.default),
  ja: () => import('./dictionaries/ja.json').then((module) => module.default),
}

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]()
}
```

### Dictionary Files

```json
// i18n/dictionaries/en.json
{
  "common": {
    "home": "Home",
    "about": "About",
    "contact": "Contact",
    "language": "Language"
  },
  "home": {
    "title": "Welcome",
    "description": "This is the home page",
    "cta": "Get Started"
  },
  "navigation": {
    "menu": "Menu",
    "close": "Close"
  }
}
```

```json
// i18n/dictionaries/es.json
{
  "common": {
    "home": "Inicio",
    "about": "Acerca de",
    "contact": "Contacto",
    "language": "Idioma"
  },
  "home": {
    "title": "Bienvenido",
    "description": "Esta es la página de inicio",
    "cta": "Comenzar"
  },
  "navigation": {
    "menu": "Menú",
    "close": "Cerrar"
  }
}
```

### Layout with Language Support

```typescript
// app/[lang]/layout.tsx
import { i18n, type Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/server'

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ lang: locale }))
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { lang: Locale }
}) {
  const dict = await getDictionary(params.lang)

  return (
    <html lang={params.lang} dir={params.lang === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <nav>
          {/* Navigation using dictionary */}
          <a href={`/${params.lang}`}>{dict.common.home}</a>
          <a href={`/${params.lang}/about`}>{dict.common.about}</a>
        </nav>
        {children}
      </body>
    </html>
  )
}
```

### Page with Translations

```typescript
// app/[lang]/page.tsx
import { getDictionary } from '@/i18n/server'
import { Locale } from '@/i18n/config'

export default async function HomePage({
  params: { lang },
}: {
  params: { lang: Locale }
}) {
  const dict = await getDictionary(lang)

  return (
    <div>
      <h1>{dict.home.title}</h1>
      <p>{dict.home.description}</p>
      <button>{dict.home.cta}</button>
    </div>
  )
}
```

### Language Switcher Component

```typescript
// components/LanguageSwitcher.tsx
'use client'

import { usePathname, useRouter } from 'next/navigation'
import { i18n, localeNames, type Locale } from '@/i18n/config'

export default function LanguageSwitcher({ currentLang }: { currentLang: Locale }) {
  const pathname = usePathname()
  const router = useRouter()

  const switchLanguage = (newLang: Locale) => {
    // Remove current language prefix from pathname
    const segments = pathname.split('/')
    segments[1] = newLang
    const newPathname = segments.join('/')

    // Set cookie and navigate
    document.cookie = `NEXT_LOCALE=${newLang}; path=/; max-age=31536000`
    router.push(newPathname)
  }

  return (
    <select
      value={currentLang}
      onChange={(e) => switchLanguage(e.target.value as Locale)}
      className="border rounded px-2 py-1"
    >
      {i18n.locales.map((locale) => (
        <option key={locale} value={locale}>
          {localeNames[locale]}
        </option>
      ))}
    </select>
  )
}
```

## Translation Management

### Using next-intl (Recommended Library)

```bash
npm install next-intl
```

#### Configuration

```typescript
// i18n.ts
import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default
}))
```

```typescript
// next.config.js
const withNextIntl = require('next-intl/plugin')()

module.exports = withNextIntl({
  // Your Next.js config
})
```

#### Usage in Server Components

```typescript
// app/[locale]/page.tsx
import { useTranslations } from 'next-intl'

export default function HomePage() {
  const t = useTranslations('home')

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  )
}
```

#### Usage in Client Components

```typescript
'use client'

import { useTranslations } from 'next-intl'

export default function ClientComponent() {
  const t = useTranslations('common')

  return <button>{t('submit')}</button>
}
```

#### Pluralization

```json
// messages/en.json
{
  "items": {
    "count": "{count, plural, =0 {No items} =1 {One item} other {# items}}"
  }
}
```

```typescript
const t = useTranslations('items')
t('count', { count: 0 }) // "No items"
t('count', { count: 1 }) // "One item"
t('count', { count: 5 }) // "5 items"
```

#### Date and Number Formatting

```typescript
import { useFormatter } from 'next-intl'

export default function FormattingExample() {
  const format = useFormatter()

  return (
    <div>
      {/* Date formatting */}
      <p>{format.dateTime(new Date(), { dateStyle: 'long' })}</p>

      {/* Number formatting */}
      <p>{format.number(1234.56, { style: 'currency', currency: 'USD' })}</p>

      {/* Relative time */}
      <p>{format.relativeTime(new Date('2024-01-01'))}</p>
    </div>
  )
}
```

### Using react-i18next

```bash
npm install react-i18next i18next
```

```typescript
// lib/i18n.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import es from './locales/es.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
```

## Locale Detection

### Browser Language Detection

```typescript
// lib/locale-detection.ts
import { i18n } from '@/i18n/config'

export function detectBrowserLocale(): string {
  if (typeof window === 'undefined') return i18n.defaultLocale

  const browserLanguage = navigator.language.split('-')[0].toLowerCase()

  if (i18n.locales.includes(browserLanguage as any)) {
    return browserLanguage
  }

  return i18n.defaultLocale
}
```

### Geolocation-Based Detection

```typescript
// app/api/locale/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const country = request.geo?.country || 'US'

  const countryLocaleMap: Record<string, string> = {
    US: 'en',
    GB: 'en',
    ES: 'es',
    FR: 'fr',
    DE: 'de',
    JP: 'ja',
  }

  const locale = countryLocaleMap[country] || 'en'

  return NextResponse.json({ locale, country })
}
```

### Cookie-Based Persistence

```typescript
// lib/locale-cookies.ts
import { cookies } from 'next/headers'

const COOKIE_NAME = 'NEXT_LOCALE'

export function getLocaleFromCookie(): string | null {
  return cookies().get(COOKIE_NAME)?.value || null
}

export function setLocaleCookie(locale: string) {
  cookies().set(COOKIE_NAME, locale, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  })
}
```

## RTL Support

### Direction Detection

```typescript
// lib/rtl.ts
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur']

export function isRTL(locale: string): boolean {
  return RTL_LANGUAGES.includes(locale)
}

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return isRTL(locale) ? 'rtl' : 'ltr'
}
```

### Layout with RTL Support

```typescript
// app/[lang]/layout.tsx
import { getDirection } from '@/lib/rtl'

export default function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { lang: string }
}) {
  const dir = getDirection(params.lang)

  return (
    <html lang={params.lang} dir={dir}>
      <body className={dir === 'rtl' ? 'rtl' : 'ltr'}>
        {children}
      </body>
    </html>
  )
}
```

### RTL-Aware Styles

```css
/* styles/globals.css */

/* Logical properties (recommended) */
.container {
  margin-inline-start: 1rem;
  margin-inline-end: 1rem;
  padding-inline: 1rem;
}

/* Direction-specific styles */
[dir='rtl'] .arrow {
  transform: scaleX(-1);
}

[dir='ltr'] .text-align {
  text-align: left;
}

[dir='rtl'] .text-align {
  text-align: right;
}
```

### Tailwind CSS RTL Support

```bash
npm install tailwindcss-rtl
```

```javascript
// tailwind.config.js
module.exports = {
  plugins: [
    require('tailwindcss-rtl'),
  ],
}
```

```tsx
// Usage
<div className="ms-4 me-2"> {/* margin-start: 1rem, margin-end: 0.5rem */}
  <p className="text-start">Text aligned to start</p>
</div>
```

## SEO for Multilingual Sites

### Alternate Links

```typescript
// app/[lang]/layout.tsx
import { i18n } from '@/i18n/config'

export default function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { lang: string }
}) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com'

  return (
    <html lang={params.lang}>
      <head>
        {/* Alternate language links for SEO */}
        {i18n.locales.map((locale) => (
          <link
            key={locale}
            rel="alternate"
            hrefLang={locale}
            href={`${baseUrl}/${locale}`}
          />
        ))}
        <link
          rel="alternate"
          hrefLang="x-default"
          href={`${baseUrl}/${i18n.defaultLocale}`}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Metadata for Each Locale

```typescript
// app/[lang]/page.tsx
import { Metadata } from 'next'
import { getDictionary } from '@/i18n/server'
import { Locale } from '@/i18n/config'

export async function generateMetadata({
  params: { lang },
}: {
  params: { lang: Locale }
}): Promise<Metadata> {
  const dict = await getDictionary(lang)

  return {
    title: dict.metadata.title,
    description: dict.metadata.description,
    alternates: {
      languages: {
        'en': '/en',
        'es': '/es',
        'fr': '/fr',
        'de': '/de',
        'x-default': '/en',
      },
    },
    openGraph: {
      title: dict.metadata.title,
      description: dict.metadata.description,
      locale: lang,
    },
  }
}
```

### Sitemap with Multiple Locales

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'
import { i18n } from '@/i18n/config'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://example.com'

  const routes = ['', '/about', '/blog']

  return routes.flatMap((route) =>
    i18n.locales.map((locale) => ({
      url: `${baseUrl}/${locale}${route}`,
      lastModified: new Date(),
      alternates: {
        languages: Object.fromEntries(
          i18n.locales.map((l) => [l, `${baseUrl}/${l}${route}`])
        ),
      },
    }))
  )
}
```

## Best Practices

### 1. Translation Key Organization

```json
{
  "common": {
    "buttons": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete"
    },
    "errors": {
      "required": "This field is required",
      "invalid": "Invalid input"
    }
  },
  "pages": {
    "home": {
      "title": "Welcome",
      "subtitle": "Get started with our platform"
    }
  },
  "components": {
    "header": {
      "navigation": "Navigation",
      "search": "Search"
    }
  }
}
```

### 2. Avoid Hard-Coded Strings

```typescript
// ❌ Bad
<button>Submit</button>

// ✅ Good
<button>{t('common.buttons.submit')}</button>
```

### 3. Use TypeScript for Type Safety

```typescript
// types/i18n.ts
import en from '@/i18n/dictionaries/en.json'

type Messages = typeof en
declare global {
  interface IntlMessages extends Messages {}
}
```

### 4. Lazy Load Translations

```typescript
// Only load translations when needed
const dict = await getDictionary(locale)
```

### 5. Handle Missing Translations

```typescript
// lib/translate.ts
export function translate(
  dict: Record<string, any>,
  key: string,
  fallback?: string
): string {
  const keys = key.split('.')
  let value = dict

  for (const k of keys) {
    if (value[k] === undefined) {
      return fallback || key
    }
    value = value[k]
  }

  return value
}
```

## Common Pitfalls

1. **Not setting lang attribute**: Always set `<html lang={locale}>`
2. **Hard-coding text in components**: Use translation keys
3. **Not handling missing translations**: Provide fallbacks
4. **Ignoring RTL layouts**: Test with RTL languages
5. **Poor SEO setup**: Include alternate links and proper metadata
6. **Not testing all locales**: Test UI with all supported languages
7. **Client-side only i18n**: Implement server-side for better SEO
8. **Large translation files**: Split by page/feature

## Testing i18n

```typescript
// __tests__/i18n.test.tsx
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import HomePage from '@/app/[locale]/page'

const messages = {
  home: {
    title: 'Welcome',
    description: 'Test description',
  },
}

describe('HomePage i18n', () => {
  it('renders translated content', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <HomePage />
      </NextIntlClientProvider>
    )

    expect(screen.getByText('Welcome')).toBeInTheDocument()
  })
})
```

## Resources

- [Next.js i18n Documentation](https://nextjs.org/docs/advanced-features/i18n-routing)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [React i18next Documentation](https://react.i18next.com/)
- [Unicode CLDR](http://cldr.unicode.org/)
