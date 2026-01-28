# Monorepo Migration Plan

## Current Structure Analysis

```
bizz/
├── contracts/          # Smart contracts (Quiz, QuizAttempt, PrizeSwap, Payment)
├── src/                # Next.js frontend application
│   ├── app/           # Next.js app router
│   ├── components/    # React components
│   ├── lib/           # Utilities and helpers
│   ├── services/      # Backend services
│   └── types/         # TypeScript types
├── test/              # Test suites
├── scripts/           # Deployment and utility scripts
├── prisma/            # Database schema
├── public/            # Static assets
└── package.json       # Root dependencies
```

## Target Monorepo Structure

Following Bitcoin Computer monorepo patterns:

```
bizz/
├── packages/
│   ├── contracts/              # Smart contracts package
│   │   ├── src/
│   │   │   ├── Quiz.ts
│   │   │   ├── QuizAttempt.ts
│   │   │   ├── PrizeSwap.ts
│   │   │   ├── Payment.ts
│   │   │   └── index.ts       # Export all contracts
│   │   ├── deploy/            # Deployment versions (.deploy.js)
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                    # Next.js frontend
│   │   ├── src/               # (current src/ contents)
│   │   ├── public/
│   │   ├── prisma/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   └── tsconfig.json
│   │
│   ├── tests/                  # Integration tests package
│   │   ├── swap-flow.test.js
│   │   ├── swap-flow.test2.js
│   │   ├── complete-flow.test.js
│   │   ├── .mocharc.json
│   │   ├── .mocharc.swap.json
│   │   ├── loader.mjs
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── scripts/                # Utility scripts package
│       ├── test-quiz.js
│       ├── deploy-testnet.js
│       ├── test-contracts.js
│       └── package.json
│
├── docs/                       # Documentation (MD files from root)
│   ├── BITCOIN_COMPUTER_IMPLEMENTATION_REPORT.md
│   ├── DEFERRED_PAYMENT_DESIGN.md
│   └── ... (all other .md files)
│
├── package.json                # Root workspace configuration
├── .env                        # Environment variables
├── .gitignore
└── README.md
```

## Migration Steps

### Phase 1: Preparation (No Breaking Changes)

**1.1 Create packages directory structure**
```bash
mkdir -p packages/{contracts,web,tests,scripts}
```

**1.2 Create root workspace package.json**
- Set up npm workspaces
- Move shared devDependencies to root
- Keep package-specific dependencies in each package

**1.3 Backup current working state**
```bash
git checkout -b monorepo-migration
git add . && git commit -m "Pre-monorepo migration checkpoint"
```

### Phase 2: Migrate Contracts Package

**2.1 Set up contracts package**
```bash
mkdir -p packages/contracts/{src,deploy,tests}
```

**2.2 Move contract files**
```bash
# TypeScript sources
mv contracts/*.ts packages/contracts/src/

# Deployment versions
mv contracts/*.deploy.js packages/contracts/deploy/

# JavaScript versions (if needed)
mv contracts/*.js packages/contracts/deploy/
```

**2.3 Create contracts/package.json**
- Name: `@bizz/contracts`
- Exports: All contract classes
- Dependencies: `@bitcoin-computer/lib`

**2.4 Create contracts/src/index.ts**
- Export all contracts for easy importing

### Phase 3: Migrate Web Package

**3.1 Set up web package**
```bash
mkdir -p packages/web
```

**3.2 Move web application files**
```bash
# Copy entire src/ directory
cp -r src packages/web/

# Move Next.js config files
mv next.config.ts packages/web/
mv next-env.d.ts packages/web/
mv postcss.config.mjs packages/web/
mv tailwind.config.* packages/web/ (if exists)

# Move prisma
cp -r prisma packages/web/

# Move public assets
cp -r public packages/web/

# Move web-specific config
cp eslint.config.mjs packages/web/
```

**3.3 Create web/package.json**
- Name: `@bizz/web`
- Dependencies: Next.js, React, Prisma, etc.
- Add dependency: `@bizz/contracts`
- Scripts: dev, build, start, lint

**3.4 Update import paths in web package**
- Change: `import { Quiz } from '@/contracts/Quiz'`
- To: `import { Quiz } from '@bizz/contracts'`

### Phase 4: Migrate Tests Package

**4.1 Set up tests package**
```bash
mkdir -p packages/tests
```

**4.2 Move test files**
```bash
mv test/*.test.js packages/tests/
mv test/*.test.js.* packages/tests/  # Backups
mv test/README.md packages/tests/
mv .mocharc.json packages/tests/
mv .mocharc.swap.json packages/tests/
mv loader.mjs packages/tests/
```

**4.3 Create tests/package.json**
- Name: `@bizz/tests`
- Dependencies: mocha, chai, @bitcoin-computer/lib
- Add dependencies: `@bizz/contracts`
- Scripts: test, test:swap

**4.4 Update test imports**
- Change: `import { Quiz } from '../contracts/Quiz.ts'`
- To: `import { Quiz } from '@bizz/contracts'`

### Phase 5: Migrate Scripts Package

**5.1 Set up scripts package**
```bash
mkdir -p packages/scripts
```

**5.2 Move script files**
```bash
mv scripts/* packages/scripts/
```

**5.3 Create scripts/package.json**
- Name: `@bizz/scripts`
- Dependencies: As needed
- Add dependencies: `@bizz/contracts`, `@bizz/web` (for utilities)
- Scripts: Various utility commands

### Phase 6: Move Documentation

**6.1 Organize documentation**
```bash
mkdir -p docs
mv *.md docs/
# Keep README.md at root
cp docs/README.md ./
```

### Phase 7: Update Root Configuration

**7.1 Update root package.json**
- Add workspaces configuration
- Add convenience scripts that call workspace scripts
- Keep root-level scripts for common operations

**7.2 Update .gitignore**
- Add workspace-specific ignore patterns
- Keep node_modules at root and packages

**7.3 Update tsconfig.json**
- Configure for workspace references
- Each package has its own tsconfig extending root

### Phase 8: Dependency Management

**8.1 Install workspace dependencies**
```bash
npm install
```

**8.2 Verify workspace linking**
```bash
npm run build --workspaces
```

**8.3 Test imports work correctly**
```bash
cd packages/web
node -e "console.log(require('@bizz/contracts'))"
```

### Phase 9: Verification

**9.1 Run all tests**
```bash
npm run test:swap -w @bizz/tests
npm run test:flow -w @bizz/tests
```

**9.2 Test web development**
```bash
npm run dev -w @bizz/web
```

**9.3 Test build process**
```bash
npm run build -w @bizz/web
```

**9.4 Verify contract deployments still work**
```bash
npm run deploy:testnet -w @bizz/scripts
```

## Detailed Package Configurations

### Root package.json
```json
{
  "name": "bizz-monorepo",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev -w @bizz/web",
    "build": "npm run build --workspaces",
    "test": "npm run test -w @bizz/tests",
    "test:swap": "npm run test:swap -w @bizz/tests",
    "lint": "npm run lint --workspaces",
    "clean": "rm -rf packages/*/node_modules packages/*/.next packages/*/dist"
  },
  "devDependencies": {
    "@types/node": "^20",
    "typescript": "^5"
  }
}
```

### packages/contracts/package.json
```json
{
  "name": "@bizz/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./Quiz": {
      "import": "./dist/Quiz.js",
      "types": "./dist/Quiz.d.ts"
    },
    "./QuizAttempt": {
      "import": "./dist/QuizAttempt.js",
      "types": "./dist/QuizAttempt.d.ts"
    },
    "./PrizeSwap": {
      "import": "./dist/PrizeSwap.js",
      "types": "./dist/PrizeSwap.d.ts"
    },
    "./Payment": {
      "import": "./dist/Payment.js",
      "types": "./dist/Payment.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@bitcoin-computer/lib": "^0.26.0-beta.0"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

### packages/web/package.json
```json
{
  "name": "@bizz/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "postinstall": "prisma generate",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@bizz/contracts": "*",
    "@bitcoin-computer/lib": "^0.26.0-beta.0",
    "@next-auth/prisma-adapter": "^1.0.7",
    "@prisma/client": "^5.22.0",
    "next": "16.1.1",
    "react": "19.2.3",
    "react-dom": "19.2.3"
    // ... all other dependencies from current package.json
  }
}
```

### packages/tests/package.json
```json
{
  "name": "@bizz/tests",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "mocha",
    "test:swap": "mocha --config .mocharc.swap.json",
    "test:flow": "mocha complete-flow.test.js",
    "test:watch": "mocha --watch **/*.test.js"
  },
  "dependencies": {
    "@bizz/contracts": "*",
    "@bitcoin-computer/lib": "^0.26.0-beta.0",
    "dotenv": "^17.2.3"
  },
  "devDependencies": {
    "@types/chai": "^5.2.3",
    "@types/mocha": "^10.0.10",
    "chai": "^6.2.2",
    "mocha": "^11.7.5"
  }
}
```

## Import Path Updates

### Before (Current)
```typescript
// In web package
import { Quiz } from '@/contracts/Quiz'
import { QuizAttempt } from '@/contracts/QuizAttempt'

// In tests
import { Quiz } from '../contracts/Quiz.ts'
import { PrizeSwap } from '../contracts/PrizeSwap.ts'
```

### After (Monorepo)
```typescript
// In web package
import { Quiz, QuizAttempt } from '@bizz/contracts'

// In tests
import { Quiz, PrizeSwap } from '@bizz/contracts'
```

## TypeScript Configuration

### Root tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "composite": true
  },
  "references": [
    { "path": "./packages/contracts" },
    { "path": "./packages/web" }
  ]
}
```

### packages/contracts/tsconfig.json
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### packages/web/tsconfig.json
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@bizz/contracts": ["../contracts/dist"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"],
  "references": [
    { "path": "../contracts" }
  ]
}
```

## Benefits of This Structure

### 1. **Clear Separation of Concerns**
- Contracts isolated and reusable
- Frontend application self-contained
- Tests independent and focused
- Scripts organized separately

### 2. **Dependency Management**
- Explicit package dependencies via `@bizz/*`
- No circular dependencies
- Easier to track what depends on what

### 3. **Build Optimization**
- Build contracts once, use everywhere
- Incremental builds via TypeScript project references
- Parallel builds across packages

### 4. **Scalability**
- Easy to add new packages (mobile app, CLI, docs site)
- Can extract shared utilities into `@bizz/lib`
- Future packages: `@bizz/mobile`, `@bizz/cli`, `@bizz/sdk`

### 5. **Testing**
- Test contracts independently
- Integration tests use published contract package
- No need to mock contracts in tests

### 6. **Deployment**
- Deploy web package independently
- Contracts can be published to npm (if public)
- Scripts can be run from anywhere

## Rollback Plan

If anything breaks during migration:

```bash
# Restore from pre-migration commit
git reset --hard HEAD~1

# Or restore specific files
git checkout HEAD~1 -- path/to/file
```

## Post-Migration Tasks

### 1. Update Documentation
- Update README.md with new structure
- Document workspace commands
- Update developer setup guide

### 2. Update CI/CD
- Modify GitHub Actions to build workspaces
- Update Vercel configuration for web package path
- Adjust test commands in CI

### 3. Update Environment Variables
- Ensure `.env` files work with new structure
- Update paths in environment variables if needed

### 4. Update Scripts
- RUN_TESTS.sh needs to reference new test location
- Deploy scripts need updated paths

### 5. Clean Up
- Remove old directories after verification
- Archive old structure in a branch
- Update .gitignore for workspace patterns

## Success Criteria

- ✅ All 19 tests pass (swap-flow.test.js + swap-flow.test2.js)
- ✅ Web application runs in development mode
- ✅ Web application builds successfully
- ✅ Contract imports work correctly
- ✅ Prisma migrations work
- ✅ Scripts execute without errors
- ✅ No breaking changes to functionality
- ✅ All environment variables work
- ✅ TypeScript compilation succeeds across all packages

## Timeline Estimate

- Phase 1-2 (Preparation + Contracts): 30 minutes
- Phase 3 (Web Migration): 45 minutes
- Phase 4-5 (Tests + Scripts): 30 minutes
- Phase 6-8 (Docs + Config + Dependencies): 30 minutes
- Phase 9 (Verification): 30 minutes

**Total: ~3 hours** (including testing and verification)

## Next Steps

Ready to begin migration? The process will:
1. Create all package directories
2. Create all package.json files
3. Move files to new locations
4. Update import paths
5. Configure workspaces
6. Install dependencies
7. Run comprehensive tests

Would you like me to proceed with the migration?
