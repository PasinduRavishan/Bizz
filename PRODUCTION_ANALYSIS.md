# Production Readiness Analysis - Bitcoin Computer Quiz Platform

## Executive Summary

**Status: NOT PRODUCTION READY**

This analysis reveals critical issues with the fund flow implementation. While the blockchain contracts are properly designed, the payment distribution code does NOT actually transfer funds from locked contracts. Instead, it creates new Payment contracts using the teacher's wallet UTXOs, effectively making the teacher pay twice.

---

## System Architecture Overview

### Smart Contracts (On-Chain)

| Contract | Purpose | Fund Locking |
|----------|---------|--------------|
| `Quiz.js` | Quiz definition, stores prize pool | `_satoshis: prizePool` |
| `QuizAttempt.js` | Student attempt, stores entry fee | `_satoshis: entryFee` |
| `Payment.js` | Prize distribution, claimable by recipient | `_satoshis: amount` |

### Key Files

- `/src/app/api/quizzes/create/route.ts` - Quiz creation (deploys Quiz contract)
- `/src/app/api/attempts/submit/route.ts` - Attempt submission (deploys QuizAttempt contract)
- `/src/app/api/quizzes/[id]/reveal/route.ts` - Teacher reveal + payment distribution
- `/src/lib/payment-distribution.ts` - Payment contract creation (FLAWED)
- `/src/lib/payment-service.ts` - Database-only tracking (INCOMPLETE)

---

## Fund Flow Analysis

### Intended Flow (How It Should Work)

```
QUIZ CREATION:
Teacher Wallet ──(prizePool sats)──> Quiz Contract [_satoshis: prizePool]

STUDENT ATTEMPT:
Student Wallet ──(entryFee sats)──> QuizAttempt Contract [_satoshis: entryFee]

PRIZE DISTRIBUTION (after reveal):
Quiz Contract ──(Quiz.distributePrizes())──> Payment Contracts [_satoshis: prize]
                     │
                     └── Reduces Quiz._satoshis by distributed amount

ENTRY FEE COLLECTION:
QuizAttempt Contract ──(QuizAttempt.collectFee())──> Teacher Payment Contract
                     │
                     └── Reduces QuizAttempt._satoshis to dust (546)

CLAIMING:
Payment Contract ──(Payment.claim())──> Recipient Wallet
                     │
                     └── Reduces Payment._satoshis to dust (546)
```

### Actual Flow (CRITICAL BUG)

```
QUIZ CREATION: ✅ CORRECT
Teacher Wallet ──(prizePool sats)──> Quiz Contract [_satoshis: prizePool]

STUDENT ATTEMPT: ✅ CORRECT
Student Wallet ──(entryFee sats)──> QuizAttempt Contract [_satoshis: entryFee]

PRIZE DISTRIBUTION: ❌ BROKEN
Quiz Contract ──(Quiz.complete())──> ONLY updates status, funds stay locked!
Teacher Wallet ──(NEW satoshis)──> Payment Contracts [_satoshis: prize]
                     │
                     └── Teacher pays AGAIN from their wallet UTXOs!

ENTRY FEE COLLECTION: ❌ NOT IMPLEMENTED
QuizAttempt Contracts ──> Funds stay locked FOREVER
```

---

## Critical Issues

### 1. Prize Pool Never Released (CRITICAL)

**Location:** `src/lib/payment-distribution.ts:280-312`

**Problem:** The code calls `quizContract.complete(winners)` instead of `quizContract.distributePrizes(winners)`.

```javascript
// Current code (WRONG):
if (latestQuizContract.status === 'revealed') {
  latestQuizContract.complete(quiz.winners.map(w => ({
    student: w.attempt.student.publicKey,
    amount: w.prizeAmount.toString()
  })))
}
```

**Impact:**
- Quiz contract's `_satoshis` (prize pool) remains locked forever
- Payment contracts are funded from teacher's wallet UTXOs
- Teacher pays the prize pool TWICE

**Contract Method Comparison:**

| Method | What It Does |
|--------|--------------|
| `complete(winners)` | Only updates status and winners array. Does NOT transfer satoshis. |
| `distributePrizes(winners)` | Creates Payment contracts FROM Quiz contract's satoshis. Reduces `_satoshis`. |

### 2. Entry Fees Never Collected (CRITICAL)

**Location:** `src/lib/payment-distribution.ts:332-395`

**Problem:** `payEntryFeesToTeacher()` only CALCULATES amounts for display. It explicitly states:

```javascript
// Entry fees are locked in QuizAttempt contracts
// In a full implementation, we would create Payment contracts for the teacher
// For now, we track the amounts for display purposes
```

**Impact:**
- Entry fees remain locked in QuizAttempt contracts forever
- Teacher never receives entry fees
- Platform never receives platform fees

**Required Fix:** Call `QuizAttempt.collectFee()` for each attempt, which creates Payment contracts for teacher.

### 3. Payment Contract Source Mismatch

**Location:** `src/lib/payment-distribution.ts:63-107` vs `contracts/Payment.js`

**Problem:** The inline Payment contract source differs from the standalone file. While both work, this creates maintenance issues.

### 4. Double Payment by Teacher

**Current Reality:**
1. Teacher deposits `prizePool` sats when creating Quiz → funds locked in Quiz contract
2. When distributing prizes, Payment contracts are created using teacher's wallet UTXOs
3. Teacher ends up paying `prizePool × 2`

### 5. No Refund Mechanism Implementation

**Location:** `contracts/Quiz.js:234-248`

**Problem:** While `Quiz.triggerRefund()` exists, there's no API endpoint or service to:
- Detect when teacher reveal deadline passes
- Trigger refunds to students
- Release Quiz contract funds back to teacher

---

## What Works Correctly

| Feature | Status | Details |
|---------|--------|---------|
| Quiz Creation | ✅ Works | Deploys Quiz contract, locks prize pool on-chain |
| Attempt Submission | ✅ Works | Deploys QuizAttempt contract, locks entry fee on-chain |
| Commit-Reveal Scheme | ✅ Works | Answer hashing, encrypted storage, verification |
| Student Reveal | ✅ Works | Updates QuizAttempt contract state |
| Teacher Reveal | ✅ Works | Updates Quiz contract with correct answers |
| Score Calculation | ✅ Works | Correctly computes scores from revealed answers |
| Winner Determination | ✅ Works | Creates Winner records in database |
| Payment Contract Creation | ⚠️ Partial | Creates contracts, but with WRONG funding source |
| Payment Claiming | ⚠️ Untested | Code exists but flow is broken upstream |
| Entry Fee Collection | ❌ Missing | Not implemented |
| Refund Mechanism | ❌ Missing | Contract method exists, no implementation |

---

## Required Fixes for Production

### Fix 1: Use Quiz.distributePrizes() (HIGH PRIORITY)

Replace in `payment-distribution.ts`:

```javascript
// WRONG:
latestQuizContract.complete(winners)

// CORRECT:
const paymentRevs = await latestQuizContract.distributePrizes(winners)
```

This will:
- Create Payment contracts funded FROM the Quiz contract's satoshis
- Reduce Quiz contract's `_satoshis` by distributed amount
- Return Payment contract revisions for tracking

### Fix 2: Implement Entry Fee Collection (HIGH PRIORITY)

Create a new function to collect entry fees:

```javascript
async function collectEntryFees(quizId: string) {
  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId, status: { in: ['VERIFIED', 'FAILED'] } }
  })

  for (const attempt of attempts) {
    const attemptContract = await computer.sync(attempt.contractRev)
    const result = await attemptContract.collectFee(teacherPublicKey, 0.02)
    // result contains: { teacherPayment, teacherAmount, platformFeeAmount }
  }
}
```

### Fix 3: Implement Refund Mechanism (MEDIUM PRIORITY)

Create a scheduled job or API endpoint to:
1. Find quizzes past `teacherRevealDeadline` with status 'ACTIVE'
2. Call `Quiz.triggerRefund()` to mark as refunded
3. Create refund Payment contracts for students

### Fix 4: Remove Duplicate Payment Contract Source (LOW PRIORITY)

Either:
- Use `contracts/Payment.js` file with proper string import
- Or keep inline but ensure consistency

---

## Security Analysis

### Strengths

| Aspect | Implementation |
|--------|----------------|
| Answer Privacy | Commit-reveal scheme with SHA-256 hashing |
| Server-side Secret Storage | AES-256-GCM encrypted reveal data |
| Deadline Enforcement | API routes check deadlines before allowing actions |
| Ownership Verification | Contract `_owners` array enforces who can call methods |
| Custodial Wallet Security | Mnemonics encrypted with WALLET_ENCRYPTION_KEY |

### Vulnerabilities/Concerns

| Issue | Severity | Details |
|-------|----------|---------|
| Salt Exposure | Low | Salt returned to frontend after quiz creation (needed for reveal) |
| Timing Attacks | Low | Deadline checks use server time, could be manipulated |
| No Rate Limiting | Medium | No limits on quiz creation or attempt submission |
| Missing Input Validation | Low | Some edge cases not validated (e.g., extremely long strings) |

---

## Database vs Blockchain Consistency

### Current State

| Data | Database | Blockchain | In Sync? |
|------|----------|------------|----------|
| Quiz Status | Updated | Updated | ✅ Yes |
| Quiz Satoshis | Not tracked | Remains locked | ⚠️ N/A |
| Attempt Status | Updated | Updated | ✅ Yes |
| Winner Records | Created | N/A | ⚠️ DB Only |
| Payment Contracts | Revisions stored | Created | ✅ Yes |
| Earnings | Incremented | Not transferred | ❌ Mismatch |

The database shows winners as "paid" but funds are not actually transferred from the correct source.

---

## Recommendations

### Immediate Actions (Before Any Real Usage)

1. **Fix `distributePrizesToWinners()`** to use `Quiz.distributePrizes()` instead of `complete()`
2. **Test the fix** with real funds flow verification
3. **Add balance reconciliation** to verify blockchain state matches database

### Short-Term (Before Beta)

1. Implement entry fee collection via `QuizAttempt.collectFee()`
2. Add refund mechanism for expired quizzes
3. Create admin dashboard for fund flow monitoring
4. Add comprehensive logging for all fund movements

### Long-Term (Before Production)

1. Add rate limiting and abuse prevention
2. Implement proper error recovery and transaction retry
3. Add monitoring and alerting for stuck funds
4. Consider multi-signature for platform fee collection
5. Security audit by external team

---

## Conclusion

The Bitcoin Computer smart contracts are properly designed and would work correctly if called properly. The core issue is in the JavaScript service layer (`payment-distribution.ts`) which:

1. Uses the wrong Quiz contract method (`complete()` instead of `distributePrizes()`)
2. Creates Payment contracts with new funds instead of using locked contract funds
3. Does not implement entry fee collection

**Estimated Fix Effort:** 2-4 hours for critical fixes

**Risk if Deployed As-Is:**
- Teachers lose their prize pool (pay twice)
- Entry fees locked forever (students and teachers lose money)
- Platform receives no fees

---

*Analysis Date: 2026-01-14*
*Analyzed by: Claude Code*
