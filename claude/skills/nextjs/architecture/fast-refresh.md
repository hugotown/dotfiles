# Fast Refresh

## Overview

Fast Refresh is Next.js's hot module replacement (HMR) implementation that provides instant feedback when editing React components. It preserves component state and only updates the changed code, making development significantly faster and more productive.

## How It Works

### Architecture

```
File Change → Webpack HMR → Fast Refresh Runtime → Component Update → State Preservation
```

**Key Components:**
1. **File Watcher**: Detects file changes
2. **HMR Client**: Manages hot updates
3. **React Refresh Runtime**: Handles component remounting
4. **State Manager**: Preserves component state

### Update Process

```javascript
// 1. Edit component
function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}

// 2. Save file
// 3. Fast Refresh updates component
// 4. State (count value) is preserved
// 5. Only the component re-renders
```

## Features

### 1. State Preservation

Fast Refresh preserves React component state between edits:

```javascript
// Before edit
export default function Form() {
  const [name, setName] = useState('') // State: "John"
  const [email, setEmail] = useState('') // State: "john@example.com"

  return (
    <form>
      <input value={name} onChange={e => setName(e.target.value)} />
      <input value={email} onChange={e => setEmail(e.target.value)} />
    </form>
  )
}

// After editing and saving (e.g., adding a button)
export default function Form() {
  const [name, setName] = useState('') // State still: "John"
  const [email, setEmail] = useState('') // State still: "john@example.com"

  return (
    <form>
      <input value={name} onChange={e => setName(e.target.value)} />
      <input value={email} onChange={e => setEmail(e.target.value)} />
      <button type="submit">Submit</button> {/* New element */}
    </form>
  )
}
// Form inputs retain their values!
```

### 2. Error Recovery

Fast Refresh handles errors gracefully:

```javascript
// Introduce a syntax error
export default function Page() {
  return <div>Hello World{/* Missing closing tag
}

// Error overlay appears
// Fix the error
export default function Page() {
  return <div>Hello World</div>
}

// Error overlay disappears
// Component updates automatically
// State is preserved
```

### 3. Full Reload Triggers

Fast Refresh performs a full reload when:

**a) Editing non-component files:**
```javascript
// utils.js - NOT a component
export const API_URL = 'https://api.example.com'
// Editing this triggers full reload
```

**b) Files with non-component exports:**
```javascript
// page.js
export const config = { runtime: 'edge' } // Non-component export

export default function Page() {
  return <div>Page</div>
}
// Editing this triggers full reload
```

**c) Class components:**
```javascript
// Class components always trigger full reload
class OldComponent extends React.Component {
  render() {
    return <div>Old Style</div>
  }
}
```

### 4. Hooks Preservation

Hooks state is preserved:

```javascript
export default function UserProfile() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUser().then(data => {
      setUser(data)
      setLoading(false)
    })
  }, [])

  // Edit component
  if (loading) return <div>Loading...</div>

  // After save: user state preserved, no re-fetch
  return <div>{user.name}</div>
}
```

## Rules and Limitations

### What Triggers Fast Refresh

**✅ Fast Refresh Works:**
```javascript
// 1. Function components
export default function Component() {
  return <div>Fast Refresh ✓</div>
}

// 2. Named exports of components
export function Header() {
  return <header>Fast Refresh ✓</header>
}

// 3. HOCs that return components
export default withAuth(function Page() {
  return <div>Fast Refresh ✓</div>
})
```

**❌ Fast Refresh Triggers Full Reload:**
```javascript
// 1. Class components
export default class Component extends React.Component {
  render() { return <div>Full Reload ⟳</div> }
}

// 2. Mixed exports
export const config = {} // Non-component
export default function Page() { return <div>Full Reload ⟳</div> }

// 3. Anonymous exports
export default () => <div>Full Reload ⟳</div>

// 4. Non-component files
export const API_URL = '/api' // Full Reload ⟳
```

### Component Naming

**Always name your components:**
```javascript
// ❌ Anonymous - may cause issues
export default () => <div>Hello</div>

// ✅ Named function
export default function Welcome() {
  return <div>Hello</div>
}

// ✅ Named constant
const Welcome = () => <div>Hello</div>
export default Welcome
```

### Hooks Rules

Fast Refresh enforces React Hooks rules:

```javascript
// ❌ Conditional hooks - error
function Component({ isActive }) {
  if (isActive) {
    const [state, setState] = useState(0) // Error!
  }
  return <div>Component</div>
}

// ✅ Hooks at top level
function Component({ isActive }) {
  const [state, setState] = useState(0)

  if (!isActive) return null
  return <div>Component</div>
}
```

## Error Handling

### Error Overlay

When errors occur, Fast Refresh displays an overlay:

**Runtime Error:**
```javascript
export default function Page() {
  const [data, setData] = useState(null)

  return <div>{data.name}</div> // Error: Cannot read property 'name' of null
}
```

**Error overlay shows:**
- Error message
- Stack trace
- Component stack
- Source code location

### Error Recovery Flow

```javascript
// 1. Initial working state
export default function Page() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}

// 2. Introduce error (user clicks to count = 5)
export default function Page() {
  const [count, setCount] = useState(0)
  throw new Error('Oops!') // Error with count = 5
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}

// 3. Fix error
export default function Page() {
  const [count, setCount] = useState(0) // State still = 5!
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
// Component recovers with preserved state
```

### Build vs Development

Fast Refresh only works in development:

```bash
# Development - Fast Refresh enabled
npm run dev

# Production - No Fast Refresh
npm run build
npm start
```

## Configuration

Fast Refresh is enabled by default. To disable (not recommended):

```javascript
// next.config.js
module.exports = {
  reactStrictMode: true,

  // Disable Fast Refresh (not recommended)
  webpackDevMiddleware: config => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    }
    return config
  },
}
```

### Custom Webpack Config

Fast Refresh works with custom webpack configs:

```javascript
// next.config.js
module.exports = {
  webpack: (config, { dev, isServer }) => {
    // Fast Refresh is automatically configured
    // Don't disable HMR in dev mode

    if (dev && !isServer) {
      // Fast Refresh is active here
      // Add custom dev configurations
    }

    return config
  },
}
```

## Best Practices

### 1. Export Named Components

```javascript
// ✅ Good - Fast Refresh works well
export default function ProductPage() {
  return <div>Product</div>
}

// ✅ Also good
export function ProductCard() {
  return <div>Card</div>
}

// ❌ Avoid - may cause issues
export default () => <div>Product</div>
```

### 2. Separate Component and Non-Component Exports

```javascript
// ❌ Mixed exports - triggers full reload
export const API_URL = '/api'
export default function Page() {
  return <div>Page</div>
}

// ✅ Separate files
// config.js
export const API_URL = '/api'

// page.js
import { API_URL } from './config'
export default function Page() {
  return <div>Page</div>
}
```

### 3. Use Function Components

```javascript
// ❌ Class components - full reload
class Component extends React.Component {
  render() { return <div>Component</div> }
}

// ✅ Function components - Fast Refresh
function Component() {
  return <div>Component</div>
}
```

### 4. Keep Components Pure

```javascript
// ❌ Side effects outside component
let cache = {}

export default function Component() {
  cache.value = 'something' // Side effect
  return <div>Component</div>
}

// ✅ Side effects inside hooks
export default function Component() {
  useEffect(() => {
    // Side effects here
  }, [])

  return <div>Component</div>
}
```

### 5. Handle Errors Gracefully

```javascript
// ✅ Error boundaries for production-like testing
export default function Page() {
  return (
    <ErrorBoundary>
      <MyComponent />
    </ErrorBoundary>
  )
}
```

## Debugging Fast Refresh

### Check Fast Refresh Status

Open browser console during development:

```javascript
// Fast Refresh is active
[Fast Refresh] rebuilding

// Full reload triggered
[Fast Refresh] full reload required
```

### Common Issues

**Issue**: Full reload on every change
```javascript
// Likely cause: Mixed exports
export const config = {} // Remove this or move to separate file
export default function Page() { return <div>Page</div> }
```

**Issue**: State not preserved
```javascript
// Likely cause: Component not exported as default
// ❌
function Page() { return <div>Page</div> }
export default Page

// ✅
export default function Page() { return <div>Page</div> }
```

**Issue**: Fast Refresh not working
```bash
# Clear .next cache
rm -rf .next
npm run dev
```

## Performance Considerations

### File Watching

Fast Refresh watches files efficiently:

```javascript
// next.config.js
module.exports = {
  // Adjust watch options if needed
  webpackDevMiddleware: config => {
    config.watchOptions = {
      poll: 1000, // Poll every second
      aggregateTimeout: 300, // Wait 300ms before rebuilding
      ignored: /node_modules/, // Ignore node_modules
    }
    return config
  },
}
```

### Large Projects

For very large projects:

```javascript
// next.config.js
module.exports = {
  // Increase memory limit
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
}
```

## Advanced Usage

### Custom HMR Handling

```javascript
// pages/_app.js
export default function App({ Component, pageProps }) {
  if (module.hot) {
    module.hot.accept()
  }

  return <Component {...pageProps} />
}
```

### Preserving Global State

```javascript
// Use global state that persists across Fast Refresh
if (!global.myGlobalState) {
  global.myGlobalState = {
    cache: new Map(),
    // Other global state
  }
}

export default function Component() {
  // Use global.myGlobalState
  return <div>Component</div>
}
```

## Testing Fast Refresh

### Manual Testing

1. Start dev server: `npm run dev`
2. Edit a component
3. Verify state is preserved
4. Introduce an error
5. Verify error overlay appears
6. Fix error
7. Verify recovery

### Automated Testing

Fast Refresh is development-only, so no production tests needed.

## Comparison with Other HMR Solutions

| Feature | Fast Refresh | Traditional HMR | Live Reload |
|---------|--------------|-----------------|-------------|
| **State Preservation** | ✅ Yes | ❌ No | ❌ No |
| **Error Recovery** | ✅ Yes | ⚠️ Partial | ❌ No |
| **React-aware** | ✅ Yes | ❌ No | ❌ No |
| **Speed** | ⚡ Fast | ⚡ Fast | 🐌 Slow |
| **Full Reload** | ⚠️ Sometimes | ⚠️ Sometimes | ✅ Always |

## Resources

- [React Refresh Documentation](https://github.com/facebook/react/tree/main/packages/react-refresh)
- [Next.js Fast Refresh](https://nextjs.org/docs/architecture/fast-refresh)
- [HMR API](https://webpack.js.org/api/hot-module-replacement/)
