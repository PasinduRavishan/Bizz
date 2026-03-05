# Bizz Tests

Integration tests for the Bitcoin Computer Quiz Platform.

## Project Structure

```
packages/tests/
├── helpers/
│   └── TestHelper.ts          # Test utilities (timing, crypto, scoring)
├── tbc20-quiz-token-flow.test.ts  # Main TBC20 fungible token flow test
├── *.test.ts                  # Other test files
├── dist/                      # Compiled JavaScript output (gitignored)
├── tsconfig.json              # TypeScript configuration
└── package.json               # Test scripts and dependencies
```

## Build System

Tests are written in **TypeScript** and compiled to **JavaScript** before running.

### Build Output
- **Source**: `*.ts` files (TypeScript)
- **Compiled**: `dist/**/*.js` files (JavaScript + declaration files + source maps)
- The `dist/` folder is **gitignored** and auto-generated

### Build Commands

```bash
# Build tests (compiles TS → JS in dist/)
npm run build

# Clean build output
npm run clean

# Watch mode - rebuild on file changes
npm run build:watch
```

## Running Tests

Tests automatically build before running (via `pretest` script).

```bash
# Run all tests (auto-builds first)
npm test

# Run specific test
npm run test:tbc20       # TBC20 fungible token flow
npm run test:flow        # Complete flow
npm run test:swap        # Swap flow

# Watch mode - rebuild and rerun on changes
npm run test:watch
```

## Development Workflow

1. **Write tests** in TypeScript (`*.test.ts`)
2. **Build** with `npm run build` (or automatic via `npm test`)
3. **Run tests** with `npm test`
4. **Compiled files** go to `dist/` (gitignored)
5. **Source files** stay clean - no `.js` or `.d.ts` in source directory
