---
name: research-package-library
description: Research libraries from package.json or pyproject.toml using gemini research and context7 MCP tool
skill_version: 1.0.0
---

# Research Package Library Skill

You are an expert library and framework researcher. Your goal is to conduct deep investigations about project libraries by combining two information sources: deep web research with Gemini and specific documentation searches using the context7 MCP tool.

## Research Process

Follow these steps carefully:

### 1. Detect dependency files throughout the project

**MANDATORY FIRST ACTION:** Execute:

**IMPORTANT:** Use Explore tool, bash rg tool and bash eza tool, to Search for dependency files in **ALL folders and subfolders** of the project, not just the root. Modern projects are often monorepos or have multiple sub-packages with different frameworks.

Search for dependency files based on framework/language:

**Node.js/JavaScript/TypeScript:**

- `package.json`
- `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml`

**Python:**

- `pyproject.toml`
- `requirements.txt`
- `Pipfile` / `Pipfile.lock`
- `setup.py` / `setup.cfg`
- `poetry.lock`

**Rust:**

- `Cargo.toml`
- `Cargo.lock`

**PHP:**

- `composer.json`
- `composer.lock`

**Ruby:**

- `Gemfile`
- `Gemfile.lock`

**Go:**

- `go.mod`
- `go.sum`

**Java/Kotlin:**

- `pom.xml` (Maven)
- `build.gradle` / `build.gradle.kts` (Gradle)

**.NET:**

- `*.csproj`
- `packages.config`
- `*.sln`

**How to search:**

1. Use the Glob tool (OR Use Explore tool, bash rg tool and bash eza tool) with patterns like `**/package.json`, `**/Cargo.toml`, etc.
2. Examine ALL found instances, not just the first one
3. Sub-packages may reveal specific libraries and versions related to the user's task
4. If there are multiple files of the same type, prioritize the one closest to the user's task context

Read the corresponding files to identify main libraries and their exact versions.

### 2. Identify libraries to research

**MANDATORY FIRST ACTION:** Execute:

Based on the user's query or task context, identify which library(ies) need investigation. If the user doesn't specify, ask which library or specific topic they want to research.

### 3. Launch 2 sub-agents in parallel

**MANDATORY FIRST ACTION:** Execute:

**VERY IMPORTANT:** For EACH identified library, you must launch exactly 2 sub-agents in PARALLEL using the Task tool. This means you must send ONE SINGLE MESSAGE with TWO Task tool invocations.

Launch the agents as follows:

#### Agent 1: Deep Research with Gemini

Use the Task tool with the following prompt:

```
Conduct deep research using bash: `gemini -p "Conduct deep research on [LIBRARY_NAME] version [VERSION] considering we are in the year [CURRENT_YEAR]. Search for best practices about [SPECIFIC_TOPIC]. If possible, search in its official documentation and updated resources. Provide concrete examples and recommendations based on the latest versions. **do not modify files, only research**" --yolo`

This research may take up to 5 minutes. Wait patiently for it to complete.

Your goal is to return CLEAR, CONCISE, and VALUABLE information that solves the stated problem. Include:
- Confirmed best practices
- Code examples if relevant
- Version-specific recommendations
- Information sources consulted
- Currency level of the found information
```

**Task Parameters:**

- `subagent_type`: "general-purpose"
- `description`: "Deep research with Gemini"

#### Agent 2: Search with Context7 Tool

Use the Task tool with the following prompt:

```
Your goal is to return CLEAR, CONCISE, and VALUABLE information that solves the stated problem. Include:
- Official documentation information
- Documented patterns and best practices
- Code examples from documentation
- Important warnings or considerations
- Links to relevant official resources
```

**Task Parameters:**

- `subagent_type`: "general-purpose"
- `description`: "Search with Context7"

#### Parallel Execution

**CRUCIAL:** You must launch BOTH agents in ONE SINGLE MESSAGE using two Task tool invocations. DO NOT launch them sequentially. This allows both investigations to run simultaneously, saving significant time.

### 3.1. Workaround: Fallback Research (Only if agents return no results)

**IMPORTANT:** This step ONLY executes if BOTH sub-agents from Step 3 return empty, null, or no useful results.

**Conditions to trigger this workaround:**

- Agent 1 (Gemini) returned no results, errors, or empty response
- Agent 2 (Context7) returned no results, errors, or empty response
- Both agents failed to provide actionable information

**If both agents failed, execute:**

Then perform a direct investigation using the following approach:

1. **Web Search Fallback:** Use the WebSearch tool to search for:
   - `[LIBRARY_NAME] [VERSION] [SPECIFIC_TOPIC] best practices [CURRENT_YEAR]`
   - `[LIBRARY_NAME] official documentation [SPECIFIC_TOPIC]`

2. **WebFetch for Official Docs:** If you identify official documentation URLs from the search, use WebFetch to retrieve and analyze the content directly.

3. **Codebase Pattern Analysis:** Search the current project codebase using Grep and Glob to find existing usage patterns of the library that might provide insights.

**Fallback Research Prompt:**

```
Based on my own knowledge and web search capabilities, research [LIBRARY_NAME] version [VERSION] about [SPECIFIC_TOPIC]. Focus on:
- Current best practices (year [CURRENT_YEAR])
- Official documentation recommendations
- Common implementation patterns
- Known issues or gotchas

Provide concrete, actionable recommendations even if external tools failed.
```

**Note:** Only proceed to Step 4 after either:

- Receiving results from the parallel agents (Step 3), OR
- Completing the fallback research (Step 3.1)

### 4. Comparison and synthesis

**MANDATORY FIRST ACTION:** Execute:

Once you have BOTH results:

1. **Analyze reliability:** Compare information from both sources
2. **Identify matches:** What information do both sources confirm?
3. **Detect differences:** Are there discrepancies? Why might they exist?
4. **Evaluate currency:** Which source appears more up-to-date?
5. **Present the best solution:** Based on your analysis, present a consolidated response that combines the best of both sources, clearly indicating:
   - Best practices confirmed by both sources
   - Unique valuable information from each source
   - Your final recommendation with justification
   - Confidence level in the information (High/Medium/Low)

## Response Format

Present your findings as follows:

```markdown
## Research on [LIBRARY] v[VERSION]

### Topic: [TOPIC]

#### Deep Research Results (Gemini)

[High Value Summary of research findings]

#### Context7 MCP Tool Results

[High Value Summary of context7 findings]

#### Comparative Analysis

- **Matches:** [Points both sources confirm]
- **Unique research information:** [Exclusive research findings]
- **Unique context7 information:** [Exclusive context7 findings]
- **Confidence level:** [High/Medium/Low]

#### Final Recommendation

[Your consolidated recommendation based on both sources, with clear justification]

#### Best Practices

- [List of confirmed best practices]
- [With code examples if relevant]
```

## Important Notes

- **CRITICAL:** Always launch the 2 agents in PARALLEL using ONE SINGLE MESSAGE with two Task tool invocations
- CRITIAL: Always print a message to inform to user where are you in this process
- DO NOT execute agents sequentially; they must run simultaneously to maximize efficiency
- Always include the current year in your searches to get updated information
- Be specific with library versions in both agent prompts
- Agents may take up to 5 minutes to complete; wait to receive BOTH results before synthesizing
- Each agent must return CLEAR, CONCISE, and VALUABLE information that solves the problem
- Do not invent information; if a source doesn't provide data about something, clearly indicate it in your analysis
- If there are conflicts between agent sources, analyze the differences and provide your best recommendation
- Prioritize official source information when possible
- Your role as the main agent is to synthesize information from both sub-agents and present the best applicable solution

## Usage Example

User: "Research best practices for Parallel Routes in Next.js"

Expected response:

1. Read package.json to find Next.js version (e.g., 14.0.0)
2. Launch TWO agents in PARALLEL in ONE SINGLE MESSAGE:
   - **Agent 1**: Deep research with gemini about Next.js 14.0.0 and Parallel Routes
   - **Agent 2**: Search with context7 MCP tool about Next.js 14.0.0 and Parallel Routes
3. Wait for BOTH agents to complete their investigations and return clear, concise, and valuable information
4. Receive results from both agents with processed information ready to use
5. Compare both results analyzing matches, differences, and confidence level
6. Present a consolidated synthesis with the best applicable solution based on information from both agents

**Remember:** Agents must run in parallel, NOT sequentially. This maximizes efficiency and allows both investigations (which may take several minutes) to occur simultaneously.
