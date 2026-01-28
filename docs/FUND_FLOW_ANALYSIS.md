# Fund Flow Analysis - Bitcoin Computer Quiz Platform

## Actual Test Results

From test output:
- **Teacher**: Started 10,000,000 → Ended 9,731,250 = **-268,750 sats**
- **Student 1 (Winner)**: Started 5,000,000 → Ended 4,943,010 = **-56,990 sats**
- **Student 2 (Loser)**: Started 5,000,000 → Ended 4,933,658 = **-66,342 sats**
- **Student 3 (Loser)**: Started 5,000,000 → Ended 4,933,658 = **-66,342 sats**

## Phase-by-Phase Fund Flow Analysis

### Phase 1: Quiz Creation (Teacher)

**Code**: test/complete-flow.test.js:481-493
```javascript
const { tx, effect } = await teacherComputer.encode({
  mod: quizModuleSpec,
  exp: `new Quiz(..., BigInt(${prizePool}), ...)`  // prizePool = 50,000
})
await teacherComputer.broadcast(tx)
quizContract = effect.res
```

**Expected Fund Movement**:
- Teacher wallet: **-50,000 sats** (prize pool) + **-~15,000 sats** (gas) = **-65,000 sats**
- Quiz contract UTXO: **+50,000 sats** (locked)

**Assertion**: Line 512 checks `teacherBalanceAfter < teacherBalanceBefore` ✅

**Issue**: None - funds correctly move from teacher wallet to Quiz contract

---

### Phase 2: Student Attempts (3 students)

**Code**: test/complete-flow.test.js:645-750 (repeated 3 times)
```javascript
const { tx, effect } = await student1Computer.encode({
  mod: attemptModuleSpec,
  exp: `new QuizAttempt(studentPubKey, quizId, commitment, BigInt(${entryFee}))`  // entryFee = 5,000
})
await student1Computer.broadcast(tx)
```

**Expected Fund Movement PER STUDENT**:
- Student wallet: **-5,000 sats** (entry fee) + **-~66,000 sats** (gas) = **-71,000 sats**
- QuizAttempt contract UTXO: **+5,000 sats** (locked)

**Actual Results**:
- Student 2: -66,342 sats (matches! -5,000 entry -61,342 gas)
- Student 3: -66,342 sats (matches!)
- Student 1: Should also be -66,342 at this point

**Issue**: Student 1 shows -56,990 total, but they also claimed prize (+funds), so this phase is CORRECT

---

### Phase 3: Teacher Reveal

**Code**: test/complete-flow.test.js:842-886
```javascript
const { tx } = await teacherComputer.encodeCall({
  target: syncedQuiz,
  property: 'revealAnswers',
  args: [correctAnswers, salt],
  mod: quizModuleSpec
})
await teacherComputer.broadcast(tx)
```

**Expected Fund Movement**:
- Teacher wallet: **-~10,000 sats** (gas only)
- Quiz contract: No change in satoshis (still 50,000), only state update

**Issue**: None - this is a state mutation, not fund transfer

---

### Phase 4: Prize Distribution

**Code**: test/complete-flow.test.js:970-1006

#### Step 4a: Mark Quiz Complete
```javascript
await syncedQuiz.distributePrizes()  // Instance method call
```

**Expected Fund Movement**:
- Teacher wallet: **-~10,000 sats** (gas)
- Quiz contract: **50,000 → 546 sats** (reduced to dust)

**Where did the 49,454 sats go?** 🚨 **CRITICAL QUESTION**

#### Step 4b: Create Payment Contract
```javascript
const { tx, effect } = await teacherComputer.encode({
  mod: quizModuleSpec,
  exp: `new Payment("${winner}", BigInt(${prizePerWinner}), "Quiz Prize", "${quizId}")`
})
```

**Expected Fund Movement**:
- Teacher wallet: **-49,454 sats** (prize) + **-~15,000 sats** (gas) = **-64,454 sats**
- Payment contract UTXO: **+49,454 sats** (locked)

**PROBLEM IDENTIFIED**: 🔴
- Quiz contract reduced satoshis: -49,454 sats
- Payment contract created from teacher wallet: -49,454 sats
- **Teacher pays prize TWICE!** Total: **-98,908 sats**

**What should happen**:
- Either: Quiz distributes funds directly (reduce Quiz, create Payment from those funds)
- Or: Teacher creates Payment separately (don't reduce Quiz satoshis)
- **Current code does BOTH** = double payment!

---

### Phase 5: Winner Claims Prize

**Code**: test/complete-flow.test.js:1048-1094
```javascript
const { tx } = await student1Computer.encodeCall({
  target: paymentContract,
  property: 'claim',
  args: [],
  mod: quizModuleSpec
})
await student1Computer.broadcast(tx)
```

**Payment.claim() method** (lines 160-167):
```javascript
claim() {
  if (this.status === 'claimed') {
    throw new Error('Payment already claimed')
  }
  this._satoshis = 546n  // Reduce to dust
  this.status = 'claimed'
  this.claimedAt = Date.now()
}
```

**Expected Fund Movement**:
- Student wallet: **+48,908 sats** (49,454 - 546 dust) + **-~10,000 sats** (gas) = **+38,908 sats**
- Payment contract: **49,454 → 546 sats**

**Test Assertion**: Line 1093 checks `student1BalanceAfter > student1BalanceBefore` ✅

**Actual Student 1 net**: -56,990 sats
- Paid in Phase 2: -66,342 (entry + gas)
- Received in Phase 5: Should be +~38,908
- Net: -66,342 + 38,908 = **-27,434 sats**

**But actual is -56,990!** This means Student 1 received less than expected.

**Calculation check**:
- If net is -56,990 and paid -66,342
- Then received: -56,990 - (-66,342) = +9,352 sats
- **Student only received ~9,352 sats instead of 48,908!**

**PROBLEM**: Bitcoin Computer's cashOut pattern may not be working correctly! 🔴

---

## Summary of Issues

### Issue 1: Teacher Pays Prize Money TWICE ❌

**Location**: Phase 4 - Prize Distribution

**Problem**:
1. `distributePrizes()` reduces Quiz._satoshis from 50,000 to 546 (-49,454 sats)
2. Teacher then creates Payment contract with 49,454 sats from their wallet
3. **Teacher effectively pays 49,454 × 2 = 98,908 sats**

**What happens to Quiz funds**:
- When Quiz._satoshis reduces from 50,000 to 546, where do the 49,454 sats go?
- Bitcoin Computer should send them somewhere (change output)
- They likely go back to teacher wallet as change
- But then teacher immediately spends 49,454 again to create Payment
- **Net result: Teacher pays gas twice, funds go: Teacher → Quiz → Teacher → Payment**

**Expected teacher expenses**:
- Quiz creation: -50,000 (prize) - 15,000 (gas) = -65,000
- Reveal: -10,000 (gas)
- Distribute: -10,000 (gas)
- Payment creation: -49,454 (prize) - 15,000 (gas) = -64,454
- **Total: -154,454 sats**

**Actual teacher expenses**: -268,750 sats
- Difference: 268,750 - 154,454 = **114,296 extra sats lost!**

**Likely cause**: Additional gas fees from multiple transactions + double prize payment issue

### Issue 2: Winner Doesn't Receive Full Prize ❌

**Location**: Phase 5 - Winner Claims Prize

**Problem**:
- Student 1 should receive ~48,908 sats (49,454 - 546 dust)
- Actually received only ~9,352 sats
- **Missing: 39,556 sats!**

**Possible causes**:
1. Bitcoin Computer's cashOut pattern doesn't auto-transfer funds
2. claim() method needs explicit fund transfer code
3. Payment contract satoshis reduction doesn't create payment output

---

## Recommendations

### Fix 1: Remove Double Prize Payment

**Option A**: Don't reduce Quiz satoshis in distributePrizes()
```javascript
distributePrizes() {
  if (this.status !== 'revealed') {
    throw new Error('Quiz must be revealed first')
  }
  // DON'T reduce _satoshis - leave prize in Quiz contract
  // this._satoshis = BigInt(546)  // REMOVE THIS LINE
  this.status = 'completed'
}
```
Then teacher creates Payment from their wallet (current behavior).

**Option B**: Use Quiz funds to create Payment
```javascript
distributePrizes() {
  // Reduce Quiz satoshis and use those funds to create Payment
  this._satoshis = BigInt(546)
  this.status = 'completed'

  // Payment should be created FROM the Quiz contract's funds
  // (Requires Bitcoin Computer to support fund delegation)
}
```

**Option C**: Teacher doesn't create Payment separately
- After distributePrizes() reduces Quiz satoshis, funds automatically go to teacher
- Teacher then manually creates Payment contract in a separate transaction
- Document that prize distribution is 2-step process

### Fix 2: Ensure claim() Transfers Funds

**Verify Bitcoin Computer cashOut pattern**:
- Check if reducing `_satoshis` automatically sends difference to caller
- May need explicit `send()` or `transfer()` method call

**Test logging**:
```javascript
const balanceBefore = await student1Computer.getBalance()
await paymentContract.claim()
await sleep(3000)
const balanceAfter = await student1Computer.getBalance()

console.log('Balance change:', balanceAfter - balanceBefore)
console.log('Expected:', 48,908 - claimGas)
```

---

## Correct Fund Flow Should Be:

### Teacher Total:
- Quiz creation: -50,000 (prize) - 15,000 (gas)
- Reveal: -10,000 (gas)
- Distribute: -10,000 (gas)
- **NO second prize payment**
- Collect entry fees: +15,000 (3 × 5,000)
- **Net: -70,000 sats** (pays prize + gas, gets entry fees)

### Student 1 (Winner):
- Attempt: -5,000 (entry) - 66,000 (gas)
- Claim: +49,000 (prize after gas)
- **Net: -22,000 sats** (loses entry fee + gas, wins prize)

### Students 2 & 3 (Losers):
- Attempt: -5,000 (entry) - 66,000 (gas)
- **Net: -71,000 sats each**

**System Total**: Should be conservative (satoshis don't disappear)
- Sum of all changes + locked in contracts = 0
