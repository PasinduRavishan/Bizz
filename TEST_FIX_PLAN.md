# Test Fix Plan - Based on Bitcoin Computer Documentation

## Key Findings from Bitcoin Computer Docs

### Pattern 1: Direct Method Calls (No Nested Contracts)
**When to use**: Methods that only modify the contract's own state

**Example from docs**:
```javascript
await chat.post('world')  // Automatically creates & broadcasts transaction
```

**Our case**: `revealAnswers()` - only modifies Quiz state, doesn't create nested contracts
- ✅ **Should use direct call**: `await syncedQuiz.revealAnswers(correctAnswers, salt)`
- After calling, use `computer.query()` to get latest revision

### Pattern 2: Static Methods That Create Nested Contracts
**When to use**: Creating multiple contracts in one atomic transaction

**Example from docs (Swap.exec)**:
```javascript
const { tx } = await alice.encode({
  exp: `${StaticSwap} Swap.exec(a, b)`,
  env: { a: a._rev, b: b._rev },
})
```

**Example from docs (Sale.exec)**:
```javascript
const { tx } = await seller.encode({
  exp: `${Sale} Sale.exec(nft, payment)`,
  env: { nft: nft._rev, payment: mock._rev },
  mocks: { payment: mock }
})
```

**Key requirements**:
- Method MUST be **static**
- Pass existing contract objects via `env` (maps variable names to revisions)
- Pass mock objects via `mocks` if the actual object doesn't exist yet

### Pattern 3: Direct Method Calls on Simple Contracts
**Example from docs (Payment.claim)**:
```javascript
const paymentB = await computerB.sync(payment._rev)
await paymentB.cashOut()  // Direct method call
```

## Problems in Our Test Code

### Problem 1: `revealAnswers()` ✅ FIXABLE
**Current code**: Uses `encode()` incorrectly
**Fix**: Use direct method call
```javascript
// CORRECT:
const syncedQuiz = await teacherComputer.sync(quizContract._rev)
await syncedQuiz.revealAnswers(correctAnswers, salt)
await sleep(3000)
const [latestRev] = await teacherComputer.query({ ids: [quizContract._id] })
const revealedQuiz = await teacherComputer.sync(latestRev)
```

### Problem 2: `distributePrizes()` ❌ BROKEN BY DESIGN
**Current implementation**: Instance method (`async distributePrizes(winners)`)
**Problem**: Instance methods that create nested contracts DON'T WORK in Bitcoin Computer!

**Evidence**:
- All examples in docs use **STATIC** methods for nested contract creation
- `Swap.exec()` is static
- `Sale.exec()` is static
- `OrdSale.exec()` is static

**Why it's broken**:
1. `distributePrizes` is an **instance method** on Quiz
2. It creates `new Payment()` objects inside
3. Bitcoin Computer can't handle instance methods creating nested contracts
4. No amount of `encode()`, `env`, or `mocks` will fix this

**Root cause**: Architectural design flaw - should be a static method

### Problem 3: `claim()` ✅ FIXABLE
**Current code**: Uses `${paymentRev}.claim()` with encode
**Fix**: Use direct method call
```javascript
// CORRECT:
const paymentContract = await student1Computer.sync(paymentRev)
await paymentContract.claim()
```

## Solution Options

### Option A: Redesign Contract Architecture (RECOMMENDED)
Make `distributePrizes` a **static method** on Quiz class:

```javascript
export class Quiz extends Contract {
  // ... existing code ...

  // Change from instance method to STATIC method
  static async distributePrizes(quiz, winners) {
    if (quiz.status !== 'revealed') {
      throw new Error('Quiz must be revealed first')
    }

    const payments = []
    const totalPrize = quiz._satoshis - BigInt(546)
    const prizePerWinner = totalPrize / BigInt(winners.length)

    for (const winner of winners) {
      const payment = new Payment(
        winner.student,
        prizePerWinner,
        `Quiz Prize - ${quiz.questionHashIPFS}`,
        quiz._id
      )
      payments.push(payment._rev)
    }

    quiz._satoshis = BigInt(546)  // Reduce to dust
    quiz.status = 'completed'
    quiz.winners = winners.map((w, i) => ({
      ...w,
      prizeAmount: prizePerWinner,
      paymentRev: payments[i]
    }))

    return payments  // Return array of payment revisions
  }
}
```

Then in tests:
```javascript
const { tx, effect } = await teacherComputer.encode({
  exp: `${Quiz} Quiz.distributePrizes(quiz, ${JSON.stringify(winners)})`,
  env: { quiz: syncedQuiz._rev },
  mod: quizModuleSpec
})
await teacherComputer.broadcast(tx)
const paymentRevs = effect.res
```

### Option B: Two-Step Process (WORKAROUND)
1. Call an instance method to mark quiz as "distributing"
2. Create Payment contracts separately from teacher wallet (not from Quiz)

This changes the fund flow model significantly.

### Option C: Accept Limitation (NOT RECOMMENDED)
- Remove prize distribution tests
- Handle distribution off-chain
- Defeats the purpose of smart contracts

## Recommended Implementation Steps

1. ✅ **Fix `revealAnswers()`** - Use direct method call
2. ✅ **Fix `claim()`** - Use direct method call
3. ❌ **Redesign `distributePrizes`** - Make it static (requires contract changes)
4. Update production code to match working patterns
5. Update tests to match new architecture

## Impact Assessment

**Files that need changes**:
1. `/contracts/Quiz.js` - Make distributePrizes static
2. `/public/contracts/Quiz.js` - Make distributePrizes static
3. `/test/complete-flow.test.js` - Update test calls
4. `/src/lib/payment-distribution.ts` - Update production code
5. All API routes that call distributePrizes

**Breaking changes**: YES - Changes contract interface

**Alternative**: Keep current architecture but accept that prize distribution via smart contracts doesn't work with Bitcoin Computer v0.26.0-beta.0

## Next Steps

**For immediate test fixes**:
1. Fix `revealAnswers` with direct call
2. Fix `claim` with direct call
3. Document that `distributePrizes` requires architectural redesign

**For production**:
1. Decide: Redesign contracts (static methods) OR handle distribution off-chain
2. If redesigning: Update all contracts and redeploy
3. If going off-chain: Remove blockchain-based distribution, use traditional payments

---

**Status**: Awaiting decision on how to proceed with `distributePrizes`
**Priority**: HIGH - Blocks core platform functionality
**Owner**: Development Team
**Last Updated**: 2026-01-20
