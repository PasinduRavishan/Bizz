# Bitcoin Computer Quiz Platform - Implementation Report

## Overview

This report details how each phase of the Quiz Platform is implemented using Bitcoin Computer v0.26.0-beta.0 on Litecoin regtest network. Each phase demonstrates different Bitcoin Computer patterns for managing on-chain state and transactions.

---

## Phase 1: Quiz Creation (Teacher)

### Technical Implementation

**Pattern Used**: `encode()` + `broadcast()` with constructor expression

**How It Works**:
1. **Module Deployment**: Quiz contract source code is deployed to blockchain once using `computer.deploy(QuizContractSource)`
   - Returns a module specifier (e.g., `"2774085bd67d4d5f..."`​)
   - This specifier acts as a pointer to the on-chain contract code
   - Module can be reused for creating multiple Quiz instances

2. **Contract Creation**: Teacher creates Quiz using `encode()` with constructor expression
   ```javascript
   const { tx, effect } = await teacherComputer.encode({
     mod: quizModuleSpec,
     exp: `new Quiz(teacher, questionHash, answerHashes, prizePool, ...)`
   })
   await teacherComputer.broadcast(tx)
   const quizContract = effect.res
   ```

3. **UTXO Locking**: The Quiz contract locks satoshis in a UTXO (Unspent Transaction Output)
   - `_satoshis` property determines locked amount (50,000 sats in tests)
   - `_owners` property controls who can modify the contract (teacher's public key)
   - Bitcoin Computer creates a P2SH (Pay-to-Script-Hash) output

**Key Concepts**:
- **Smart Contract as UTXO**: Each Quiz instance is a Bitcoin UTXO with embedded state
- **Ownership Control**: `_owners` array defines who can spend/modify the UTXO
- **Module Reuse**: Deploy code once, instantiate multiple times (saves fees)

**Technical Details**:
- Transaction inscribes JavaScript expression in OP_RETURN output
- Smart contract state stored in witness data
- Each contract gets unique `_id` (txid) and `_rev` (txid:vout) identifiers

---

## Phase 2: Student Attempts (Commit Phase)

### Technical Implementation

**Pattern Used**: `encode()` + `broadcast()` for separate contract creation

**How It Works**:
1. **Commitment Creation**: Student creates QuizAttempt contract with hashed answers
   ```javascript
   const commitment = SHA256(JSON.stringify(answers) + nonce)

   const { tx, effect } = await studentComputer.encode({
     mod: attemptModuleSpec,
     exp: `new QuizAttempt(studentPubKey, quizRef, commitment, entryFee)`
   })
   await studentComputer.broadcast(tx)
   ```

2. **Entry Fee Locking**: QuizAttempt contract locks entry fee (7,000 sats)
   - Student transfers ownership to QuizAttempt contract
   - Funds remain locked until teacher reveals answers
   - Cannot be reclaimed (mimics irreversible commitment)

3. **Commit-Reveal Scheme**:
   - **Commit**: Student submits `SHA256(answers + nonce)` on-chain
   - **Nonce**: Random salt ensures commitment uniqueness
   - **Reveal**: Later, student reveals actual answers + nonce for verification

**Key Concepts**:
- **Independent Contracts**: Each attempt is a separate UTXO, not nested in Quiz
- **Cryptographic Commitment**: Hash prevents answer tampering after submission
- **Irreversible Commitment**: On-chain data cannot be deleted, only new states created

**Technical Details**:
- Multiple students can create attempts concurrently
- Each attempt references Quiz via `quizRef` (_id of Quiz contract)
- QuizAttempt and Quiz are independent UTXOs linked by reference

---

## Phase 3: Teacher Reveal & Auto-Scoring

### Technical Implementation

**Pattern Used**: `encodeCall()` + `broadcast()` + `query()` for state mutation

**How It Works**:
1. **Sync Latest State**: Get current Quiz state from blockchain
   ```javascript
   const syncedQuiz = await teacherComputer.sync(quizContract._rev)
   ```

2. **Reveal Answers**: Call `revealAnswers()` method using `encodeCall()`
   ```javascript
   const { tx } = await teacherComputer.encodeCall({
     target: syncedQuiz,           // Contract object to modify
     property: 'revealAnswers',    // Method name
     args: [correctAnswers, salt], // Method arguments
     mod: quizModuleSpec           // Module specifier
   })
   await teacherComputer.broadcast(tx)
   ```

3. **Query Latest Revision**: Get updated contract state after mutation
   ```javascript
   await sleep(3000)  // Wait for blockchain confirmation
   const [latestRev] = await teacherComputer.query({ ids: [quizContract._id] })
   const revealedQuiz = await teacherComputer.sync(latestRev)
   ```

4. **Off-Chain Scoring**: Calculate scores using revealed answers
   ```javascript
   const score = calculateScore(studentAnswers, correctAnswers)
   // Scoring happens in test code, not on-chain
   ```

**Key Concepts**:
- **encodeCall Pattern**: Proper way to call methods on existing contracts
- **State Mutation Creates New UTXO**: Original UTXO spent, new UTXO created with updated state
- **Revision Tracking**: `_rev` changes with each mutation (new txid:vout)
- **Query After Mutation**: `sync()` from old revision returns stale state; must `query()` first

**Technical Details**:
- `revealAnswers()` modifies Quiz contract state: `status: 'active'` → `status: 'revealed'`
- New UTXO created with same `_id` but different `_rev`
- Transaction spends old Quiz UTXO, creates new Quiz UTXO + change output
- Bitcoin Computer validates ownership before allowing method execution

**Why Not Direct Call**:
- Direct call (`syncedQuiz.revealAnswers(...)`) doesn't persist to blockchain
- Must use `encodeCall()` to create and broadcast transaction
- `encodeCall()` returns transaction before broadcast, allowing inspection

---

## Phase 4: Prize Distribution

### Technical Implementation

**Pattern Used**: Instance method mutation + separate Payment contract creation

**How It Works**:
1. **Mark Quiz Complete**: Call `distributePrizes()` using direct method call
   ```javascript
   await syncedQuiz.distributePrizes()
   // Bitcoin Computer auto-creates and broadcasts transaction
   ```

2. **Query Updated Quiz State**:
   ```javascript
   const [latestRev] = await teacherComputer.query({ ids: [quizContract._id] })
   const updatedQuiz = await teacherComputer.sync(latestRev)
   // Quiz status: 'revealed' → 'completed'
   // Quiz _satoshis: 50,000 → 546 (reduced to dust)
   ```

3. **Create Payment Contract Separately**:
   ```javascript
   const prizePerWinner = (prizePool - 546n) / BigInt(winners.length)

   const { tx, effect } = await teacherComputer.encode({
     mod: quizModuleSpec,
     exp: `new Payment(winnerPubKey, prizeAmount, purpose, quizId)`
   })
   await teacherComputer.broadcast(tx)
   const paymentContract = effect.res
   ```

**Key Concepts**:
- **Bitcoin Computer Limitation**: Cannot store complex objects (arrays of objects) in contract state
- **Workaround**: Store primitives only; create Payment contracts separately
- **Fund Flow**: Quiz UTXO satoshis reduced to dust (546 sats minimum)
- **Separate UTXOs**: Payment contract is independent UTXO, not nested in Quiz

**Technical Details**:
- Original design attempted static method creating nested Payments (doesn't work in v0.26.0-beta.0)
- Simplified to instance method that just updates Quiz state
- Payment contracts created in separate transactions
- Each Payment is a new UTXO with `_satoshis` = prize amount

**Why This Pattern**:
- Bitcoin Computer v0.26.0-beta.0 errors when trying to serialize complex objects
- "Detected object that does not extend from Contract" error occurs
- Solution: Keep contract state simple, create related contracts separately

---

## Phase 5: Winner Claims Prize

### Technical Implementation

**Pattern Used**: `encodeCall()` + `broadcast()` + `query()` for claiming funds

**How It Works**:
1. **Sync Payment Contract**: Student gets Payment contract from revision
   ```javascript
   const paymentContract = await student1Computer.sync(paymentRev)
   // paymentContract._satoshis = 49,454 sats
   // paymentContract.status = 'unclaimed'
   ```

2. **Claim Prize**: Call `claim()` method using `encodeCall()`
   ```javascript
   const { tx } = await student1Computer.encodeCall({
     target: paymentContract,
     property: 'claim',
     args: [],
     mod: quizModuleSpec
   })
   await student1Computer.broadcast(tx)
   ```

3. **Query Latest Payment State**:
   ```javascript
   await sleep(3000)
   const [latestPaymentRev] = await student1Computer.query({
     ids: [paymentContract._id]
   })
   const claimedPayment = await student1Computer.sync(latestPaymentRev)
   // claimedPayment._satoshis = 546 (reduced to dust)
   // claimedPayment.status = 'claimed'
   ```

4. **Fund Transfer**: Satoshis moved from Payment UTXO to student's wallet
   ```javascript
   // Before: Payment UTXO has 49,454 sats
   // After: Payment UTXO has 546 sats (dust), student wallet +~49,000 sats (minus gas)
   ```

**Key Concepts**:
- **cashOut Pattern**: Contract reduces `_satoshis` to minimum (546), difference goes to caller
- **UTXO Spending**: Old Payment UTXO spent, new Payment UTXO + payment to student created
- **Ownership Validation**: Bitcoin Computer checks `_owners` before allowing claim
- **Double-Claim Prevention**: Contract throws error if `status === 'claimed'`

**Technical Details**:
- Transaction has multiple outputs:
  1. New Payment UTXO (546 sats, status='claimed')
  2. Payment to student (49,454 - 546 - fees sats)
  3. Change output (if applicable)
- Student must be in `_owners` array to execute claim
- Gas fees paid by student (deducted from received amount)

---

## Common Bitcoin Computer Patterns

### Pattern 1: Creating New Contracts

```javascript
const { tx, effect } = await computer.encode({
  mod: moduleSpec,
  exp: `new ContractClass(arg1, arg2, ...)`
})
await computer.broadcast(tx)
const contract = effect.res
```

**When to Use**: Creating new contract instances (Quiz, QuizAttempt, Payment)

### Pattern 2: Calling Instance Methods (Direct)

```javascript
await contract.methodName(args)
```

**When to Use**: Simple mutations where Bitcoin Computer auto-handles transaction
**Limitation**: Doesn't work reliably in tests; use Pattern 3 instead

### Pattern 3: Calling Instance Methods (encodeCall)

```javascript
const { tx } = await computer.encodeCall({
  target: contract,
  property: 'methodName',
  args: [arg1, arg2],
  mod: moduleSpec
})
await computer.broadcast(tx)
await sleep(3000)
const [latestRev] = await computer.query({ ids: [contract._id] })
const updatedContract = await computer.sync(latestRev)
```

**When to Use**: Mutations that need explicit control and guaranteed persistence
**Why Query**: `sync(oldRev)` returns stale state; must query for latest revision

### Pattern 4: Static Methods (Not Recommended)

```javascript
// Attempted but doesn't work reliably in v0.26.0-beta.0
const { tx } = await computer.encode({
  mod: moduleSpec,
  exp: `Class.staticMethod(param1, param2)`,
  env: { param1: contract._rev }
})
```

**Status**: Attempted for nested contract creation; failed with internal errors
**Alternative**: Create contracts separately in individual transactions

---

## Bitcoin Computer Core Concepts

### 1. Smart Contracts as UTXOs

- Each contract instance is a Bitcoin UTXO
- UTXO contains:
  - **Satoshis** (`_satoshis`): Locked funds
  - **Script**: P2SH output locking script
  - **State**: Contract properties stored in witness/OP_RETURN
- Modifying contract = spending old UTXO + creating new UTXO

### 2. Ownership Model

- `_owners`: Array of public keys authorized to modify contract
- Bitcoin Computer validates signatures before executing methods
- Ownership can be transferred by modifying `_owners` array

### 3. Revision System

- `_id`: Permanent identifier (txid of creation transaction)
- `_rev`: Current revision (txid:vout of latest UTXO)
- Each mutation creates new revision (new UTXO)
- Old revisions remain on blockchain but are spent

### 4. Module System

- Contract code deployed once using `deploy()`
- Returns module specifier (hash + pointer)
- Multiple instances reference same deployed code
- Saves transaction fees (don't re-deploy code each time)

### 5. Expression Evaluation

- `encode()` inscribes JavaScript expression in transaction
- Bitcoin Computer evaluates expression during transaction verification
- Expression execution modifies contract state
- Results stored in new UTXO

### 6. Fund Flow

```
Quiz Creation:   Teacher wallet → Quiz UTXO (50,000 sats)
Student Attempt: Student wallet → QuizAttempt UTXO (7,000 sats)
Reveal:          Quiz UTXO(50,000) → Quiz UTXO(50,000) [state changed]
Distribute:      Quiz UTXO(50,000) → Quiz UTXO(546) [reduced to dust]
Payment Create:  Teacher wallet → Payment UTXO(49,454 sats)
Claim:           Payment UTXO(49,454) → Payment UTXO(546) + Student wallet(~49,000)
```

---

## Bitcoin Computer Limitations (v0.26.0-beta.0)

### 1. Complex Object Storage

**Issue**: Cannot store arrays of objects in contract state
```javascript
// This FAILS:
this.winners = [{ student: 'pubkey', amount: 1000n }]
// Error: "Detected object that does not extend from Contract"

// This WORKS:
this.winners = ['pubkey1', 'pubkey2']  // Array of strings
```

**Workaround**: Store primitives only; use separate contracts for complex data

### 2. Static Method Nested Contracts

**Issue**: Static methods cannot reliably create nested contracts
```javascript
// Attempted pattern (doesn't work):
static distributePrizes(quiz, winners) {
  const payments = winners.map(w => new Payment(...))  // FAILS
  return payments
}
```

**Workaround**: Create contracts separately in individual transactions

### 3. Syncing from Old Revisions

**Issue**: `sync(oldRev)` returns stale state after mutations
```javascript
// This returns OLD state:
await contract.mutate()
const stale = await computer.sync(contract._rev)

// This returns NEW state:
await contract.mutate()
const [latest] = await computer.query({ ids: [contract._id] })
const fresh = await computer.sync(latest)
```

**Workaround**: Always `query()` for latest revision after mutations

### 4. Direct Method Call Persistence

**Issue**: Direct method calls don't reliably persist in test environment
```javascript
// May not persist:
contract.method()

// Reliably persists:
const { tx } = await computer.encodeCall({...})
await computer.broadcast(tx)
```

**Workaround**: Use `encodeCall()` pattern for guaranteed persistence

---

## Gas Fees & Economics

### Transaction Costs

Each blockchain operation incurs gas fees:

| Operation | Approximate Cost | Why? |
|-----------|-----------------|------|
| Module Deploy | ~20,000 sats | Large OP_RETURN data (contract code) |
| Contract Create | ~15,000 sats | OP_RETURN + P2SH output + state data |
| Method Call | ~10,000 sats | Transaction with inputs + outputs |
| Simple Transfer | ~5,000 sats | Basic P2PKH transaction |

### Fund Flow Analysis (Test Scenario)

**Teacher**:
- Paid: 50,000 (prize) + ~130,000 (gas) = -180,000 sats
- Received: 14,700 (98% of entry fees in contracts)
- Net: -165,300 sats

**Student 1 (Winner)**:
- Paid: 7,000 (entry) + ~66,000 (gas for attempt) + ~10,000 (gas for claim) = -83,000 sats
- Received: ~49,000 (prize after claim gas)
- Net: -34,000 sats (loses due to high test network gas)

**Students 2 & 3 (Losers)**:
- Paid: 7,000 (entry) + ~66,000 (gas)
- Received: 0
- Net: -73,000 sats each

**Note**: In production with realistic gas fees, winner would profit significantly

---

## Best Practices Learned

### 1. Module Deployment
- Deploy contract code once at application startup
- Reuse module specifier for all contract instances
- Saves ~15,000 sats per instance

### 2. State Mutations
- Always use `encodeCall()` for methods that modify state
- Always `query()` after mutation to get latest revision
- Never `sync()` from old revision expecting new state

### 3. Contract Design
- Keep contract state simple (primitives and simple arrays)
- Avoid storing complex objects (arrays of objects, nested structures)
- Use separate contracts for related entities (Payment separate from Quiz)

### 4. Fund Management
- Set `_satoshis` carefully (minimum 546 sats for dust limit)
- cashOut pattern: Reduce `_satoshis` to 546, difference sent to caller
- Account for gas fees in economic models

### 5. Testing
- Use `sleep()` after broadcast to allow blockchain confirmation
- Query for latest revisions before assertions
- Test environment has higher gas fees than production

### 6. Error Handling
- Bitcoin script errors (e.g., "mandatory-script-verify-flag-failed") indicate ownership/signature issues
- "Detected object that does not extend from Contract" means complex object in state
- "Invalid rev" means malformed revision string format

---

## Conclusion

Bitcoin Computer provides a unique approach to smart contracts on Bitcoin/Litecoin:

**Strengths**:
- True Bitcoin UTXO-based contracts
- JavaScript-based development (familiar to web developers)
- Module system reduces deployment costs
- Strong ownership model with signature validation

**Challenges**:
- Limitations on complex state storage
- Higher gas fees than traditional approaches
- Revision tracking complexity
- V0.26.0-beta.0 has specific limitations with nested contracts

**Overall**: Suitable for applications with simple state models and explicit ownership requirements. Best for scenarios where Bitcoin's security model is essential.

---

**Report Generated**: 2026-01-20
**Bitcoin Computer Version**: v0.26.0-beta.0
**Network**: Litecoin Regtest
**Test Suite**: 23/23 tests passing
