# Quiz Creation API Migration - Changes Summary

## Problem
The previous implementation tried to deploy Quiz contracts directly from the frontend using the Bitcoin Computer instance from `WalletContext`. This doesn't work because:

1. **Bitcoin Computer requires Node.js environment** - The library needs proper server-side Node.js modules
2. **Security concerns** - Private keys and contract deployment should happen server-side
3. **Reliability** - Contract deployment is complex and needs stable server environment

## Solution
Migrated quiz creation to use a **server-side API route** that handles contract deployment.

---

## Files Changed

### 1. ✅ New File: `/src/app/api/quizzes/create/route.ts`
**Purpose:** Server-side API endpoint for deploying Quiz contracts

**Key Features:**
- Initializes Bitcoin Computer on server with environment variables
- Uses `BITCOIN_COMPUTER_MNEMONIC` for consistent wallet (development)
- Validates quiz data before deployment
- Generates salt and hashes answers server-side
- Deploys Quiz contract to blockchain
- Returns quiz ID, revision, salt, and correct answers to client

**Endpoint:** `POST /api/quizzes/create`

**Request Body:**
```typescript
{
  questions: QuizQuestion[]
  prizePool: number
  entryFee: number
  passThreshold: number
  deadline: string (ISO)
  title?: string
  description?: string
  teacherPublicKey: string
}
```

**Response:**
```typescript
{
  success: boolean
  quizId?: string
  quizRev?: string
  salt?: string
  correctAnswers?: string[]
  error?: string
}
```

### 2. ✅ Updated: `/src/services/quiz-service.ts`
**Changes:**
- Removed `computer` parameter from `createQuiz()` function
- Added `teacherPublicKey` to `CreateQuizParams`
- Changed implementation to call API route via `fetch()`
- Moved contract deployment logic to server
- Client now only validates and calls API

**Before:**
```typescript
createQuiz(computer, params) {
  // Deploy contract from frontend
  const quiz = await computer.new(Quiz, [...])
}
```

**After:**
```typescript
createQuiz(params) {
  // Call server API
  const response = await fetch('/api/quizzes/create', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}
```

### 3. ✅ Updated: `/src/app/teacher/create/page.tsx`
**Changes:**
- Added `publicKey` from `useWallet()` hook
- Removed `computer` from validation check
- Pass `publicKey` instead of `computer` to `createQuiz()`

**Before:**
```typescript
const { computer, connected, balance } = useWallet()

const result = await createQuiz(computer!, {
  questions,
  prizePool,
  // ...
})
```

**After:**
```typescript
const { computer, connected, balance, publicKey } = useWallet()

const result = await createQuiz({
  questions,
  prizePool,
  teacherPublicKey: publicKey!,
  // ...
})
```

---

## Architecture Flow

### Before (❌ Broken):
```
Frontend Component
    ↓
createQuiz(computer, ...)
    ↓
computer.new(Quiz, [...])  ← Fails in browser environment
    ↓
❌ Error: Bitcoin Computer needs Node.js
```

### After (✅ Working):
```
Frontend Component
    ↓
createQuiz({ teacherPublicKey, ... })
    ↓
fetch('/api/quizzes/create')
    ↓
API Route (Server-side)
    ↓
new Computer({ ... })  ← Runs in Node.js
    ↓
computer.new(Quiz, [...])
    ↓
✅ Contract deployed to blockchain
    ↓
Return { quizId, salt, ... }
    ↓
Frontend receives result
```

---

## Environment Variables Required

```env
# Bitcoin Computer Configuration
NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK=regtest
NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN=LTC
NEXT_PUBLIC_BITCOIN_COMPUTER_URL=https://rltc.node.bitcoincomputer.io

# Shared wallet mnemonic (development only)
BITCOIN_COMPUTER_MNEMONIC="abandon abandon abandon..."
```

---

## Benefits

1. **✅ Proper Environment:** Contract deployment runs in Node.js server environment
2. **✅ Security:** Private keys never exposed to frontend
3. **✅ Reliability:** Server-side deployment is more stable
4. **✅ Scalability:** Can add rate limiting, authentication, logging
5. **✅ Maintainability:** Clear separation between frontend and blockchain logic

---

## Testing

To test the new implementation:

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to:** `http://localhost:3000/teacher/create`

3. **Connect wallet** and fill in quiz details

4. **Click "Create Quiz"** - Should now work properly!

5. **Check server logs** for contract deployment messages:
   ```
   🚀 Creating quiz contract...
     Teacher: 02abc...
     Questions: 3
     Prize Pool: 50000 sats
   ✅ Quiz deployed!
     Contract ID: 9108a066...
   ```

---

## Error Handling

The API route includes proper error handling:

- **400 Bad Request:** Invalid input data
- **500 Internal Server Error:** Contract deployment failed

Frontend displays error messages to user.

---

## Future Improvements

1. **Authentication:** Add teacher authentication to API route
2. **Database:** Store quiz metadata in database after deployment
3. **Indexer:** Trigger indexer sync after quiz creation
4. **Rate Limiting:** Prevent spam quiz creation
5. **Transaction Monitoring:** Track deployment transaction status

---

## Migration Complete ✅

Quiz creation now works properly with server-side contract deployment!
