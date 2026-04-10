---
name: context7-mcp
description: This skill should be used when the user asks about libraries, frameworks, API references, or needs code examples. Activates for setup questions, code generation involving libraries, or mentions of specific frameworks like React, Vue, Next.js, Prisma, Supabase, etc.
---

When the user asks about libraries, frameworks, or needs code examples, use Context7 to fetch current documentation instead of relying on training data.

## When to Use This Skill

Activate this skill when the user:

- Asks setup or configuration questions ("How do I configure Next.js middleware?")
- Requests code involving libraries ("Write a Prisma query for...")
- Needs API references ("What are the Supabase auth methods?")
- Mentions specific frameworks (React, Vue, Svelte, Express, Tailwind, etc.)
- Asks "how do I" questions mentioning a library name
- Has debugging issues involving library-specific behavior
- Needs version migration guidance

Do NOT use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

## How to Fetch Documentation

### Step 1: Resolve the Library ID

Run the following command using Bash to find the library:

```bash
npx ctx7@latest library "<library-name>" "<user's full question>"
```

Use the official library name with proper punctuation (e.g., "Next.js" not "nextjs", "Customer.io" not "customerio", "Three.js" not "threejs"). Pass the user's full question to improve relevance ranking.

### Step 2: Select the Best Match

From the resolution results, choose the best library ID (format: `/org/project`) based on:

- **Exact name match**: Closest to what the user asked for
- **Description relevance**: Most relevant to the user's question
- **Code snippet count**: Higher is better
- **Source reputation**: High/Medium preferred
- **Benchmark score**: Higher indicates better documentation quality
- If the user mentioned a version (e.g., "React 19"), use version-specific IDs (`/org/project/version`)

If results don't look right, try alternate names or rephrase the query.

### Step 3: Fetch the Documentation

Run the following command using Bash with the selected library ID:

```bash
npx ctx7@latest docs "<libraryId>" "<user's specific question>"
```

For version-specific docs, use `/org/project/version` from the library output (e.g., `/vercel/next.js/v14.3.0`).

### Step 4: Use the Documentation

Incorporate the fetched documentation into your response:

- Answer the user's question using current, accurate information
- Include relevant code examples from the docs
- Cite the library version when relevant
- If docs contradict your training data, trust the fetched docs

## Guidelines

- **Be specific**: Pass the user's full question as the query for better results
- **Version awareness**: When users mention versions ("Next.js 15", "React 19"), use version-specific library IDs if available
- **Prefer official sources**: When multiple matches exist, prefer official/primary packages over community forks
- **Max 3 commands per question**: Do not run more than 3 ctx7 commands per user question
- **No secrets in queries**: Do not include API keys, passwords, or credentials in queries
- **Quota errors**: If a command fails with a quota error, inform the user and suggest running `npx ctx7@latest login` or setting `CONTEXT7_API_KEY` env var for higher limits. Do not silently fall back to training data.
