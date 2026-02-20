# Sass/SCSS in Next.js App Router

Sass (Syntactically Awesome Style Sheets) is a CSS preprocessor that extends CSS with features like variables, nesting, mixins, and functions.

## Overview

Next.js has built-in support for Sass, providing powerful preprocessing capabilities with zero runtime overhead. Sass works seamlessly with both Server and Client Components.

## Installation

```bash
npm install -D sass
```

That's it! Next.js automatically configures Sass once the package is installed.

## Basic Usage

### SCSS Files

SCSS uses CSS-like syntax with additional features:

```scss
// components/button.module.scss
$primary-color: #0070f3;
$secondary-color: #7928ca;
$border-radius: 8px;

.button {
  padding: 12px 24px;
  border-radius: $border-radius;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  &.primary {
    background-color: $primary-color;
    color: white;

    &:hover {
      background-color: darken($primary-color, 10%);
    }
  }

  &.secondary {
    background-color: $secondary-color;
    color: white;

    &:hover {
      background-color: darken($secondary-color, 10%);
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
```

```typescript
// components/Button.tsx
import styles from './button.module.scss'

interface ButtonProps {
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  children: React.ReactNode
}

export default function Button({
  variant = 'primary',
  disabled,
  children
}: ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[variant]}`}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
```

### Sass Files (Indented Syntax)

Sass also supports indented syntax without braces:

```sass
// components/card.module.sass
$card-padding: 24px
$card-radius: 12px

.card
  padding: $card-padding
  border-radius: $card-radius
  background: white
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)

  &:hover
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)

  .title
    font-size: 24px
    font-weight: bold
    margin-bottom: 16px

  .content
    color: #666
    line-height: 1.6
```

## Variables

### Local Variables

```scss
// components/layout.module.scss
$container-max-width: 1200px;
$gutter: 16px;
$header-height: 80px;

.container {
  max-width: $container-max-width;
  padding: 0 $gutter;
  margin: 0 auto;
}

.header {
  height: $header-height;
  position: sticky;
  top: 0;
}

.main {
  min-height: calc(100vh - #{$header-height});
  padding: $gutter * 2;
}
```

### Global Variables

```scss
// styles/_variables.scss
// Colors
$primary-100: #e6f2ff;
$primary-500: #0070f3;
$primary-900: #003d85;

$secondary-500: #7928ca;

$gray-100: #f5f5f5;
$gray-500: #666666;
$gray-900: #1a1a1a;

// Spacing
$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 16px;
$spacing-lg: 24px;
$spacing-xl: 32px;
$spacing-2xl: 48px;

// Typography
$font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
$font-family-mono: 'SF Mono', Monaco, monospace;

$font-size-xs: 12px;
$font-size-sm: 14px;
$font-size-base: 16px;
$font-size-lg: 18px;
$font-size-xl: 20px;
$font-size-2xl: 24px;

// Border Radius
$radius-sm: 4px;
$radius-md: 8px;
$radius-lg: 12px;
$radius-xl: 16px;

// Breakpoints
$breakpoint-sm: 640px;
$breakpoint-md: 768px;
$breakpoint-lg: 1024px;
$breakpoint-xl: 1280px;
```

Import variables in components:

```scss
// components/card.module.scss
@use '@/styles/variables' as *;

.card {
  padding: $spacing-lg;
  background: white;
  border-radius: $radius-lg;
  font-family: $font-family-sans;

  @media (min-width: $breakpoint-md) {
    padding: $spacing-xl;
  }
}
```

## Nesting

### Basic Nesting

```scss
// components/navigation.module.scss
.nav {
  display: flex;
  gap: 16px;
  padding: 20px;

  .navList {
    display: flex;
    gap: 12px;
    list-style: none;

    .navItem {
      position: relative;

      .navLink {
        padding: 8px 16px;
        color: #666;
        text-decoration: none;
        transition: color 0.2s;

        &:hover {
          color: #0070f3;
        }

        &.active {
          color: #0070f3;
          font-weight: 600;

          &::after {
            content: '';
            position: absolute;
            bottom: -4px;
            left: 0;
            right: 0;
            height: 2px;
            background: #0070f3;
          }
        }
      }
    }
  }
}
```

### Parent Selector (`&`)

```scss
// components/button.module.scss
.button {
  padding: 12px 24px;
  background: #0070f3;
  color: white;

  // Hover state
  &:hover {
    background: #0051cc;
  }

  // Focus state
  &:focus {
    outline: 2px solid #0070f3;
    outline-offset: 2px;
  }

  // Disabled state
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  // Modifier classes
  &.small {
    padding: 8px 16px;
    font-size: 14px;
  }

  &.large {
    padding: 16px 32px;
    font-size: 18px;
  }

  // Compound selectors
  &.primary {
    background: #0070f3;
  }

  &.secondary {
    background: #7928ca;
  }

  // Adjacent sibling
  & + & {
    margin-left: 12px;
  }
}
```

## Mixins

### Basic Mixins

```scss
// styles/_mixins.scss
@mixin flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

@mixin truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@mixin card-shadow {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}
```

Usage:

```scss
// components/card.module.scss
@use '@/styles/mixins' as *;

.card {
  @include card-shadow;
  padding: 24px;
  border-radius: 8px;

  .header {
    @include flex-center;
    margin-bottom: 16px;
  }

  .title {
    @include truncate;
    max-width: 300px;
  }
}
```

### Mixins with Arguments

```scss
// styles/_mixins.scss
@mixin button-variant($bg-color, $text-color) {
  background-color: $bg-color;
  color: $text-color;

  &:hover {
    background-color: darken($bg-color, 10%);
  }

  &:active {
    background-color: darken($bg-color, 15%);
  }
}

@mixin responsive-padding($mobile, $tablet, $desktop) {
  padding: $mobile;

  @media (min-width: 768px) {
    padding: $tablet;
  }

  @media (min-width: 1024px) {
    padding: $desktop;
  }
}

@mixin aspect-ratio($width, $height) {
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    display: block;
    padding-bottom: calc(#{$height} / #{$width} * 100%);
  }

  > * {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
}
```

Usage:

```scss
// components/buttons.module.scss
@use '@/styles/mixins' as *;

.primaryButton {
  @include button-variant(#0070f3, white);
}

.secondaryButton {
  @include button-variant(#7928ca, white);
}

.section {
  @include responsive-padding(16px, 24px, 32px);
}

.videoContainer {
  @include aspect-ratio(16, 9);
}
```

### Default Arguments

```scss
@mixin transition($property: all, $duration: 0.2s, $timing: ease) {
  transition: $property $duration $timing;
}

.button {
  @include transition; // Uses defaults
}

.card {
  @include transition(box-shadow, 0.3s); // Custom duration
}
```

## Functions

### Built-in Functions

```scss
// components/theme.module.scss
$primary-color: #0070f3;

.button {
  background-color: $primary-color;

  &:hover {
    background-color: darken($primary-color, 10%);
  }

  &:active {
    background-color: darken($primary-color, 15%);
  }
}

.lightButton {
  background-color: lighten($primary-color, 40%);
  color: $primary-color;
}

.transparentButton {
  background-color: rgba($primary-color, 0.1);
  color: $primary-color;
}

.mixedColor {
  background-color: mix($primary-color, white, 20%);
}
```

### Custom Functions

```scss
// styles/_functions.scss
@function strip-unit($value) {
  @return $value / ($value * 0 + 1);
}

@function rem($pixels, $context: 16) {
  @return #{strip-unit($pixels) / strip-unit($context)}rem;
}

@function em($pixels, $context: 16) {
  @return #{strip-unit($pixels) / strip-unit($context)}em;
}

// Calculate optimal text color based on background
@function contrast-color($color) {
  $lightness: lightness($color);
  @if $lightness > 50% {
    @return #000;
  } @else {
    @return #fff;
  }
}
```

Usage:

```scss
@use '@/styles/functions' as *;

.container {
  padding: rem(24px); // 1.5rem
  font-size: rem(18px); // 1.125rem
}

.dynamicButton {
  $bg: #0070f3;
  background-color: $bg;
  color: contrast-color($bg); // White because background is dark
}
```

## Partials and Imports

### Using `@use` (Modern)

```scss
// styles/_variables.scss
$primary-color: #0070f3;
$spacing-md: 16px;

// styles/_mixins.scss
@mixin flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

// components/card.module.scss
@use '@/styles/variables' as vars;
@use '@/styles/mixins';

.card {
  padding: vars.$spacing-md;
  background: vars.$primary-color;

  .header {
    @include mixins.flex-center;
  }
}
```

### Using `@forward`

Create an index file to aggregate imports:

```scss
// styles/_index.scss
@forward 'variables';
@forward 'mixins';
@forward 'functions';

// components/component.module.scss
@use '@/styles' as *;

.component {
  padding: $spacing-md; // From variables
  @include flex-center; // From mixins
  font-size: rem(18px); // From functions
}
```

### Legacy `@import`

```scss
// Not recommended, but still works
@import '@/styles/variables';
@import '@/styles/mixins';

.component {
  padding: $spacing-md;
}
```

## Responsive Design

### Breakpoint Mixins

```scss
// styles/_breakpoints.scss
$breakpoints: (
  'sm': 640px,
  'md': 768px,
  'lg': 1024px,
  'xl': 1280px,
  '2xl': 1536px
);

@mixin breakpoint($size) {
  @media (min-width: map-get($breakpoints, $size)) {
    @content;
  }
}

@mixin breakpoint-max($size) {
  @media (max-width: map-get($breakpoints, $size) - 1px) {
    @content;
  }
}

@mixin breakpoint-between($min, $max) {
  @media (min-width: map-get($breakpoints, $min)) and (max-width: map-get($breakpoints, $max) - 1px) {
    @content;
  }
}
```

Usage:

```scss
// components/grid.module.scss
@use '@/styles/breakpoints' as *;

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;

  @include breakpoint('md') {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }

  @include breakpoint('lg') {
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
  }

  @include breakpoint('xl') {
    grid-template-columns: repeat(4, 1fr);
  }
}

.sidebar {
  display: none;

  @include breakpoint('lg') {
    display: block;
  }
}

.mobileOnly {
  @include breakpoint-max('md') {
    display: block;
  }

  @include breakpoint('md') {
    display: none;
  }
}
```

## Advanced Patterns

### BEM with Sass

```scss
// components/product-card.module.scss
.productCard {
  padding: 24px;
  background: white;
  border-radius: 8px;

  &__image {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 4px;
    margin-bottom: 16px;
  }

  &__title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  &__description {
    color: #666;
    margin-bottom: 16px;
    line-height: 1.6;
  }

  &__price {
    font-size: 24px;
    font-weight: bold;
    color: #0070f3;
  }

  &__button {
    width: 100%;
    padding: 12px;
    background: #0070f3;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    margin-top: 16px;

    &:hover {
      background: #0051cc;
    }
  }

  // Modifier
  &--featured {
    border: 2px solid #0070f3;

    .productCard__title {
      color: #0070f3;
    }
  }

  // State
  &--sold-out {
    opacity: 0.6;

    .productCard__button {
      background: #ccc;
      cursor: not-allowed;
    }
  }
}
```

### Maps and Loops

```scss
// styles/_colors.scss
$colors: (
  'primary': #0070f3,
  'secondary': #7928ca,
  'success': #10b981,
  'warning': #f59e0b,
  'error': #ef4444,
);

// Generate color utilities
@each $name, $color in $colors {
  .text-#{$name} {
    color: $color;
  }

  .bg-#{$name} {
    background-color: $color;
  }

  .border-#{$name} {
    border-color: $color;
  }
}

// Generate spacing utilities
$spacing-values: 4, 8, 12, 16, 20, 24, 32, 40, 48;

@each $value in $spacing-values {
  .m-#{$value} {
    margin: #{$value}px;
  }

  .mt-#{$value} {
    margin-top: #{$value}px;
  }

  .mb-#{$value} {
    margin-bottom: #{$value}px;
  }

  .p-#{$value} {
    padding: #{$value}px;
  }
}
```

### Placeholder Selectors

```scss
// styles/_placeholders.scss
%card-base {
  padding: 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

%button-base {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

// Usage
.profileCard {
  @extend %card-base;
  max-width: 400px;
}

.productCard {
  @extend %card-base;
  border: 1px solid #e0e0e0;
}

.primaryButton {
  @extend %button-base;
  background: #0070f3;
  color: white;
}

.secondaryButton {
  @extend %button-base;
  background: #eaeaea;
  color: #000;
}
```

## Global Styles with Sass

```scss
// app/globals.scss
@use 'styles/variables' as *;
@use 'styles/mixins' as *;

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: $font-family-sans;
  line-height: 1.6;
  color: $gray-900;
  background-color: white;
}

h1, h2, h3, h4, h5, h6 {
  font-weight: 700;
  line-height: 1.25;
  margin-bottom: $spacing-md;
}

h1 { font-size: $font-size-2xl * 1.5; }
h2 { font-size: $font-size-2xl * 1.25; }
h3 { font-size: $font-size-xl * 1.25; }
h4 { font-size: $font-size-xl; }
h5 { font-size: $font-size-lg; }
h6 { font-size: $font-size-base; }

a {
  color: $primary-500;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}
```

```typescript
// app/layout.tsx
import './globals.scss'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

## Configuration

### Sass Options

Configure Sass in `next.config.js`:

```javascript
// next.config.js
const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  sassOptions: {
    includePaths: [path.join(__dirname, 'styles')],
    prependData: `@use 'variables' as *; @use 'mixins' as *;`,
  },
}

module.exports = nextConfig
```

This allows you to:
1. Import from `styles/` directory without full path
2. Auto-import variables and mixins in every SCSS file

## Best Practices

### 1. Organize Files

```
styles/
├── _variables.scss
├── _mixins.scss
├── _functions.scss
├── _breakpoints.scss
├── _placeholders.scss
└── _index.scss (forwards all)

app/
└── globals.scss

components/
└── Button/
    ├── Button.tsx
    ├── button.module.scss
    └── index.ts
```

### 2. Use `@use` Instead of `@import`

```scss
// Good: Namespaced, no conflicts
@use 'variables' as vars;
@use 'mixins';

.component {
  padding: vars.$spacing-md;
  @include mixins.flex-center;
}

// Avoid: Global namespace pollution
@import 'variables';
@import 'mixins';
```

### 3. Modularize Styles

```scss
// Good: Component-specific module
// button.module.scss
@use '@/styles' as *;

.button {
  /* styles */
}

// Avoid: All styles in one file
// styles.scss (thousands of lines)
```

### 4. Use Variables for Consistency

```scss
// Good
$primary-color: #0070f3;

.button {
  background: $primary-color;
}

.link {
  color: $primary-color;
}

// Avoid
.button {
  background: #0070f3;
}

.link {
  color: #0070f4; // Inconsistent!
}
```

### 5. Meaningful Nesting

```scss
// Good: Logical nesting (max 3 levels)
.card {
  .header {
    .title {
    }
  }
}

// Avoid: Excessive nesting
.page {
  .container {
    .section {
      .card {
        .header {
          .title {
            .text {
              // Too deep!
            }
          }
        }
      }
    }
  }
}
```

## Performance Tips

1. **Avoid deep nesting** - Increases CSS specificity and file size
2. **Use mixins wisely** - Too many can bloat compiled CSS
3. **Leverage CSS Modules** - Automatic scoping with `.module.scss`
4. **Minimize global styles** - Use component modules instead
5. **Use `@use` over `@import`** - Better for tree-shaking

## Troubleshooting

### Issue: Cannot find module

```bash
Error: Can't resolve '@/styles/variables'
```

**Solution**: Configure path aliases in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Issue: Sass version conflicts

**Solution**: Use specific Sass version:

```bash
npm install -D sass@1.69.0
```

### Issue: Variables not available

**Solution**: Use `@use` or configure `prependData` in `next.config.js`

## Summary

Sass in Next.js App Router provides:

- **Zero runtime** - Compiles to CSS at build time
- **Variables** - Reusable values
- **Nesting** - Organized selectors
- **Mixins** - Reusable style blocks
- **Functions** - Dynamic calculations
- **Modules** - Component scoping with `.module.scss`
- **Built-in support** - Just install `sass` package

Sass is ideal for projects that need:
- Complex preprocessing
- Shared design tokens
- Powerful mixins and functions
- Backward compatibility with existing Sass code
