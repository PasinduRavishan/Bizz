# Fund Flow Issues Summary

## Answer: NO, the fund flow is NOT correct ❌

There are TWO critical issues with how funds move through the system:

---

## Issue 1: Teacher Pays Prize Money TWICE 🔴

### The Problem

**Phase 4: Prize Distribution** (test/complete-flow.test.js:970-1000)

1. **Step 1** (line 255): `distributePrizes()` reduces Quiz._satoshis: **50,000 → 546 sats**
   ```javascript
   this._satoshis = BigInt(546)  // Reduce to dust
   ```

2. **Step 2** (line 980-982): Teacher creates Payment contract with **49,454 sats from their wallet**
   ```javascript
   const { tx, effect } = await teacherComputer.encode({
     exp: `new Payment(..., BigInt(${prizePerWinner}), ...)`  // prizePerWinner = 49,454
   })
   ```

### What Happens:
- Quiz contract releases 49,454 sats (either back to teacher or lost)
- Teacher's wallet pays ANOTHER 49,454 sats to create Payment contract
- **Teacher pays prize money TWICE!**

### Evidence from Test Results:
- Teacher initial: 10,000,000 sats
- Teacher final: 9,731,250 sats
- Teacher change: **-268,750 sats**

### Expected Teacher Expenses:
- Quiz creation: -50,000 (prize) - 15,000 (gas) = -65,000
- Reveal: -10,000 (gas)
- Distribute: -10,000 (gas)
- **Total expected: ~-85,000 sats**

### Actual Teacher Expenses:
- **-268,750 sats** (more than 3x expected!)

### The Extra Cost:
- 268,750 - 85,000 = **183,750 extra sats lost**
- This includes:
  - Double prize payment: ~49,454 sats
  - Extra gas fees from multiple transactions
  - Entry fees NOT received (should be +15,000 but aren't)

---

## Issue 2: Winner Doesn't Receive Full Prize 🔴

### The Problem

**Phase 5: Winner Claims Prize** (test/complete-flow.test.js:1048-1094)

The `claim()` method (lines 160-167):
```javascript
claim() {
  if (this.status === 'claimed') {
    throw new Error('Payment already claimed')
  }
  this._satoshis = 546n  // Only reduces contract satoshis
  this.status = 'claimed'
  this.claimedAt = Date.now()
}
```

### What Should Happen:
- Payment contract reduces: 49,454 → 546 sats
- Difference (48,908 sats) should go to student wallet
- Student pays claim gas (~10,000 sats)
- **Student net gain: ~38,908 sats**

### What Actually Happens:
- Student 1 initial: 5,000,000 sats
- Student 1 after attempt: ~4,933,658 sats (-66,342 for entry + gas)
- Student 1 final: 4,943,010 sats
- **Student 1 total change: -56,990 sats**

### Calculation:
- If student paid 66,342 in Phase 2
- And ended with -56,990 total
- Then student received: -56,990 - (-66,342) = **+9,352 sats**

### Problem:
- Student should receive ~48,908 sats
- Student actually received ~9,352 sats
- **Missing: ~39,556 sats!**

### Likely Cause:
Bitcoin Computer's "cashOut pattern" (reducing `_satoshis` auto-sends difference to caller) may not be working in v0.26.0-beta.0, OR the funds are being sent but to the wrong address, OR additional gas costs are consuming the prize.

---

## Issue 3: Entry Fees Not Flowing to Teacher 🔴

### The Problem

Three students each paid 5,000 sats entry fee = **15,000 sats total** locked in QuizAttempt contracts.

### What Should Happen:
- Entry fees should flow to teacher (as payment for creating quiz)
- Teacher should receive +15,000 sats
- Or entry fees should contribute to prize pool

### What Actually Happens:
- Entry fees stay locked in QuizAttempt contracts forever
- Teacher never receives them
- They're effectively lost to the system

### Test Analysis Output (line -187):
```
- Entry fees: +14,700 sats (in contracts)
```

Note: It says "in contracts" - meaning teacher hasn't actually received them!

---

## Correct Fund Flow Should Be:

### Phase 1: Quiz Creation
✅ **Teacher wallet → Quiz contract**: 50,000 sats + gas
- Teacher: -50,000 (prize) - 15,000 (gas) = **-65,000 sats**
- Quiz contract: **+50,000 sats locked**

### Phase 2: Student Attempts (x3)
✅ **Student wallets → QuizAttempt contracts**: 5,000 sats each + gas
- Each student: -5,000 (entry) - 66,000 (gas) = **-71,000 sats**
- Each QuizAttempt contract: **+5,000 sats locked**
- **Total entry fees locked: 15,000 sats**

### Phase 3: Teacher Reveal
✅ **No fund movement**, only state mutation + gas
- Teacher: -10,000 (gas) = **-10,000 sats**
- Quiz contract: Still 50,000 sats (no change)

### Phase 4: Prize Distribution ❌ BROKEN

**Current (WRONG)**:
1. Quiz contract reduces: 50,000 → 546 sats (49,454 goes WHERE?)
2. Teacher creates Payment: -49,454 - 15,000 (gas) = **-64,454 sats**
3. Payment contract: **+49,454 sats locked**

**Problem**: Teacher pays prize twice!

**Should Be (Option A - Teacher Funds Prize)**:
1. Quiz contract stays at 50,000 sats (NO reduction)
2. Teacher creates Payment from wallet: -49,454 - 15,000 (gas) = **-64,454 sats**
3. Payment contract: **+49,454 sats locked**
4. Quiz contract remains at 50,000 sats (teacher can reclaim later)

**OR Should Be (Option B - Quiz Funds Prize)**:
1. Quiz contract reduces: 50,000 → 546 sats
2. Payment contract created FROM Quiz funds (not teacher wallet): **+49,454 sats locked**
3. Teacher pays NO additional money (only gas: -15,000 sats)

### Phase 5: Winner Claims Prize ❌ BROKEN

**Current (WRONG)**:
- Payment contract reduces: 49,454 → 546 sats
- Student receives: ???  (~9,352 sats based on test results)
- **Student missing ~39,556 sats!**

**Should Be**:
- Payment contract reduces: 49,454 → 546 sats
- Student receives: **+48,908 sats** (difference goes to student wallet)
- Student pays claim gas: -10,000 sats
- **Student net from claim: +38,908 sats**

### Final Balances (SHOULD BE):

**Teacher**:
- Quiz creation: -65,000 (prize + gas)
- Reveal: -10,000 (gas)
- Distribute: -15,000 (gas only, if using Option B)
- Receive entry fees: +15,000 (from QuizAttempts)
- **Net: -75,000 sats** (teacher loses prize + gas, gets entry fees)

**Student 1 (Winner)**:
- Attempt: -71,000 (entry + gas)
- Claim: +38,908 (prize - claim gas)
- **Net: -32,092 sats** (still loses, but wins more than losers)

**Students 2 & 3 (Losers)**:
- Attempt: -71,000 (entry + gas)
- **Net: -71,000 sats each**

**System Conservation**:
- Total in: 200,000 sats (initial sum of all wallets)
- Total out: Sum of finals + locked in contracts
- **Should balance** (satoshis conserved)

---

## Root Causes:

1. **Double Prize Payment**: Line 255 reduces Quiz satoshis, then line 980 creates Payment from teacher wallet = teacher pays twice

2. **cashOut Pattern Not Working**: Line 164 reduces Payment satoshis, but funds don't transfer to student = student doesn't receive prize

3. **Entry Fees Not Collected**: QuizAttempt contracts lock entry fees forever, teacher never receives them

---

## Recommendations:

### Fix 1: Choose Prize Funding Model

**Option A**: Remove line 255 - DON'T reduce Quiz satoshis
- Teacher funds Payment from their wallet (current code is correct for this)
- Quiz keeps 50,000 sats (teacher can reclaim later)

**Option B**: Remove Payment creation from teacher wallet
- Distribute Prize should create Payment FROM Quiz funds
- Teacher doesn't pay additional money
- Requires Bitcoin Computer support for delegated contract creation

### Fix 2: Fix claim() to Transfer Funds

Add logging to verify cashOut pattern works:
```javascript
claim() {
  const prizeAmount = this._satoshis - 546n
  console.log(`Claiming ${prizeAmount} sats to ${this.recipient}`)

  this._satoshis = 546n
  this.status = 'claimed'
  this.claimedAt = Date.now()

  // May need explicit transfer if cashOut doesn't work automatically
}
```

### Fix 3: Collect Entry Fees

Add method to Quiz contract to collect entry fees:
```javascript
collectEntryFees(attemptRev) {
  // Teacher can claim entry fees from QuizAttempt contracts
  // Transfer entry fee satoshis to teacher wallet
}
```

Or have entry fees automatically flow to teacher during attempt creation.
