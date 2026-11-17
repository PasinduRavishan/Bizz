# Helper Functions Guide

## Overview

All contract files now include helper functions following the **Bitcoin Computer monorepo pattern**. Helper functions are defined **outside the class** in the same contract file, making them easy to import and use in tests.

## Structure

### Contract Files

Each contract file (`*.ts`) has two sections:

1. **Contract Class** - The smart contract logic
2. **Helper Functions** - Deployment and common operations (exported at the bottom)

Example structure:
```typescript
// Quiz.ts
export class Quiz extends Token {
  // ... contract logic ...
}

// ============================================================================
// HELPER FUNCTIONS
// Pattern: Bitcoin Computer monorepo - helpers outside class in same file
// ============================================================================

export async function deployQuizModule(computer, Token, Quiz) {
  return await computer.deploy(`export ${Token}\nexport ${Quiz}`)
}

export async function createQuiz(computer, moduleSpec, params) {
  // ... uses same encode() pattern as tests ...
}
```

### Deploy Files

After building (`node contracts/scripts/build-deploy.js`), helpers are automatically exported in `*.deploy.js` files:

```javascript
// Quiz.deploy.js
export class Quiz extends Token { ... }
export async function deployQuizModule(computer, Token, Quiz) { ... }
export async function createQuiz(computer, moduleSpec, params) { ... }
```

## Available Helpers

### Quiz.ts
- `deployQuizModule(computer, Token, Quiz)` - Deploy Token + Quiz module together
- `createQuiz(computer, moduleSpec, params)` - Create Quiz fungible token

### Payment.ts
- `deployPaymentModule(computer, Payment)` - Deploy Payment module
- `createPayment(computer, moduleSpec, params)` - Create Payment object
- `claimPayment(computer, moduleSpec, payment)` - Claim payment to release satoshis

### QuizAttempt.ts
- `deployQuizAttemptModule(computer, QuizAttempt)` - Deploy QuizAttempt module
- `createQuizAttempt(computer, moduleSpec, params)` - Create QuizAttempt
- `submitCommitment(computer, moduleSpec, attempt, commitment)` - Submit answers
- `verifyAttempt(computer, moduleSpec, attempt, ...)` - Verify attempt with revealed answers

### QuizAccess.ts
- `deployQuizAccessModule(computer, QuizAccess)` - Deploy QuizAccess module
- `createQuizAccessTx(teacherComputer, moduleSpec, quiz, paymentMock, ...)` - Create partial tx (teacher side)

### QuizRedemption.ts
- `deployQuizRedemptionModule(computer, QuizRedemption)` - Deploy QuizRedemption module
- `redeemQuizToken(computer, moduleSpec, quizToken, quizAttempt)` - Redeem quiz token

### AnswerProof.ts
- `deployAnswerProofModule(computer, AnswerProof)` - Deploy AnswerProof module
- `createAnswerProof(computer, moduleSpec, params)` - Create AnswerProof

### PrizeSwap.ts
- `deployPrizeSwapModule(computer, PrizeSwap)` - Deploy PrizeSwap module
- `createPrizeSwapTx(teacherComputer, moduleSpec, prizePayment, answerProof, ...)` - Create swap tx (teacher side)

## Test Helpers (TestHelper.ts)

Generic utilities for all tests:

### TestHelper class
- `withRetry(operation, computer, config)` - Retry with automatic mempool handling
- `mineBlock(computer)` - Mine a block
- `sleep(ms)` - Async sleep
- `getBalance(computer)` - Get balance with confirmed/unconfirmed breakdown
- `displayBalanceChange(label, before, after)` - Log balance changes

### QuizCrypto class
- `hashAnswer(quizId, index, answer, salt)` - Hash answer for verification
- `hashCommitment(answers, nonce)` - Hash commitment for submission
- `generateSalt()` - Generate cryptographic salt

### QuizScoring class
- `calculateScore(studentAnswers, correctAnswers)` - Calculate quiz score
- `didPass(score, threshold)` - Check if student passed

## Usage in Tests

### TypeScript Test (Recommended)

```typescript
import { Quiz, deployQuizModule, createQuiz } from '@bizz/contracts/deploy/Quiz.deploy.js'
import { Payment, createPayment, claimPayment } from '@bizz/contracts/deploy/Payment.deploy.js'
import { TestHelper, QuizCrypto, QuizScoring } from './helpers/TestHelper.js'

// Deploy module
const quizModuleSpec = await TestHelper.withRetry(
  () => deployQuizModule(teacherComputer, Token, Quiz),
  teacherComputer,
  { operationName: 'Deploy Quiz module' }
)

// Create quiz using helper
const { quiz } = await TestHelper.withRetry(
  () => createQuiz(teacherComputer, quizModuleSpec, {
    teacherPubKey,
    initialSupply: 1n,
    symbol: 'MATH101',
    questionHashIPFS: 'QmTest123',
    answerHashes,
    prizePool,
    entryFee,
    passThreshold,
    deadline,
    teacherRevealDeadline
  }),
  teacherComputer,
  { operationName: 'Create Quiz' }
)

// Create payment using helper
const { payment } = await createPayment(teacherComputer, paymentModuleSpec, {
  recipient: studentPubKey,
  amount: prizePool,
  purpose: 'Quiz Prize',
  reference: attemptId
})

// Claim payment using helper
const claimedPayment = await claimPayment(studentComputer, paymentModuleSpec, payment)

// Use quiz crypto helpers
const salt = QuizCrypto.generateSalt()
const answerHashes = correctAnswers.map((answer, index) =>
  QuizCrypto.hashAnswer(quizId, index, answer, salt)
)

// Use scoring helpers
const score = QuizScoring.calculateScore(studentAnswers, correctAnswers)
const passed = QuizScoring.didPass(score.percentage, passThreshold)
```

### JavaScript Test (Still Supported)

```javascript
// JS tests can still use the old pattern or gradually adopt helpers
const { tx, effect } = await computer.encode({ ... })
```

## Benefits

### 1. **Cleaner Tests**
Before:
```typescript
const { tx, effect } = await computer.encode({
  mod: quizModuleSpec,
  exp: `new Quiz("${teacherPubKey}", BigInt(${initialSupply}), "${symbol}", ...)`
})
await computer.broadcast(tx)
const quiz = effect.res
```

After:
```typescript
const { quiz } = await createQuiz(computer, quizModuleSpec, params)
```

### 2. **Type Safety**
Helpers have proper TypeScript parameter types, catching errors at compile time.

### 3. **Consistency**
Same encode/broadcast patterns used everywhere, reduced duplication.

### 4. **Maintainability**
Contract logic and helpers in one file - easier to update together.

### 5. **Bitcoin Computer Pattern**
Follows the monorepo convention of exporting helpers from contract files.

## Implementation Details

### Same Syntax, Different Location
Helpers use the **exact same** `computer.encode()`, `computer.deploy()`, `computer.broadcast()` patterns from the original test file. We just moved them into reusable functions.

### Auto-Export in Deploy Files
The build script (`contracts/scripts/build-deploy.js`) automatically:
1. Compiles TypeScript to JavaScript
2. Removes imports and type annotations
3. Exports both classes and helper functions
4. Makes them available for blockchain deployment

### No Breaking Changes
- Old JS tests still work
- Can gradually migrate to helpers
- Helpers are optional - you can still use `computer.encode()` directly

## Running Tests

### JavaScript Test (Current)
```bash
cd packages/tests
npx mocha tbc20-quiz-token-flow.test.js --timeout 600000
```

### TypeScript Test (New)
```bash
cd packages/tests
npx mocha tbc20-quiz-token-flow.test.ts --timeout 600000 --require ./loader.mjs
```

## File Locations

```
packages/
├── contracts/
│   ├── src/
│   │   ├── Quiz.ts              # Contract + helpers
│   │   ├── Payment.ts           # Contract + helpers
│   │   ├── QuizAttempt.ts       # Contract + helpers
│   │   ├── QuizAccess.ts        # Contract + helpers
│   │   ├── QuizRedemption.ts    # Contract + helpers
│   │   ├── AnswerProof.ts       # Contract + helpers
│   │   └── PrizeSwap.ts         # Contract + helpers
│   ├── deploy/
│   │   └── *.deploy.js          # Auto-generated with helpers
│   └── scripts/
│       └── build-deploy.js      # Build script
└── tests/
    ├── helpers/
    │   └── TestHelper.ts        # Generic test utilities
    ├── tbc20-quiz-token-flow.test.js   # Original JS test
    └── tbc20-quiz-token-flow.test.ts   # New TypeScript test
```

## Summary

✅ **All contract files** have helper functions
✅ **Deploy files** auto-export helpers
✅ **TypeScript test** uses helpers throughout
✅ **JavaScript test** still works
✅ **Same implementation** - just better organized
✅ **Bitcoin Computer pattern** - helpers outside class in same file

The refactoring improves code organization without changing functionality. Tests are cleaner, more maintainable, and follow Bitcoin Computer best practices!
