# Bitcoin Computer v0.26.0-beta.0 Limitations

## Critical Issue: Nested Contract Creation via encode()

### Problem Summary

When using `computer.encode()` to call methods on existing contracts that need to create NEW contracts (like `Quiz.distributePrizes()` creating `Payment` contracts), Bitcoin Computer v0.26.0-beta.0 fails with internal errors.

### Error Manifestations

1. **`_0x955b38[_0x2fae96(...)] is not a function`**
   - Occurs when trying to resolve objects from the transition
   - Internal Bitcoin Computer library error in `getObject()`

2. **`Invalid expression Identifier directly after number`**
   - Occurs when revision strings start with digits
   - Expression parser can't handle revisions like `269454ee...` as identifiers

3. **`Could not find object with id...`**
   - Occurs when synced contract objects don't have necessary internal context

### What We Tried

#### Attempt 1: Direct Method Calls (Production Pattern)
```javascript
// From reveal route - doesn't persist in tests
quizContract.revealAnswers(answers, salt)
await sleep(3000)
const updated = await computer.sync(originalRev)
// updated.revealedAnswers is NULL - mutation didn't persist
```

**Result**: Fails silently - method executes but changes don't persist to blockchain.

#### Attempt 2: encode() with Revision String in Expression
```javascript
const { tx } = await computer.encode({
  exp: `${quizRev}.revealAnswers(...)`,
  env: { [quizRev]: syncedQuiz }
})
```

**Result**: `Invalid expression Identifier directly after number` - parser chokes on revision format.

#### Attempt 3: encode() with Simple Variable Name
```javascript
const { tx } = await computer.encode({
  exp: `quiz.revealAnswers(...)`,
  env: { quiz: syncedQuiz }
})
```

**Result**: `_0x955b38[_0x2fae96(...)] is not a function` - can't resolve contract internals.

#### Attempt 4: encode() with Module Specification
```javascript
const { tx } = await computer.encode({
  mod: quizModuleSpec,
  exp: `quiz.revealAnswers(...)`,
  env: { quiz: syncedQuiz }
})
```

**Result**: Same `_0x955b38` error - mod parameter doesn't help.

#### Attempt 5: encode() with env['property'] Syntax
```javascript
const { tx } = await computer.encode({
  exp: `env['quiz'].revealAnswers(...)`,
  env: { quiz: syncedQuiz }
})
```

**Result**: Same `_0x955b38` error - accessing via bracket notation doesn't help.

### Root Cause Analysis

The issue appears to be in Bitcoin Computer's internal handling of:

1. **Contract Context**: Synced contracts don't carry enough internal context (`_computer`, module definitions, etc.) to properly execute methods that create nested contracts.

2. **Module Resolution**: When a method like `distributePrizes()` tries to execute `new Payment(...)`, the Bitcoin Computer can't resolve the `Payment` class even though it's in the same module.

3. **Transition Processing**: The `fromTransition()` method fails to reconstruct objects from the blockchain transaction data.

### Working Patterns

✅ **Creating NEW contracts** works fine:
```javascript
const { tx, effect } = await computer.encode({
  mod: moduleSpec,
  exp: `new Quiz(...params...)`
})
await computer.broadcast(tx)
const quiz = effect.res // Works!
```

✅ **Calling methods that DON'T create nested contracts** works:
```javascript
// claim() just modifies the Payment contract itself
const { tx } = await computer.encode({
  exp: `${paymentRev}.claim()`,
  env: { [paymentRev]: paymentContract }
})
await computer.broadcast(tx) // Works!
```

❌ **Calling methods that CREATE nested contracts** fails:
```javascript
// distributePrizes() tries to create new Payment contracts
const { tx } = await computer.encode({
  exp: `quiz.distributePrizes(...)`,
  env: { quiz: quizContract }
})
// Fails with internal errors
```

### Affected Functionality

1. **Quiz.revealAnswers()** - Simple mutation, should work but doesn't persist
2. **Quiz.distributePrizes()** - Creates Payment contracts, completely fails
3. **QuizAttempt.collectFee()** - Would create Payment contracts, likely fails

### Impact on Production Code

**Current production code at `/src/lib/payment-distribution.ts` lines 210-220 DOES NOT WORK**:

```typescript
const { tx, effect } = await teacherComputer.encode({
  exp: `${quizRevToUse}.distributePrizes(${JSON.stringify(winnersData)})`,
  env: { [quizRevToUse]: quizContract }
})
```

This code will fail with the same errors we see in tests.

### Possible Solutions

#### Option 1: Upgrade Bitcoin Computer
- Check if newer versions (post v0.26.0-beta.0) fix this issue
- Review Bitcoin Computer changelog/issues for fixes

#### Option 2: Refactor Contract Architecture
- Split `distributePrizes()` into two steps:
  1. Quiz contract marks as "ready for distribution"
  2. Separate call creates Payment contracts from teacher wallet (not from Quiz)
- Downside: Changes fund flow model

#### Option 3: Use Direct Blockchain Transactions
- Bypass Bitcoin Computer's encode() for these operations
- Manually construct and sign transactions
- Downside: Much more complex, loses Bitcoin Computer benefits

#### Option 4: Accept Limitation
- Document that prize distribution must be handled off-chain or via different mechanism
- Use escrow or manual payment processing
- Keep Quiz contract simple (no nested contract creation)

### Recommended Path Forward

1. **Test with Bitcoin Computer v0.27+ or latest version**
   - Check if issue is fixed in newer releases
   - Update package.json if fix is available

2. **If not fixed, refactor to avoid nested contract creation**
   - Simplify Quiz contract to just track state
   - Create Payment contracts separately from teacher wallet
   - Update fund flow documentation

3. **Update tests to match working implementation**
   - Test only features that actually work
   - Document known limitations clearly
   - Don't test features that can't work with current Bitcoin Computer version

### Testing Notes

All patterns attempted in `/test/complete-flow.test.js` at lines:
- Reveal: Line 842-874
- Distribute Prizes: Line 963-1013
- Edge Cases: Lines 1177-1254

Current test results: 15 passing, 8 failing - all failures related to this limitation.

### Next Steps

1. Check Bitcoin Computer GitHub issues for similar reports
2. Test with latest Bitcoin Computer version
3. If still broken, redesign without nested contract creation
4. Update production code to match working pattern
5. Update tests to only test what works

---

**Status**: Under Investigation
**Priority**: CRITICAL - Blocks core platform functionality
**Owner**: Development Team
**Last Updated**: 2026-01-20
