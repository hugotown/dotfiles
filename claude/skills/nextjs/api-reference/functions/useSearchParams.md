# useSearchParams

The `useSearchParams` hook allows you to read the current URL's query string (search parameters) in Client Components.

## Import

```typescript
'use client'

import { useSearchParams } from 'next/navigation'
```

## Function Signature

```typescript
const searchParams = useSearchParams()
```

## Return Value

Returns a **read-only** URLSearchParams object with methods to access query parameters.

## Methods

- `searchParams.get(key)` - Get the first value for a key
- `searchParams.getAll(key)` - Get all values for a key (array)
- `searchParams.has(key)` - Check if a key exists
- `searchParams.entries()` - Get iterator of key/value pairs
- `searchParams.keys()` - Get iterator of all keys
- `searchParams.values()` - Get iterator of all values
- `searchParams.toString()` - Convert to string
- `searchParams.size` - Number of parameters

## Usage Examples

### Basic Usage

```typescript
'use client'

import { useSearchParams } from 'next/navigation'

export default function SearchPage() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q')

  return <div>Search query: {query}</div>
}

// URL: /search?q=nextjs
// Output: Search query: nextjs
```

### Multiple Parameters

```typescript
'use client'

import { useSearchParams } from 'next/navigation'

export default function FilteredList() {
  const searchParams = useSearchParams()

  const category = searchParams.get('category')
  const sort = searchParams.get('sort')
  const page = searchParams.get('page') || '1'

  return (
    <div>
      <p>Category: {category}</p>
      <p>Sort: {sort}</p>
      <p>Page: {page}</p>
    </div>
  )
}

// URL: /products?category=electronics&sort=price&page=2
```

### Check if Parameter Exists

```typescript
'use client'

import { useSearchParams } from 'next/navigation'

export default function Page() {
  const searchParams = useSearchParams()

  const hasDiscount = searchParams.has('discount')
  const hasPromo = searchParams.has('promo')

  return (
    <div>
      {hasDiscount && <DiscountBanner />}
      {hasPromo && <PromoBanner />}
    </div>
  )
}

// URL: /shop?discount=true&promo=summer
```

### Get All Values for a Key

```typescript
'use client'

import { useSearchParams } from 'next/navigation'

export default function FilterPage() {
  const searchParams = useSearchParams()

  // Get all values for 'tags' parameter
  const tags = searchParams.getAll('tags')

  return (
    <div>
      <h2>Selected Tags:</h2>
      <ul>
        {tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
    </div>
  )
}

// URL: /posts?tags=react&tags=nextjs&tags=typescript
// Output: react, nextjs, typescript
```

### Update Search Params

```typescript
'use client'

import { useSearchParams, useRouter } from 'next/navigation'

export default function FilterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`?${params.toString()}`)
  }

  return (
    <div>
      <button onClick={() => updateFilter('sort', 'price')}>
        Sort by Price
      </button>
      <button onClick={() => updateFilter('sort', 'name')}>
        Sort by Name
      </button>
    </div>
  )
}
```

### Toggle Parameter

```typescript
'use client'

import { useSearchParams, useRouter } from 'next/navigation'

export default function FilterToggle() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const toggleFilter = (key: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (params.has(key)) {
      params.delete(key)
    } else {
      params.set(key, 'true')
    }

    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <button onClick={() => toggleFilter('featured')}>
      {searchParams.has('featured') ? 'Hide' : 'Show'} Featured
    </button>
  )
}
```

### Pagination

```typescript
'use client'

import { useSearchParams, useRouter } from 'next/navigation'

export default function Pagination({ totalPages }: { totalPages: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPage = Number(searchParams.get('page')) || 1

  const setPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`?${params.toString()}`)
  }

  return (
    <div>
      <button
        onClick={() => setPage(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </button>

      <span>Page {currentPage} of {totalPages}</span>

      <button
        onClick={() => setPage(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </div>
  )
}
```

### Search with Debounce

```typescript
'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useDebouncedCallback } from 'use-debounce'

export default function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (term) {
      params.set('q', term)
    } else {
      params.delete('q')
    }

    router.replace(`?${params.toString()}`)
  }, 300)

  return (
    <input
      type="text"
      placeholder="Search..."
      defaultValue={searchParams.get('q') || ''}
      onChange={(e) => handleSearch(e.target.value)}
    />
  )
}
```

### Multi-Select Filter

```typescript
'use client'

import { useSearchParams, useRouter } from 'next/navigation'

export default function CategoryFilter({ categories }: { categories: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedCategories = searchParams.getAll('category')

  const toggleCategory = (category: string) => {
    const params = new URLSearchParams()

    // Copy existing params
    searchParams.forEach((value, key) => {
      if (key !== 'category') {
        params.append(key, value)
      }
    })

    // Toggle the category
    if (selectedCategories.includes(category)) {
      selectedCategories
        .filter((c) => c !== category)
        .forEach((c) => params.append('category', c))
    } else {
      [...selectedCategories, category].forEach((c) =>
        params.append('category', c)
      )
    }

    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div>
      {categories.map((category) => (
        <label key={category}>
          <input
            type="checkbox"
            checked={selectedCategories.includes(category)}
            onChange={() => toggleCategory(category)}
          />
          {category}
        </label>
      ))}
    </div>
  )
}
```

### Convert to Object

```typescript
'use client'

import { useSearchParams } from 'next/navigation'

export default function Page() {
  const searchParams = useSearchParams()

  // Convert searchParams to plain object
  const params = Object.fromEntries(searchParams.entries())

  return <pre>{JSON.stringify(params, null, 2)}</pre>
}
```

### Preserve Existing Params

```typescript
'use client'

import { useSearchParams, useRouter } from 'next/navigation'

export default function FilterButton() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const addFilter = (key: string, value: string) => {
    // Create new URLSearchParams from existing
    const params = new URLSearchParams(searchParams.toString())

    // Add new parameter
    params.set(key, value)

    // Navigate with all parameters
    router.push(`?${params.toString()}`)
  }

  return (
    <button onClick={() => addFilter('view', 'grid')}>
      Grid View
    </button>
  )
}
```

### Clear All Filters

```typescript
'use client'

import { useSearchParams, useRouter } from 'next/navigation'

export default function ClearFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasFilters = searchParams.toString().length > 0

  const clearAll = () => {
    router.push(window.location.pathname)
  }

  if (!hasFilters) return null

  return <button onClick={clearAll}>Clear All Filters</button>
}
```

### Conditional Rendering Based on Params

```typescript
'use client'

import { useSearchParams } from 'next/navigation'

export default function Page() {
  const searchParams = useSearchParams()
  const view = searchParams.get('view') || 'list'

  return (
    <div>
      {view === 'grid' && <GridView />}
      {view === 'list' && <ListView />}
    </div>
  )
}
```

### Use with Suspense

```typescript
'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q')

  return <div>Results for: {query}</div>
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchResults />
    </Suspense>
  )
}
```

## Best Practices

1. **Wrap in Suspense Boundary**
   ```typescript
   import { Suspense } from 'react'

   export default function Page() {
     return (
       <Suspense fallback={<Loading />}>
         <SearchComponent />
       </Suspense>
     )
   }
   ```

2. **Provide Default Values**
   ```typescript
   const page = searchParams.get('page') || '1'
   const sort = searchParams.get('sort') || 'date'
   ```

3. **Preserve Existing Parameters**
   ```typescript
   const params = new URLSearchParams(searchParams.toString())
   params.set('newKey', 'newValue')
   router.push(`?${params.toString()}`)
   ```

4. **Use scroll: false for Filters**
   ```typescript
   router.push(`?${params.toString()}`, { scroll: false })
   ```

5. **Handle Arrays Correctly**
   ```typescript
   // Multiple values
   const tags = searchParams.getAll('tags')

   // Setting multiple values
   tags.forEach(tag => params.append('tags', tag))
   ```

6. **Validate Parameter Values**
   ```typescript
   const page = searchParams.get('page')
   const pageNum = page ? parseInt(page) : 1
   const validPage = isNaN(pageNum) ? 1 : pageNum
   ```

## Common Patterns

### Search with Filters

```typescript
function SearchPage() {
  const searchParams = useSearchParams()

  const query = searchParams.get('q')
  const category = searchParams.get('category')
  const sort = searchParams.get('sort')

  // Use params for data fetching
  const results = useSearch({ query, category, sort })

  return <Results data={results} />
}
```

### Filter UI

```typescript
function Filters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })

    router.push(`?${params.toString()}`)
  }

  return <FilterForm onUpdate={updateParams} />
}
```

### Tab Navigation

```typescript
function Tabs() {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'

  return (
    <div>
      <TabButton tab="overview" active={activeTab === 'overview'} />
      <TabButton tab="details" active={activeTab === 'details'} />
    </div>
  )
}
```

## Important Notes

- Returns read-only `URLSearchParams` object
- Must wrap components in `<Suspense>` boundary
- Returns empty object if no search params
- Only works in Client Components
- Import from `'next/navigation'`, not `'next/router'`
- Use `useRouter()` to update search params
- Changes to search params trigger re-render

## Related

- [usePathname](./usePathname.md) - Get current pathname
- [useRouter](./useRouter.md) - Update search params
- [useParams](./useParams.md) - Access route parameters
- [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) - Web API docs
