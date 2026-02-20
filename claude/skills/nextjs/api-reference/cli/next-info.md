# next info

Display system and Next.js environment information for debugging.

## Syntax

```bash
next info [options]
```

## Description

Collects and displays relevant system information about:
- Operating system
- Binary versions (Node.js, npm/yarn/pnpm)
- Next.js version and dependencies
- React version
- Installed packages
- Configuration details

Useful for:
- Debugging issues
- Creating bug reports
- Verifying environment setup
- Sharing configuration

## Options

### `--verbose`
Display additional detailed information.

```bash
next info --verbose
```

Shows:
- All installed dependencies
- Full package versions
- Extended system details

## Output Information

### System Information
- **Operating System**: Platform and version
- **Architecture**: CPU architecture (x64, arm64, etc.)
- **Node.js Version**: Installed Node version
- **Package Manager**: npm, yarn, pnpm, or bun with version

### Next.js Information
- **Next.js Version**: Current Next.js version
- **React Version**: Installed React version
- **React DOM Version**: React DOM version

### Dependencies
- **TypeScript**: If installed
- **ESLint**: Configuration
- **Styled Components/Emotion**: If used
- **Other key dependencies**

## Usage Examples

### Basic Info
```bash
next info
```

Output:
```
Operating System:
  Platform: darwin
  Arch: arm64
  Version: Darwin Kernel Version 22.5.0

Binaries:
  Node: 18.17.0
  npm: 9.8.1
  Yarn: 1.22.19
  pnpm: 8.6.12

Relevant Packages:
  next: 14.0.0
  react: 18.2.0
  react-dom: 18.2.0
  typescript: 5.2.2

Next.js Config:
  output: standalone
```

### Verbose Mode
```bash
next info --verbose
```

Additional output:
```
  @next/font: 14.0.0
  eslint-config-next: 14.0.0
  autoprefixer: 10.4.15
  tailwindcss: 3.3.3
  ...all dependencies
```

## Common Use Cases

### Bug Reports
```bash
# Collect info for GitHub issue
next info > system-info.txt

# Include in bug report
cat system-info.txt
```

### Environment Verification
```bash
# Check installed versions
next info

# Verify Node.js version
next info | grep Node

# Check Next.js version
next info | grep "next:"
```

### CI/CD Debugging
```bash
# Add to CI pipeline
- name: Next.js Info
  run: next info

# Compare environments
next info > local.txt
# On CI
next info > ci.txt
diff local.txt ci.txt
```

### Team Onboarding
```bash
# Document environment setup
next info > ENVIRONMENT.md

# New team member verifies setup
next info
# Compare with ENVIRONMENT.md
```

## Integration Examples

### GitHub Actions
```yaml
name: Environment Info
on: [push]
jobs:
  info:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: next info
```

### Package.json Script
```json
{
  "scripts": {
    "info": "next info",
    "info:verbose": "next info --verbose",
    "debug": "next info > debug-info.txt && cat debug-info.txt"
  }
}
```

### Docker Health Check
```dockerfile
FROM node:18-alpine

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy app
COPY . .

# Health check with info
HEALTHCHECK --interval=30s --timeout=3s \
  CMD next info || exit 1

# Build and start
RUN npm run build
CMD ["npm", "start"]
```

## Output Parsing

### Extract Node Version
```bash
next info | grep "Node:" | awk '{print $2}'
```

### Extract Next.js Version
```bash
next info | grep "next:" | awk '{print $2}'
```

### Check for TypeScript
```bash
if next info | grep -q "typescript:"; then
  echo "TypeScript is installed"
else
  echo "TypeScript not found"
fi
```

### JSON Output (using jq)
```bash
# Create JSON from output
next info | jq -R -s 'split("\n")'
```

## System Requirements Check

### Verify Minimum Requirements
```bash
#!/bin/bash

# Get Node version
NODE_VERSION=$(next info | grep "Node:" | awk '{print $2}')

# Check minimum version
MIN_VERSION="18.17.0"

if [ "$(printf '%s\n' "$MIN_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$MIN_VERSION" ]; then
  echo "✅ Node.js version $NODE_VERSION meets minimum requirement"
else
  echo "❌ Node.js version $NODE_VERSION is below minimum $MIN_VERSION"
  exit 1
fi
```

### Check Dependencies
```bash
#!/bin/bash

REQUIRED_DEPS=("next" "react" "react-dom")

for dep in "${REQUIRED_DEPS[@]}"; do
  if next info | grep -q "$dep:"; then
    VERSION=$(next info | grep "$dep:" | awk '{print $2}')
    echo "✅ $dep: $VERSION"
  else
    echo "❌ $dep: not found"
    exit 1
  fi
done
```

## Troubleshooting

### Command Not Found
```bash
# Ensure Next.js is installed
npm install next

# Or install globally
npm install -g next

# Use via npx
npx next info
```

### Incomplete Information
```bash
# Ensure all dependencies installed
npm install

# Use verbose mode
next info --verbose

# Check package.json exists
ls package.json
```

### Incorrect Versions
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Verify installation
next info
```

## Comparison with Other Tools

### vs `npm list`
```bash
# next info - Next.js specific
next info

# npm list - All dependencies
npm list

# npm list - Only Next.js related
npm list next react react-dom
```

### vs `node --version`
```bash
# node - Only Node.js version
node --version

# next info - Comprehensive info
next info
```

### vs `npm doctor`
```bash
# npm doctor - npm health check
npm doctor

# next info - Next.js environment
next info
```

## Output to Different Formats

### Plain Text
```bash
next info > system-info.txt
```

### Markdown
```bash
echo "# System Information" > INFO.md
echo "\`\`\`" >> INFO.md
next info >> INFO.md
echo "\`\`\`" >> INFO.md
```

### HTML
```bash
echo "<pre>" > info.html
next info >> info.html
echo "</pre>" >> info.html
```

### JSON (manual conversion)
```bash
next info | awk '
  /Operating System:/ { print "{\"os\": {" }
  /Platform:/ { print "\"platform\": \"" $2 "\"," }
  /Binaries:/ { print "}, \"binaries\": {" }
  /Node:/ { print "\"node\": \"" $2 "\"," }
  /Relevant Packages:/ { print "}, \"packages\": {" }
  /next:/ { print "\"next\": \"" $2 "\"" }
  END { print "}}" }
'
```

## CI/CD Integration

### Save as Artifact
```yaml
# GitHub Actions
- name: Collect System Info
  run: next info > system-info.txt

- name: Upload Artifact
  uses: actions/upload-artifact@v3
  with:
    name: system-info
    path: system-info.txt
```

### Environment Validation
```yaml
# GitHub Actions
- name: Validate Environment
  run: |
    next info
    if ! next info | grep -q "Node: 18"; then
      echo "❌ Wrong Node.js version"
      exit 1
    fi
```

### Cache Key Generation
```yaml
# Use output for cache key
- name: Get Versions
  id: versions
  run: |
    echo "node=$(next info | grep 'Node:' | awk '{print $2}')" >> $GITHUB_OUTPUT
    echo "next=$(next info | grep 'next:' | awk '{print $2}')" >> $GITHUB_OUTPUT

- name: Cache Dependencies
  uses: actions/cache@v3
  with:
    key: ${{ runner.os }}-${{ steps.versions.outputs.node }}-${{ steps.versions.outputs.next }}
```

## Best Practices

1. **Include in Bug Reports**: Always run `next info` when reporting issues
2. **Document Environment**: Save output for environment documentation
3. **CI/CD Validation**: Verify environment in CI pipelines
4. **Version Tracking**: Track version changes over time
5. **Onboarding**: Use for team environment setup verification

## Related Commands

- [next dev](./next-dev.md) - Development server
- [next build](./next-build.md) - Production build
- [create-next-app](./create-next-app.md) - Create new project

## Learn More

- [System Requirements](https://nextjs.org/docs/getting-started/installation#system-requirements)
- [Supported Browsers](https://nextjs.org/docs/architecture/supported-browsers)
- [Node.js Version Support](https://nodejs.org/en/about/releases/)
