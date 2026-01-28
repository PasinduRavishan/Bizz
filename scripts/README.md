# Payment Distribution Scripts

## Overview

These scripts help test and manage the payment distribution system for quizzes.

## Scripts

### 1. test-payment-distribution.cjs

**Tests payment distribution without executing real payments.**

```bash
node scripts/test-payment-distribution.cjs <quizId>
```

**What it does:**
- ✅ Fetches quiz data (winners, attempts, balances)
- ✅ Calculates expected prize distribution
- ✅ Calculates expected entry fee collection
- ✅ Shows net teacher profit/loss
- ✅ Identifies potential issues
- ✅ Shows detailed winner information
- ❌ Does NOT execute actual payments

**Example:**
```bash
node scripts/test-payment-distribution.cjs cmkc8kii1000712lsggsbtgb2
```

**Output:**
```
🧪 TESTING PAYMENT DISTRIBUTION
============================================================
Quiz ID: cmkc8kii1000712lsggsbtgb2

📊 Step 1: Fetching quiz data...
✅ Quiz found: Quiiz 22
   Teacher: Teacher
   Status: REVEALED
   Prize Pool: 80000 sats
   Entry Fee: 10000 sats
   Winners: 1
   Attempts: 1

📊 Step 2: Checking teacher wallet...
   Teacher balance: 180000 sats
   Teacher address: msnx6WTAnv1ZSjdfzbsj6gj6bNLKXE5BKe
   Total prizes to pay: 80000 sats

📊 Step 3: Checking student wallets...
   Student: Student
      Balance: 30000 sats
      Entry fee to pay: 9800 sats

📊 Step 4: Calculating expected outcomes...
   Total entry fees (to teacher): 9800 sats
   Total platform fee: 200 sats
   Total prizes to pay: 80000 sats
   Net teacher change: -70200 sats
   ⚠️  Teacher will lose 70200 sats

📊 Step 5: Checking for potential issues...
   ✅ No issues found

📊 SUMMARY
============================================================
Quiz: Quiiz 22
Status: REVEALED

Prize Distribution:
  1 winners × 80000 sats = 80000 sats

Entry Fee Collection:
  1 attempts × 9800 sats = 9800 sats
  Platform fee: 200 sats (2.0%)

Net Result:
  Teacher: -70200 sats
  Platform: +200 sats

✅ Ready for payment processing
============================================================

🏆 WINNER DETAILS
============================================================
1. Student
   Score: 100%
   Prize: 80000 sats
   Paid: ❌ No
   Address: mzQAA9Xy14vyWwaGJ6tULdKZJ77zJiLL4U
```

---

### 2. fund-wallet.cjs

**Funds a user's wallet with spendable UTXOs (regtest only).**

```bash
node scripts/fund-wallet.cjs <userId> <amount-in-sats>
```

**What it does:**
- ✅ Fetches user information
- ✅ Shows current balance and UTXOs
- ✅ Uses faucet to add funds (regtest)
- ✅ Shows new balance and UTXOs
- ✅ Updates database

**Example:**
```bash
# Fund teacher with 100,000 sats
node scripts/fund-wallet.cjs cmkc4wq7b000011w5suz4a0b4 100000

# Fund student with 20,000 sats  
node scripts/fund-wallet.cjs cmka5glj200035rqbj4m8o177 20000
```

**Output:**
```
💰 FUNDING WALLET
============================================================
User ID: cmkc4wq7b000011w5suz4a0b4
Amount: 100000 sats

User: Teacher (teacher@example.com)
Address: msnx6WTAnv1ZSjdfzbsj6gj6bNLKXE5BKe
Current balance: 80000 sats

Actual blockchain balance: 80000 sats
Available UTXOs: 0

🚰 Using faucet (regtest)...
✅ Faucet request sent for 0.001 BTC

⏳ Waiting for transaction to be mined...

✅ New balance: 180000 sats
✅ Available UTXOs: 1

New UTXO Details:
  1. 100000 sats - abc123def456...

💾 Database updated

✅ Wallet funded successfully!
============================================================
```

---

## Complete Testing Workflow

### Step 1: Create and Complete Quiz

1. Teacher creates quiz via frontend
2. Students submit attempts
3. Students reveal answers
4. Teacher reveals answers (grading happens)

### Step 2: Check Payment Status

```bash
# Get quiz ID from frontend or database
QUIZ_ID="cmkc8kii1000712lsggsbtgb2"

# Test payment distribution (dry run)
node scripts/test-payment-distribution.cjs $QUIZ_ID
```

Review output for:
- ⚠️ Warnings about insufficient balances
- ⚠️ Missing wallet addresses
- ❌ Any blocking issues

### Step 3: Fund Wallets (if needed)

If step 2 showed balance warnings:

```bash
# Get user IDs from test output or database
TEACHER_ID="cmkc4wq7b000011w5suz4a0b4"
STUDENT_ID="cmka5glj200035rqbj4m8o177"

# Fund teacher (needs to pay prizes)
node scripts/fund-wallet.cjs $TEACHER_ID 100000

# Fund each student (needs to pay entry fees)
node scripts/fund-wallet.cjs $STUDENT_ID 20000
```

### Step 4: Execute Payment Distribution

```bash
# Via API (if you have session cookie)
curl -X POST http://localhost:3000/api/quizzes/$QUIZ_ID/distribute \
  -H "Cookie: next-auth.session-token=YOUR_SESSION"

# OR via frontend
# Click "View Payments" → "Retry Distribution" button
```

### Step 5: Verify Results

```bash
# Run test again to see results
node scripts/test-payment-distribution.cjs $QUIZ_ID
```

Check for:
- ✅ Winners marked as "Paid: Yes"
- ✅ Transaction hashes present
- ✅ Updated balances

---

## Common Issues & Solutions

### Issue 1: "no matching Script"

**Error:**
```
Error: 0.0008 has no matching Script
```

**Cause:** Wallet has balance but no spendable UTXOs (funds locked in contracts)

**Solution:**
```bash
node scripts/fund-wallet.cjs <userId> 100000
```

### Issue 2: "Insufficient balance"

**Error:**
```
Error: Insufficient balance. Have 50000 sats, need 80000 sats
```

**Cause:** Wallet doesn't have enough total balance

**Solution:**
```bash
node scripts/fund-wallet.cjs <userId> 100000
```

### Issue 3: "No UTXOs available"

**Error:**
```
Error: No UTXOs available. Balance is locked in contracts.
```

**Cause:** All satoshis are locked in smart contracts

**Solution:**
```bash
node scripts/fund-wallet.cjs <userId> 100000
```

### Issue 4: "User has no wallet address"

**Error:**
```
Error: Student Alice has no wallet address
```

**Cause:** User hasn't created a wallet yet

**Solution:**
- User needs to login and create wallet via frontend
- OR manually create wallet in database

---

## Tips

1. **Always test first:**
   ```bash
   node scripts/test-payment-distribution.cjs <quizId>
   ```
   Review output before attempting real payments.

2. **Fund wallets proactively:**
   - Fund teacher wallet after quiz creation
   - Fund student wallets after attempt submission
   - Prevents payment failures

3. **Check UTXOs, not just balance:**
   - Balance includes locked contract funds
   - Only UTXOs can be spent
   - Use fund-wallet script to add UTXOs

4. **Monitor payment status:**
   - Check database for `winner.paid = true`
   - Check for `paidTxHash` values
   - Use frontend "View Payments" modal

5. **Regtest only for funding:**
   - fund-wallet.cjs only works on regtest
   - For mainnet/testnet, manually send funds

---

## Environment Variables

Required in `.env.local`:

```bash
# Database
DATABASE_URL="postgresql://..."

# Bitcoin Computer
NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN="LTC"
NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK="regtest"
NEXT_PUBLIC_BITCOIN_COMPUTER_URL="https://rltc.node.bitcoincomputer.io"

# Encryption
WALLET_ENCRYPTION_KEY="your-32-char-encryption-key"
```

---

## Support

For issues or questions:
1. Check [PAYMENT_ISSUE_SOLUTION.md](../docs/PAYMENT_ISSUE_SOLUTION.md)
2. Review error logs
3. Run test script for diagnostics
4. Check wallet balances and UTXOs
