# Bitcoin Computer: `exec` and `swap` Research Summary

## Executive Summary

After researching the Bitcoin Computer monorepo documentation and examples, I've identified two powerful patterns for atomic multi-object operations:

1. **Static `exec` Method Pattern** - For complex atomic operations involving multiple smart objects
2. **Swap Pattern** - For simple bilateral exchanges of object ownership

Both patterns enable **atomic operations** where multiple smart objects are modified in a single Bitcoin transaction, ensuring all changes succeed or fail together.

---

## 1. Static `exec` Method Pattern

### What is `exec`?

The static `exec` method is a Bitcoin Computer pattern for creating **atomic multi-object transactions**. It's called "static" because it's defined as a class method (not instance method) and can operate on multiple smart objects simultaneously.

### Key Characteristics

- **Static Method**: Defined with `static exec(...)` in a Contract class
- **Multi-Object**: Can modify multiple smart objects (2-4 objects typically)
- **Atomic**: All operations succeed or fail together in one transaction
- **Flexible Signatures**: SIGHASH_SINGLE | SIGHASH_ANYONECANPAY for partial signing
- **Mocking Support**: Can use mocks for objects that don't exist yet

### Real-World Use Cases from Bitcoin Computer Monorepo

#### Use Case 1: NFT Sale (Simple 2-Object Swap)

**Purpose**: Atomically exchange NFT for Payment

```typescript
class Sale extends Contract {
  static exec(nft: NFT, payment: Payment) {
    const [ownerN] = nft._owners
    const [ownerP] = payment._owners

    nft.transfer(ownerP)        // NFT goes to buyer
    payment.transfer(ownerN)     // Payment goes to seller

    return [payment, nft]        // Order matters for outputs!
  }
}
```

**Transaction Flow**:
1. Seller creates NFT
2. Seller creates partially signed transaction with payment mock
3. Buyer creates actual payment object
4. Buyer updates transaction inputs/outputs
5. Buyer funds, signs, broadcasts

**Code Example**:
```javascript
// Seller side
const nft = await seller.new(NFT, ['name', 'symbol'])
const mock = new PaymentMock(7860)  // Mock the future payment

const { tx } = await seller.encode({
  exp: `${Sale} Sale.exec(nft, payment)`,
  env: { nft: nft._rev, payment: mock._rev },
  mocks: { payment: mock },
  sighashType: SIGHASH_SINGLE | SIGHASH_ANYONECANPAY,  // Allows buyer to complete
  inputIndex: 0,
  fund: false,  // Buyer will fund
})

// Buyer side
const payment = await buyer.new(Payment, [BigInt(1e8)])
const [paymentTxId, paymentIndex] = payment._rev.split(':')

tx.updateInput(1, { txId: paymentTxId, index: parseInt(paymentIndex, 10) })
tx.updateOutput(1, { scriptPubKey: buyer.toScriptPubKey() })

await buyer.fund(tx)
await buyer.sign(tx)
await buyer.broadcast(tx)
```

#### Use Case 2: Ordinal Sale (4-Object Complex Transaction)

**Purpose**: Sell ordinals while preserving ordinal ranges

```typescript
class OrdSale extends Contract {
  static exec(b1: Payment, b2: Payment, n: NFT, p: Payment) {
    const [ownerT] = n._owners      // Teacher/Seller
    const [ownerP] = p._owners      // Purchaser/Buyer

    n.transfer(ownerP)              // NFT to buyer
    p.transfer(ownerT)              // Payment to seller

    b1.setAmount(b1._satoshis + b2._satoshis)  // Merge buffers
    return [b1, n, p, b2]           // Specific order for ordinal preservation
  }
}
```

**Why 4 Objects?**
- `b1`, `b2`: Buffer payments to preserve ordinal ranges
- `n`: The ordinal NFT being sold
- `p`: The payment from buyer to seller

**Special Feature**: The buffer payments (`b1`, `b2`) ensure that ordinal ranges are preserved for the NFT and payment objects.

---

## 2. Swap Pattern

### What is Swap?

A simpler pattern specifically for **bilateral exchanges** - two parties each have an object and want to exchange ownership.

### Implementation

```typescript
export class NFT extends Contract {
  constructor(name = '', symbol = '') {
    super({ name, symbol })
  }

  transfer(to: string) {
    this._owners = [to]
  }
}

export class Swap extends Contract {
  static exec(a: NFT, b: NFT) {
    const [ownerA] = a._owners
    const [ownerB] = b._owners

    a.transfer(ownerB)  // A's NFT goes to B
    b.transfer(ownerA)  // B's NFT goes to A
  }
}
```

### Transaction Flow

```javascript
// Alice and Bob each create an NFT
const nftA = await alice.new(NFT, ['A', 'AAA'])
const nftB = await bob.new(NFT, ['B', 'BBB'])

// Alice builds partially signed swap transaction
const { tx } = await alice.encode({
  exp: `${Swap} Swap.exec(a, b)`,
  env: { a: nftA._rev, b: nftB._rev },
})

// Alice sends tx to Bob for verification

// Bob verifies the transaction
const { encode, decode } = bob.computer
const { exp, env } = await decode(tx)
const { effect } = await encode({ exp, env })
const { a, b } = effect.env

const notOk = exp !== 'new Swap(a, b)' ||
              a._owners.toString() !== bobPubKey ||
              b._owners.toString() !== alicePubKey
if (notOk) throw new Error('Invalid swap!')

// Bob signs and broadcasts
await bob.sign(tx)
await bob.broadcast(tx)
```

---

## 3. Key Concepts

### Mocking

**Why Mock?**
When creating a transaction, you might need to reference objects that don't exist yet (e.g., buyer's payment in a sale).

**How to Mock:**

```javascript
const mockedRev = `mock-${'0'.repeat(64)}:0`

class PaymentMock {
  constructor(amount: bigint) {
    this._id = mockedRev
    this._rev = mockedRev
    this._root = mockedRev
    this._satoshis = amount
    this._owners = [<some public key>]
  }

  transfer(to: string) {
    this._owners = [to]
  }
}

// Use in encode
const mock = new PaymentMock(BigInt(1e8))
await computer.encode({
  exp: `${Sale} Sale.exec(nft, payment)`,
  env: { payment: mock._rev },
  mocks: { payment: mock },  // Maps variable to mock
})
```

### SIGHASH Types

```javascript
SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
```

- **SIGHASH_SINGLE**: Signs only the corresponding output (allows other outputs to be added)
- **SIGHASH_ANYONECANPAY**: Allows additional inputs to be added
- **Combined**: Seller signs their input/output, buyer can add their inputs/outputs

### Return Value Ordering

```javascript
return [payment, nft]  // ORDER MATTERS!
```

The order of returned objects determines the order of transaction outputs, which affects:
- UTXO structure
- Ordinal range preservation
- Gas efficiency

---

## 4. Comparison: `exec` vs `swap`

| Aspect | Static `exec` | Swap Pattern |
|--------|---------------|--------------|
| **Complexity** | Can handle complex multi-object logic | Simple bilateral exchange |
| **Objects** | 2-4+ objects | Exactly 2 objects |
| **Use Case** | Sales, complex swaps, ordinal trades | Simple NFT-for-NFT trades |
| **Mocking** | Often needed | Rarely needed |
| **Partial Signing** | Common (seller signs first) | Common (initiator signs first) |
| **Return Value** | Order matters for outputs | Not typically returned |

---

## 5. How This Applies to Our Quiz Platform

### Current Implementation (swap-flow.test2.js)

We're already using a **swap pattern** for:

```javascript
// PrizeSwap.swap(prizePayment, entryFeePayment, attempt)
```

This is a **3-object atomic operation**:
1. `prizePayment`: Teacher → Student
2. `entryFeePayment`: Student → Teacher
3. `attempt`: Updated to mark as claimed

### Potential Improvements with `exec`

#### Option 1: Prize Distribution with `exec`

Instead of creating Payment contracts separately, we could use `exec` for atomic prize distribution:

```javascript
class PrizeDistribution extends Contract {
  static exec(quiz: Quiz, attempt: QuizAttempt, payment: Payment) {
    // Verify attempt passed
    if (!attempt.passed) throw new Error('Student did not pass')
    if (quiz.status !== 'revealed') throw new Error('Quiz not revealed')

    // Transfer prize to student
    const [student] = attempt._owners
    payment.transfer(student)

    // Mark attempt as claimed
    attempt.status = 'prize_claimed'

    // Update quiz state
    quiz.prizesDistributed += 1

    return [payment, attempt, quiz]
  }
}
```

**Benefits**:
- Atomic: All state changes happen together
- Verifiable: Can check quiz state before distributing
- Gas efficient: Single transaction for multiple updates

#### Option 2: Entry Fee Collection with `exec`

For failed students, use `exec` to collect entry fees:

```javascript
class FeeCollection extends Contract {
  static exec(attempt: QuizAttempt, payment: Payment, quiz: Quiz) {
    // Verify student failed
    if (attempt.passed) throw new Error('Student passed, cannot collect fee')
    if (quiz.status !== 'completed') throw new Error('Quiz not completed')

    const [teacher] = quiz._owners

    // Transfer entry fee to teacher
    payment.transfer(teacher)

    // Mark as collected
    attempt.status = 'fee_collected'

    return [payment, attempt]
  }
}
```

---

## 6. Recommended Next Steps

### Phase 1: Research & Planning ✅ (DONE)
- [x] Understand `exec` pattern
- [x] Understand `swap` pattern
- [x] Identify use cases in our quiz platform
- [x] Document findings

### Phase 2: Design (NEXT)
Before writing code, we need to:

1. **Decide on Flow**:
   - Keep current swap for winners (working well)
   - Add `exec` for losers' entry fee collection?
   - Or redesign entire flow with `exec`?

2. **Design Contract Structure**:
   ```
   Option A: Hybrid Approach
   - Winners: Keep PrizeSwap (swap pattern)
   - Losers: Use FeeCollection (exec pattern)

   Option B: Full exec Approach
   - All distributions use exec
   - More consistent but more complex
   ```

3. **Mock Strategy**:
   - What objects need mocking?
   - When to create mocks vs actual objects?

4. **Transaction Signing**:
   - Who signs what and when?
   - SIGHASH types for each scenario?

### Phase 3: Implementation
- Create new contract classes
- Write test cases
- Test atomic operations
- Handle edge cases

### Phase 4: Migration
- Compare gas costs
- Verify atomic guarantees
- Update production code

---

## 7. Critical Insights from Bitcoin Computer Docs

### Atomic Guarantees

> "The `exec` function swaps owners of NFTs and payments while ensuring that all operations succeed or fail together in one transaction."

This is the **key benefit** - no partial failures.

### Transaction Verification

Before broadcasting, the receiving party can verify:

```javascript
const { exp, env } = await decode(tx)
const { effect } = await encode({ exp, env })

// Check the effect before broadcasting!
if (effect.res !== expectedResult) throw new Error('Invalid transaction')
```

This **verification step** is crucial for trustless swaps.

### Gas Efficiency

```javascript
return [payment, nft]  // Specific order reduces gas
```

The order of returned objects affects gas costs because of how Bitcoin Computer structures outputs.

---

## 8. Questions to Consider

1. **Do we need `exec` for our use case?**
   - Current swap works for winners
   - Do we need atomic multi-state updates?

2. **What's the complexity vs benefit tradeoff?**
   - exec adds complexity
   - But provides stronger atomicity guarantees

3. **Can we achieve the same with simpler patterns?**
   - Maybe simple Payment transfers are sufficient?
   - Does the atomic guarantee justify the complexity?

4. **What about gas costs?**
   - exec might be more efficient (single tx for multiple updates)
   - Need to test and compare

---

## 9. Recommended Decision Framework

Ask these questions in order:

1. **Do we need atomic multi-object updates?**
   - If NO → Use simple transfers
   - If YES → Continue

2. **Is it a bilateral exchange (2 objects)?**
   - If YES → Use swap pattern
   - If NO → Continue

3. **Do we need complex state logic across objects?**
   - If YES → Use exec pattern
   - If NO → Consider simpler approaches

4. **Can we mock future objects?**
   - If YES → exec with mocks
   - If NO → Reconsider flow

---

## Conclusion

We now understand:

✅ **What `exec` is**: Static method for atomic multi-object operations
✅ **What `swap` is**: Bilateral exchange pattern
✅ **When to use each**: Based on complexity and object count
✅ **How they work**: Partial signing, mocking, verification
✅ **Real examples**: NFT sales, ordinal sales, token swaps

**Next Decision**: Choose between:
- **Option A**: Keep current swap, add exec for fee collection
- **Option B**: Redesign everything with exec
- **Option C**: Stay with current approach (if working well)

Let's discuss which option makes most sense for the quiz platform before writing any code.
