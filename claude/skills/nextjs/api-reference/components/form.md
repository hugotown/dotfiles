# Next.js Form Component

The Form component extends the HTML `<form>` element with progressive enhancement, client-side navigation, and seamless integration with Server Actions.

## Import

```jsx
import Form from 'next/form'
```

## Basic Usage

```jsx
import Form from 'next/form'

export default function Page() {
  return (
    <Form action="/search">
      <input name="query" />
      <button type="submit">Search</button>
    </Form>
  )
}
```

## Props API Reference

### action
- **Type**: `string | ((formData: FormData) => void | Promise<void>)`
- **Description**: URL to navigate to on submit, or Server Action function
- **Required**: Yes

```jsx
// Navigate to URL
<Form action="/search">
  <input name="query" />
  <button type="submit">Search</button>
</Form>

// Server Action
async function handleSubmit(formData) {
  'use server'
  const query = formData.get('query')
  // Process form data
}

<Form action={handleSubmit}>
  <input name="query" />
  <button type="submit">Submit</button>
</Form>
```

### replace
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Replace current history entry instead of pushing new one

```jsx
<Form action="/search" replace>
  <input name="query" />
  <button type="submit">Search</button>
</Form>
```

### scroll
- **Type**: `boolean`
- **Default**: `true` (scrolls to top after navigation)
- **Description**: Whether to scroll to top after form submission

```jsx
<Form action="/search" scroll={false}>
  <input name="query" />
  <button type="submit">Search</button>
</Form>
```

## Progressive Enhancement

The Form component provides progressive enhancement:

1. **Without JavaScript**: Functions as standard HTML form
2. **With JavaScript**: Client-side navigation with prefetching

```jsx
// This form works even if JavaScript is disabled
export default function SearchForm() {
  return (
    <Form action="/search">
      <input
        name="query"
        type="search"
        placeholder="Search..."
        required
      />
      <button type="submit">Search</button>
    </Form>
  )
}
```

## Server Actions Integration

### Basic Server Action

```jsx
// app/actions.js
'use server'

export async function createPost(formData) {
  const title = formData.get('title')
  const content = formData.get('content')

  // Validate
  if (!title || !content) {
    return { error: 'Title and content are required' }
  }

  // Save to database
  await db.posts.create({
    data: { title, content }
  })

  // Redirect
  redirect('/posts')
}
```

```jsx
// app/posts/new/page.js
import Form from 'next/form'
import { createPost } from '@/app/actions'

export default function NewPost() {
  return (
    <Form action={createPost}>
      <input name="title" placeholder="Title" required />
      <textarea name="content" placeholder="Content" required />
      <button type="submit">Create Post</button>
    </Form>
  )
}
```

### Server Action with Validation

```jsx
'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function signup(formData) {
  const validatedFields = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  // Create user
  await createUser(validatedFields.data)

  redirect('/dashboard')
}
```

```jsx
'use client'

import Form from 'next/form'
import { signup } from './actions'
import { useFormState } from 'react-dom'

export default function SignupForm() {
  const [state, formAction] = useFormState(signup, null)

  return (
    <Form action={formAction}>
      <div>
        <input name="email" type="email" required />
        {state?.errors?.email && (
          <p className="error">{state.errors.email}</p>
        )}
      </div>

      <div>
        <input name="password" type="password" required />
        {state?.errors?.password && (
          <p className="error">{state.errors.password}</p>
        )}
      </div>

      <button type="submit">Sign Up</button>
    </Form>
  )
}
```

## Common Patterns

### Search Form

```jsx
import Form from 'next/form'

export default function SearchForm() {
  return (
    <Form action="/search">
      <input
        name="q"
        type="search"
        placeholder="Search..."
        autoComplete="off"
      />
      <button type="submit">Search</button>
    </Form>
  )
}

// app/search/page.js
export default function SearchResults({ searchParams }) {
  const query = searchParams.q

  return (
    <div>
      <h1>Results for: {query}</h1>
      {/* Display search results */}
    </div>
  )
}
```

### Contact Form

```jsx
// app/actions.js
'use server'

import { redirect } from 'next/navigation'

export async function submitContact(formData) {
  const data = {
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  }

  // Send email
  await sendEmail(data)

  redirect('/thank-you')
}
```

```jsx
// app/contact/page.js
import Form from 'next/form'
import { submitContact } from '../actions'

export default function ContactPage() {
  return (
    <Form action={submitContact}>
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required />
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
      </div>

      <div>
        <label htmlFor="message">Message</label>
        <textarea id="message" name="message" required />
      </div>

      <button type="submit">Send Message</button>
    </Form>
  )
}
```

### Login Form with Loading State

```jsx
'use client'

import Form from 'next/form'
import { login } from './actions'
import { useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Logging in...' : 'Login'}
    </button>
  )
}

export default function LoginForm() {
  return (
    <Form action={login}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <SubmitButton />
    </Form>
  )
}
```

### Multi-Step Form

```jsx
'use client'

import { useState } from 'react'
import Form from 'next/form'

export default function MultiStepForm() {
  const [step, setStep] = useState(1)

  const handleSubmit = async (formData) => {
    if (step < 3) {
      setStep(step + 1)
    } else {
      // Final submission
      await submitForm(formData)
    }
  }

  return (
    <Form action={handleSubmit}>
      {step === 1 && (
        <div>
          <h2>Step 1: Personal Info</h2>
          <input name="name" placeholder="Name" required />
          <input name="email" type="email" placeholder="Email" required />
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>Step 2: Address</h2>
          <input name="street" placeholder="Street" required />
          <input name="city" placeholder="City" required />
        </div>
      )}

      {step === 3 && (
        <div>
          <h2>Step 3: Confirm</h2>
          {/* Display summary */}
        </div>
      )}

      <div>
        {step > 1 && (
          <button type="button" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        <button type="submit">
          {step === 3 ? 'Submit' : 'Next'}
        </button>
      </div>
    </Form>
  )
}
```

### File Upload Form

```jsx
'use server'

import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function uploadFile(formData) {
  const file = formData.get('file')

  if (!file) {
    return { error: 'No file uploaded' }
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const path = join(process.cwd(), 'public', 'uploads', file.name)
  await writeFile(path, buffer)

  return { success: true }
}
```

```jsx
import Form from 'next/form'
import { uploadFile } from './actions'

export default function UploadForm() {
  return (
    <Form action={uploadFile}>
      <input
        name="file"
        type="file"
        accept="image/*"
        required
      />
      <button type="submit">Upload</button>
    </Form>
  )
}
```

### Filter Form (Shallow Routing)

```jsx
'use client'

import Form from 'next/form'
import { useSearchParams } from 'next/navigation'

export default function FilterForm() {
  const searchParams = useSearchParams()

  return (
    <Form action="/products" scroll={false}>
      <select
        name="category"
        defaultValue={searchParams.get('category') || ''}
      >
        <option value="">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="clothing">Clothing</option>
        <option value="books">Books</option>
      </select>

      <select
        name="sort"
        defaultValue={searchParams.get('sort') || 'newest'}
      >
        <option value="newest">Newest</option>
        <option value="price-low">Price: Low to High</option>
        <option value="price-high">Price: High to Low</option>
      </select>

      <button type="submit">Apply Filters</button>
    </Form>
  )
}
```

### Newsletter Subscription

```jsx
'use server'

export async function subscribe(formData) {
  const email = formData.get('email')

  // Validate email
  if (!email || !email.includes('@')) {
    return { error: 'Invalid email address' }
  }

  // Add to mailing list
  await addToMailingList(email)

  return { success: true }
}
```

```jsx
'use client'

import Form from 'next/form'
import { subscribe } from './actions'
import { useFormState } from 'react-dom'

export default function Newsletter() {
  const [state, formAction] = useFormState(subscribe, null)

  return (
    <div>
      <Form action={formAction}>
        <input
          name="email"
          type="email"
          placeholder="Enter your email"
          required
        />
        <button type="submit">Subscribe</button>
      </Form>

      {state?.success && (
        <p className="success">Thank you for subscribing!</p>
      )}
      {state?.error && (
        <p className="error">{state.error}</p>
      )}
    </div>
  )
}
```

### Dynamic Form Fields

```jsx
'use client'

import { useState } from 'react'
import Form from 'next/form'

export default function DynamicForm({ action }) {
  const [items, setItems] = useState([''])

  const addItem = () => {
    setItems([...items, ''])
  }

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  return (
    <Form action={action}>
      {items.map((item, index) => (
        <div key={index}>
          <input
            name={`item-${index}`}
            placeholder={`Item ${index + 1}`}
            defaultValue={item}
          />
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => removeItem(index)}
            >
              Remove
            </button>
          )}
        </div>
      ))}

      <button type="button" onClick={addItem}>
        Add Item
      </button>

      <button type="submit">Submit</button>
    </Form>
  )
}
```

## Form Validation

### Client-Side Validation

```jsx
<Form action={handleSubmit}>
  <input
    name="email"
    type="email"
    required
    pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
  />
  <input
    name="age"
    type="number"
    min="18"
    max="100"
    required
  />
  <button type="submit">Submit</button>
</Form>
```

### Server-Side Validation

```jsx
'use server'

import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  age: z.number().min(18, 'Must be 18 or older'),
})

export async function handleSubmit(formData) {
  const result = schema.safeParse({
    email: formData.get('email'),
    age: Number(formData.get('age')),
  })

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    }
  }

  // Process valid data
  const { email, age } = result.data
  // ...
}
```

### Custom Validation

```jsx
'use client'

import { useState } from 'react'
import Form from 'next/form'

export default function CustomValidationForm() {
  const [errors, setErrors] = useState({})

  const validate = (formData) => {
    const newErrors = {}

    const password = formData.get('password')
    const confirmPassword = formData.get('confirmPassword')

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    return newErrors
  }

  const handleSubmit = async (formData) => {
    const validationErrors = validate(formData)

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    // Submit form
    await submitForm(formData)
  }

  return (
    <Form action={handleSubmit}>
      <div>
        <input name="password" type="password" required />
        {errors.password && <p className="error">{errors.password}</p>}
      </div>

      <div>
        <input name="confirmPassword" type="password" required />
        {errors.confirmPassword && (
          <p className="error">{errors.confirmPassword}</p>
        )}
      </div>

      <button type="submit">Submit</button>
    </Form>
  )
}
```

## Accessibility

### Best Practices

1. **Use proper labels**: Associate labels with inputs
2. **Provide error messages**: Clear, actionable error messages
3. **Use ARIA attributes**: For better screen reader support
4. **Maintain focus management**: Focus on errors or success messages
5. **Use semantic HTML**: Proper input types and attributes

```jsx
<Form action={handleSubmit}>
  <div>
    <label htmlFor="email">Email Address</label>
    <input
      id="email"
      name="email"
      type="email"
      required
      aria-describedby="email-error"
      aria-invalid={errors.email ? 'true' : 'false'}
    />
    {errors.email && (
      <p id="email-error" role="alert" className="error">
        {errors.email}
      </p>
    )}
  </div>

  <button type="submit">Submit</button>
</Form>
```

## Performance Tips

1. **Use Server Actions** for form processing (no client-side JavaScript needed)
2. **Implement optimistic updates** for better UX
3. **Use `scroll={false}`** for filter forms
4. **Debounce search inputs** for live search
5. **Show loading states** with `useFormStatus`

## Best Practices

1. **Always validate on server** (client validation can be bypassed)
2. **Provide clear error messages** for better UX
3. **Use progressive enhancement** (form works without JS)
4. **Implement proper accessibility** (labels, ARIA, keyboard nav)
5. **Show loading states** during submission
6. **Handle errors gracefully** with user-friendly messages
7. **Use semantic HTML** (proper input types, attributes)
8. **Implement CSRF protection** for security
9. **Sanitize inputs** on the server
10. **Rate limit submissions** to prevent abuse

## Common Issues

### Form not submitting
- Ensure `action` prop is provided
- Check for JavaScript errors
- Verify Server Action is marked with `'use server'`

### Data not persisting
- Check form field names match expected values
- Verify FormData is being read correctly
- Ensure database operations are completing

### Validation not working
- Implement both client and server validation
- Use proper HTML5 validation attributes
- Return errors from Server Actions

### Navigation issues
- Use `replace` for login/redirect flows
- Use `scroll={false}` for filters
- Check redirect paths are correct
