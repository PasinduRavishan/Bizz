# Bitcoin Computer Quiz Platform - Test Suite

## 📋 Overview

Comprehensive integration test suite for the Bitcoin Computer Quiz Platform that tests the **entire production user flow** from quiz creation to prize claiming, with detailed balance tracking and fund flow verification.

## 🎯 What This Test Suite Covers

### ✅ Complete User Flow Tests

1. **Quiz Creation (Teacher)**
   - Deploy Quiz contract with prize pool
   - Verify funds are locked on blockchain
   - Test validation (minimum amounts, deadlines, etc.)

2. **Student Attempts**
   - Multiple students submit attempts with entry fees
   - Commit-reveal scheme implementation
   - Entry fees locked in QuizAttempt contracts

3. **Teacher Reveal & Auto-Scoring**
   - Teacher reveals correct answers after deadline
   - Automatic scoring of all attempts
   - Pass/fail determination based on threshold

4. **Prize Distribution**
   - Creation of Payment contracts for winners
   - Fund transfer from Quiz contract to Payment contracts
   - Proper satoshi management (dust limits)

5. **Winner Claims Prize**
   - Winners claim Payment contracts
   - Funds released to winner wallets
   - Prevention of double-claiming

### ✅ Success Scenarios

- Quiz with valid parameters
- Multiple student attempts (100%, 66%, 0% scores)
- Single winner receives full prize
- Proper fund flow from start to finish

### ✅ Failure Scenarios

- Prize pool below minimum (< 10,000 sats)
- Entry fee below minimum (< 5,000 sats)
- Invalid pass threshold (> 100%)
- Non-teacher attempting to reveal
- Attempting to distribute before reveal
- Double-claim prevention

### ✅ Balance & Fund Flow Tracking

- **Detailed balance tracking** for all participants
- **Before/After comparisons** for each phase
- **Net profit/loss calculations** for teacher and students
- **Gas fee analysis**
- **Platform fee calculations** (2%)

## 🚀 Running the Tests

### Prerequisites

1. **Bitcoin Computer Regtest Node**
   - Ensure you have access to a regtest node
   - Default: `https://rltc.node.bitcoincomputer.io`

2. **Environment Variables**
   - Copy `.env.example` to `.env.local`
   - Set `NEXT_PUBLIC_BITCOIN_COMPUTER_URL`
   - Set `NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK=regtest`

### Run Complete Test Suite

```bash
# Run all tests
npm test

# Run complete flow test only
npm run test:flow

# Run tests in watch mode (for development)
npm run test:watch
```

## 📊 Test Output Example

```
🎓 BITCOIN COMPUTER QUIZ PLATFORM - COMPLETE FLOW TESTS

  🚀 INITIALIZING TEST ENVIRONMENT
  ════════════════════════════════════════
    📡 Creating Bitcoin Computer instances...
      ✅ Teacher wallet: LTC_ADDRESS_123...
      ✅ Student 1 wallet: LTC_ADDRESS_456...
      ✅ Student 2 wallet: LTC_ADDRESS_789...
      ✅ Student 3 wallet: LTC_ADDRESS_ABC...

    💰 Funding wallets from faucet...
      ✅ Teacher funded: 10,000,000 sats
      ✅ Student 1 funded: 5,000,000 sats
      ✅ Student 2 funded: 5,000,000 sats
      ✅ Student 3 funded: 5,000,000 sats

  📚 Phase 1: Quiz Creation (Teacher)
    ✓ should successfully create a quiz with valid parameters (5234ms)
    ✓ should verify quiz contract is correctly stored on blockchain (1234ms)

  ❌ Phase 1: Quiz Creation - Failure Cases
    ✓ should reject quiz with prize pool below minimum (2341ms)
    ✓ should reject quiz with entry fee below minimum (2156ms)
    ✓ should reject quiz with invalid pass threshold (2087ms)

  👨‍🎓 Phase 2: Student Attempts
    ✓ should allow Student 1 to submit attempt with correct answers (4523ms)
    ✓ should allow Student 2 to submit attempt with partial correct answers (4189ms)
    ✓ should allow Student 3 to submit attempt with mostly incorrect answers (4312ms)
    ✓ should verify all entry fees are locked in QuizAttempt contracts (1456ms)

  ❌ Phase 2: Student Attempts - Failure Cases
    ✓ should reject attempt with entry fee below minimum (2234ms)
    ✓ should reject attempt with empty commitment (2156ms)

  🔓 Phase 3: Teacher Reveal & Auto-Scoring
    ✓ should allow teacher to reveal answers after deadline (3456ms)
    ✓ should correctly score Student 1 (100% - PASS) (234ms)
    ✓ should correctly score Student 2 (66% - FAIL) (189ms)
    ✓ should correctly score Student 3 (0% - FAIL) (201ms)

  💰 Phase 4: Prize Distribution
    ✓ should distribute prizes to winner (Student 1 only) (6789ms)
    ✓ should verify Payment contract holds correct prize amount (1234ms)
    ✓ should verify fund flow is correct (567ms)

  🎁 Phase 5: Winner Claims Prize
    ✓ should allow Student 1 to claim their prize (4523ms)
    ✓ should prevent double-claiming (2341ms)

  📊 Final Balance & Fund Flow Verification
    ✓ should display complete fund flow summary (2345ms)

  🔬 Edge Cases & Error Scenarios
    ✓ should reject reveal from non-teacher (3456ms)
    ✓ should reject distributePrizes before reveal (3289ms)

  🎉 ALL TESTS COMPLETED SUCCESSFULLY
  ════════════════════════════════════════
    ✅ Verified:
      • Quiz creation with fund locking
      • Student attempts with commit-reveal
      • Teacher reveal & auto-scoring
      • Prize distribution via Payment contracts
      • Winner prize claiming
      • Fund flow tracking
      • Error handling & edge cases

  24 passing (89s)
```

## 🔍 Detailed Fund Flow Tracking

The test suite provides detailed balance tracking:

```
💰 COMPLETE FUND FLOW SUMMARY
════════════════════════════════════════

📊 TEACHER:
  Teacher Balance:
    Before: 10,000,000 sats
    After:  9,947,000 sats
    Change: -53,000 sats

  Analysis:
    - Paid prize pool: -50,000 sats
    - Gas costs: ~3,000 sats
    - Entry fees: +14,700 sats (in contracts)

📊 STUDENT 1 (WINNER):
  Student 1 Balance:
    Before: 5,000,000 sats
    After:  5,043,000 sats
    Change: +43,000 sats

  Analysis:
    - Paid entry fee: -5,000 sats
    - Won prize: +49,454 sats
    - Net profit: +43,000 sats (after gas)

📊 STUDENT 2 (FAILED):
  Student 2 Balance:
    Before: 5,000,000 sats
    After:  4,993,000 sats
    Change: -7,000 sats

  Analysis:
    - Paid entry fee: -5,000 sats
    - Won nothing
    - Net loss: -7,000 sats

📊 STUDENT 3 (FAILED):
  Student 3 Balance:
    Before: 5,000,000 sats
    After:  4,993,000 sats
    Change: -7,000 sats

  Analysis:
    - Paid entry fee: -5,000 sats
    - Won nothing
    - Net loss: -7,000 sats
```

## 🏗️ Test Architecture

### Contract Sources

The test suite uses **production contract code** embedded in the test file:

- **Quiz Contract** (with Payment class co-located)
- **QuizAttempt Contract**

### Helper Functions

- `hashAnswer()` - Production answer hashing algorithm
- `hashCommitment()` - Production commitment hashing
- `calculateScore()` - Production scoring logic
- `didPass()` - Production pass/fail determination
- `withRetry()` - Mempool conflict handling with exponential backoff

### Test Data

```javascript
const correctAnswers = ["Paris", "4", "Blue"]
const prizePool = 50000n // 50,000 satoshis
const entryFee = 5000n   // 5,000 satoshis
const passThreshold = 70  // 70%

// Student Answers:
Student 1: ["Paris", "4", "Blue"]  → 100% → PASS ✅
Student 2: ["Paris", "4", "Red"]   → 66%  → FAIL ❌
Student 3: ["London", "5", "Green"] → 0%   → FAIL ❌
```

## 🔐 Bitcoin Computer Integration

### Key Patterns Tested

1. **deploy() + encode() + broadcast()**
   ```javascript
   const moduleSpec = await computer.deploy(ContractSource)
   const { tx, effect } = await computer.encode({
     mod: moduleSpec,
     exp: 'new Quiz(...)'
   })
   await computer.broadcast(tx)
   ```

2. **Contract Method Calls via encode()**
   ```javascript
   const { tx } = await computer.encode({
     exp: `${contractRev}.revealAnswers(${JSON.stringify(answers)}, "${salt}")`,
     env: { [contractRev]: contract }
   })
   await computer.broadcast(tx)
   ```

3. **Nested Contract Creation**
   ```javascript
   // Quiz.distributePrizes() creates Payment contracts
   // Payment class MUST be in same module as Quiz
   const { tx, effect } = await computer.encode({
     exp: `${quizRev}.distributePrizes(${JSON.stringify(winners)})`,
     env: { [quizRev]: quizContract }
   })
   const paymentRevs = effect.res // Array of Payment revisions
   ```

### Mempool Conflict Handling

Tests include **exponential backoff retry logic** for mempool conflicts:

```javascript
async function withRetry(operation, operationName, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (error.message.includes('txn-mempool-conflict')) {
        const delayMs = 3000 * Math.pow(2, attempt - 1)
        await sleep(delayMs)
        continue
      }
      throw error
    }
  }
}
```

## 📈 Test Coverage

### Contracts Tested

- ✅ Quiz contract creation and state management
- ✅ QuizAttempt contract creation and commit-reveal
- ✅ Payment contract creation and claiming
- ✅ All contract method calls (reveal, distribute, claim)
- ✅ Contract state synchronization

### Bitcoin Computer Features Tested

- ✅ Module deployment
- ✅ Contract instantiation via encode/broadcast
- ✅ Nested contract creation
- ✅ Contract state mutations
- ✅ Contract synchronization (sync())
- ✅ Satoshi management (_satoshis)
- ✅ Ownership management (_owners)

### Economic Scenarios Tested

- ✅ Prize pool locking
- ✅ Entry fee locking
- ✅ Platform fee calculation (2%)
- ✅ Prize distribution (equal split)
- ✅ Payment claiming (fund release)
- ✅ Gas fee impact on balances

### Security Features Tested

- ✅ Commit-reveal scheme implementation
- ✅ Commitment verification
- ✅ Answer hash verification
- ✅ Authorization checks (only teacher can reveal)
- ✅ Double-claim prevention
- ✅ Status state machine enforcement

## 🛠️ Development

### Adding New Tests

1. Create new test file in `test/` directory
2. Follow the existing structure
3. Use helper functions from the main test file
4. Run with `npm test`

### Debugging Tests

```bash
# Run specific test file
mocha test/complete-flow.test.js

# Run with increased timeout
mocha --timeout 600000 test/complete-flow.test.js

# Run tests matching pattern
mocha --grep "Prize Distribution" test/**/*.test.js
```

### Test Timeouts

- Default timeout: **5 minutes per test**
- Blockchain operations can be slow on regtest
- Adjust timeout in `.mocharc.json` if needed

## 📚 References

- [Bitcoin Computer Documentation](https://docs.bitcoincomputer.io/)
- [Mocha Test Framework](https://mochajs.org/)
- [Chai Assertion Library](https://www.chaijs.com/)

## 🎯 Success Criteria

All tests should **pass** with:
- ✅ All contracts deployed successfully
- ✅ All transactions confirmed on blockchain
- ✅ Correct balance changes for all participants
- ✅ Proper fund flow from teacher → quiz → winners
- ✅ All error cases properly rejected
- ✅ No exceptions or unhandled errors

## 🚨 Known Issues

1. **Mempool Conflicts**: Tests include retry logic to handle blockchain mempool issues
2. **Slow Regtest**: Blockchain operations can be slow; timeouts are generous
3. **Balance Fluctuations**: Gas fees vary, so exact balance predictions use ranges

## ✅ Production Readiness

These tests verify that the Bitcoin Computer Quiz Platform is **production-ready** by testing:

- Real blockchain transactions (regtest)
- Actual fund locking and transfers
- Production contract code
- Complete user flow from start to finish
- Error handling and edge cases
- Balance tracking and verification

**All tests passing = Production-ready platform! 🚀**
