# Deferred Payment Model Design

## Overview

Students don't pay entry fees upfront. Instead, they pay AFTER grading:
- **Winners**: Pay entry fee when claiming prize (can be deducted from prize)
- **Failed students**: Pay entry fee as penalty

This eliminates the UTXO ownership transfer problem and creates better UX.

## Flow Comparison

### OLD FLOW (Failed - UTXO Issues)
```
1. Quiz Creation:
   - Teacher: new Quiz(_satoshis: 546, prizePool: metadata)

2. Student Attempt:
   - Student: new QuizAttempt(_satoshis: 5000, entryFee: metadata)  ❌ Problem!

3. After Grading:
   - Teacher tries to collect entry fees via ownership transfer  ❌ Fails!

4. Distribution:
   - Teacher: new Payment(winner, prizeAmount)
   - Winner claims via cashOut()
```

### NEW FLOW (Deferred Payment - Solves All Issues)
```
1. Quiz Creation:
   - Teacher: new Quiz(_satoshis: 546, prizePool: metadata)
   - Cost: ~2,000 sats gas only

2. Student Attempt:
   - Student: new QuizAttempt(_satoshis: 546)  ✅ Dust only!
   - Cost: ~1,500 sats gas only
   - Entry fee NOT paid yet

3. After Grading (Winners):
   - Teacher: Creates Payment offer (prize minus entry fee)
   - Student: Creates Payment with entry fee
   - Atomic swap: Student gets prize Payment, Teacher gets entry fee Payment
   - Net: Student receives (prize - entry fee)

4. After Grading (Failed Students):
   - Student: new Payment(teacher, entryFee, "Penalty")
   - Cost: entry fee + gas
   - This prevents spam attempts
```

## Contract Changes Required

### QuizAttempt Contract

**Remove:**
- `entryFee` parameter from constructor
- `transferOwnershipToTeacher()` method
- `claimEntryFee()` method
- `collectFee()` method

**Keep:**
- Dust-only UTXO (_satoshis: 546)
- Commitment, reveal, verify methods
- Refund methods (for abandoned quizzes)

**Add:**
- `requiresEntryFee` boolean flag (set after grading)
- Entry fee amount stored as metadata (from Quiz contract)

### New PrizeSwap Contract

Based on Bitcoin Computer Sale pattern:

```javascript
export class PrizeSwap extends Contract {
  static exec(prizePayment, entryFeePayment, attempt) {
    const [student] = attempt._owners
    const [teacher] = prizePayment._owners

    // Verify student is claiming their own attempt
    if (entryFeePayment._owners[0] !== student) {
      throw new Error('Entry fee must be from student')
    }

    // Verify entry fee amount
    if (entryFeePayment._satoshis < attempt.entryFeeRequired) {
      throw new Error('Insufficient entry fee')
    }

    // Swap owners
    prizePayment._owners = [student]
    entryFeePayment._owners = [teacher]

    // Mark attempt as claimed
    attempt.status = 'prize_claimed'
    attempt.claimedAt = Date.now()

    return [prizePayment, entryFeePayment, attempt]
  }
}
```

## Updated Test Flow

### Phase 1: Quiz Creation (Unchanged)
```javascript
const quiz = await teacherComputer.new(Quiz, [
  teacherPubKey,
  questionHashIPFS,
  answerHashes,
  entryFee,      // Stored as metadata
  prizePool,     // Stored as metadata
  passThreshold,
  deadline
])
// Teacher pays: ~2,000 sats gas
// Quiz holds: 546 sats dust
```

### Phase 2: Student Attempts (CHANGED - No Entry Fee)
```javascript
const attempt = await studentComputer.new(QuizAttempt, [
  studentPubKey,
  quizRef,
  answerCommitment
])
// Student pays: ~1,500 sats gas only
// Attempt holds: 546 sats dust
// Entry fee NOT paid yet! ✅
```

### Phase 3: Teacher Reveal & Grading (Unchanged)
```javascript
await quiz.reveal(correctAnswers, salt)
await quiz.scoreAttempts([
  { attemptId, answers, nonce, passed: true }  // Student 1
  { attemptId, answers, nonce, passed: false } // Student 2
])
```

### Phase 4: Prize Distribution (CHANGED - Create Offers)
```javascript
// Teacher creates prize Payment offers (prize minus entry fee)
for (const winner of winners) {
  const netPrize = prizeAmount - entryFee
  const prizeOffer = await teacherComputer.new(Payment, [
    winner.studentPubKey,
    netPrize,
    'Quiz Prize (net of entry fee)',
    attemptId
  ])
  // Teacher pays: netPrize + gas
}
```

### Phase 5: Winner Claims Prize (CHANGED - Atomic Swap)
```javascript
// Student creates entry fee payment
const entryFeePayment = await studentComputer.new(Payment, [
  teacherPubKey,
  entryFee,
  'Entry Fee',
  attemptId
])

// Execute atomic swap using PrizeSwap
const result = await studentComputer.new(PrizeSwap.exec, [
  prizeOffer,
  entryFeePayment,
  attempt
])

// Student now owns prizePayment
// Teacher now owns entryFeePayment
// Attempt marked as claimed
```

### Phase 6: Failed Students Pay Penalty (NEW)
```javascript
// Failed students must pay entry fee
const penaltyPayment = await failedStudentComputer.new(Payment, [
  teacherPubKey,
  entryFee,
  'Entry Fee Penalty',
  attemptId
])

// Mark attempt as penalty_paid
await attempt.payPenalty(penaltyPayment._id)
```

## Economics

### For Teacher

**Per Quiz:**
- Quiz creation gas: ~2,000 sats
- Reveal gas: ~1,500 sats
- Prize distribution (3 winners): 3 × (netPrize + gas)
  - Example: 3 × (45,000 + 1,000) = 138,000 sats
- Entry fees collected: 3 × 5,000 = 15,000 sats
- **Net cost**: ~125,000 sats for a 150,000 sats prize pool

**Much better than current**: No locked entry fees, cleaner flow

### For Student (Winner)

**Cost breakdown:**
- Attempt gas: ~1,500 sats
- Entry fee: 5,000 sats
- Prize claim gas: ~1,000 sats
- **Total cost**: ~7,500 sats

**Prize received**: 45,000 sats (net)
**Net profit**: ~37,500 sats

### For Student (Failed)

**Cost breakdown:**
- Attempt gas: ~1,500 sats
- Entry fee penalty: 5,000 sats
- Payment gas: ~1,000 sats
- **Total loss**: ~7,500 sats

## Benefits

### ✅ Solves UTXO Ownership Problem
- No need to transfer QuizAttempt ownership
- No need to modify _satoshis in QuizAttempt
- Clean Payment contract pattern throughout

### ✅ Better User Experience
- Students don't pay upfront
- Only pay if they want to proceed after seeing results
- Winners can see net prize before claiming

### ✅ Anti-Spam Protection Maintained
- Failed students still must pay entry fee
- Can't just spam attempts without consequence
- Teacher receives entry fees from all participants

### ✅ Simpler Contract Code
- Remove complex ownership transfer logic
- Remove collectFee() complexity
- Use proven Sale/Swap pattern from Bitcoin Computer

### ✅ Atomic Swaps
- Prize claim is atomic (can't fail midway)
- Either both payments swap or neither does
- No partial state issues

## Implementation Priority

1. ✅ Study Bitcoin Computer Sale pattern (DONE)
2. Update QuizAttempt contract (remove entry fee logic)
3. Create PrizeSwap contract
4. Update Quiz contract (add scoreAttempts method)
5. Update test flow
6. Verify all economics match

## Open Questions

1. **Grace period for failed students?**
   - Should they have 7 days to pay penalty?
   - Or must pay immediately to avoid locked attempt?

2. **Partial payments allowed?**
   - Can student pay less than full entry fee?
   - Or enforce exact amount?

3. **Refund handling?**
   - If quiz abandoned, students haven't paid yet
   - So no refund needed! ✅ Simpler!

4. **Entry fee collection from failures?**
   - Should be enforced via UI
   - But blockchain doesn't force it
   - Accept that some may not pay? Or lock attempt until paid?
