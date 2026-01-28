# Bizz Quiz Platform - Project Status & Documentation

**Last Updated:** January 8, 2026  
**Status:** Phase 1 Complete - Blockchain Integration & Indexer Working ✅

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Completed Features](#completed-features)
4. [Wallet & Blockchain Integration](#wallet--blockchain-integration)
5. [Database & Indexer](#database--indexer)
6. [Smart Contracts](#smart-contracts)
7. [Current State](#current-state)
8. [Next Steps](#next-steps)
9. [Technical Details](#technical-details)

---

## 🎯 Project Overview

**Bizz** is a decentralized quiz platform built on Bitcoin Computer that allows:
- **Teachers** to create quizzes with crypto rewards
- **Students** to take quizzes and earn prizes
- **Commit-Reveal** mechanism to prevent cheating
- **On-chain verification** of all quiz attempts
- **Prize pool distribution** based on performance

### Technology Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Blockchain:** Bitcoin Computer (Litecoin Regtest for development)
- **Smart Contracts:** JavaScript contracts on Bitcoin Computer
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma 5.22.0
- **Indexer:** Custom TypeScript service syncing blockchain to database

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Quiz Create  │  │ Quiz Take    │  │ Wallet UI    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API Layer (Next.js API)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ /api/quizzes │  │ /api/attempts│  │ /api/users   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│   Blockchain Layer       │      │   Database Layer         │
│  (Bitcoin Computer)      │◄────►│   (PostgreSQL)           │
│                          │      │                          │
│  • Quiz Contracts        │      │  • Quiz Table            │
│  • QuizAttempt Contracts │      │  • QuizAttempt Table     │
│  • LTC Regtest Network   │      │  • User Table            │
│  • Remote Node           │      │  • IndexerState Table    │
└──────────────────────────┘      └──────────────────────────┘
            ▲                                   ▲
            │                                   │
            └───────────┬───────────────────────┘
                        │
            ┌───────────▼──────────┐
            │  Blockchain Indexer  │
            │  (Background Service)│
            │  • Polls every 30s   │
            │  • Syncs contracts   │
            └──────────────────────┘
```

### Data Flow

1. **Quiz Creation:** Teacher → Frontend → Blockchain → Contract Deployed
2. **Quiz Taking:** Student → Frontend → Blockchain → Attempt Contract Deployed
3. **Indexing:** Indexer → Blockchain → Syncs to Database
4. **Display:** Frontend → API → Database → User sees data

---

## ✅ Completed Features

### Phase 1: Core Infrastructure ✅

#### 1. Smart Contracts ✅
- **Quiz Contract** (`contracts/Quiz.js`)
  - Stores quiz metadata, answer hashes, prize pool, deadlines
  - Handles teacher reveal of answers
  - Manages quiz lifecycle (active, revealed, completed)
  
- **QuizAttempt Contract** (`contracts/QuizAttempt.js`)
  - Stores student's answer commitment (hash)
  - Implements commit-reveal pattern
  - Tracks attempt status and scores

- **QuizVerification Contract** (`contracts/QuizVerification.js`)
  - Off-chain verification logic
  - Score calculation and prize distribution
  - Winner determination

#### 2. Database Schema ✅
- **Quiz Table:** Stores all quiz metadata from blockchain
- **QuizAttempt Table:** Stores all attempt data from blockchain
- **User Table:** Tracks teachers and students by public key
- **IndexerState Table:** Tracks last sync timestamp

#### 3. Blockchain Indexer ✅
- Syncs Quiz contracts from blockchain to database
- Syncs QuizAttempt contracts from blockchain to database
- Automatic user creation from contract data
- Runs every 30 seconds in continuous mode
- Single-run mode for testing
- Status reporting

#### 4. Wallet Integration ✅
- **WalletContext:** Global wallet state management
  - Address, public key, balance tracking
  - Auto-refresh balance every 30 seconds
  - Connect/disconnect functionality
  - Faucet integration for testnet funding

- **WalletConnect Component:** UI for wallet interaction
  - Address display with copy functionality
  - Balance display (LTC and sats)
  - Fund from faucet button
  - Disconnect option

#### 5. Bitcoin Computer Integration ✅
- Remote regtest node connection
- Shared wallet configuration
- Contract deployment working
- Contract querying working
- Object syncing working

---

## 🔐 Wallet & Blockchain Integration

### Wallet Architecture

**Type:** Browser-based JavaScript wallet (no extension needed)

#### How It Works

1. **Wallet Generation:**
   ```typescript
   const computer = new Computer({
     chain: 'LTC',
     network: 'regtest',
     url: 'https://rltc.node.bitcoincomputer.io',
     mnemonic: process.env.BITCOIN_COMPUTER_MNEMONIC // Optional shared wallet
   })
   ```

2. **Automatic Key Management:**
   - Bitcoin Computer generates/loads private key automatically
   - Stores in memory during session
   - Derives address and public key from private key
   - No browser extension required

3. **Transaction Signing:**
   - All transactions signed internally by Computer instance
   - Uses private key in memory
   - Gas paid from wallet balance
   - Transactions broadcast to blockchain automatically

### Wallet Connection Flow

```
User Clicks "Connect Wallet"
         ↓
WalletContext.connect() called
         ↓
createComputer() from bitcoin-computer.ts
         ↓
Bitcoin Computer Library initializes
         ↓
Generates/loads wallet (private key, public key, address)
         ↓
Computer instance returned
         ↓
Context updates: { address, publicKey, balance, computer }
         ↓
User sees address and balance in UI
```

### Shared Wallet Configuration

**Development Setup:**
- Uses `BITCOIN_COMPUTER_MNEMONIC` from `.env.local`
- Same wallet used by indexer and test scripts
- Allows indexer to find contracts deployed by test scripts
- Standard BIP39 mnemonic for deterministic key generation

**Production Note:**
- Each user will have unique wallet
- Never share mnemonics in production
- Current setup is for development/testing only

### Blockchain Network

**Current:** Litecoin Regtest (Development)
- **Network:** regtest
- **Chain:** LTC
- **Node URL:** https://rltc.node.bitcoincomputer.io
- **Faucet:** Available via `computer.faucet(0.1e8)` (10M sats)
- **Block Time:** Instant (regtest)
- **Gas Costs:** ~1.9M sats per quiz + 2 attempts

**Future:** Can switch to mainnet by changing:
```typescript
{
  chain: 'LTC',
  network: 'mainnet',
  url: 'https://node.bitcoincomputer.io'
}
```

### Transaction Lifecycle

1. **Contract Creation:**
   ```javascript
   const quiz = await computer.new(Quiz, [
     teacherPubKey,
     'QmQuestionHash...',
     answerHashes,
     prizePool,
     entryFee,
     passThreshold,
     deadline
   ])
   ```
   - Creates transaction with contract code
   - Broadcasts to blockchain
   - Returns contract object with `_id` and `_rev`

2. **Contract Interaction:**
   ```javascript
   const synced = await computer.sync(quiz._rev)
   synced.reveal(answers, salt)
   ```
   - Syncs latest state from blockchain
   - Calls contract method
   - Creates mutation transaction
   - Updates contract state on-chain

---

## 💾 Database & Indexer

### Database: PostgreSQL on Supabase

**Connection:**
- **Pooled:** `postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true`
- **Direct:** `postgresql://...pooler.supabase.com:5432/postgres` (for migrations)

**Schema:**

```prisma
model User {
  id              String   @id @default(cuid())
  publicKey       String   @unique
  address         String
  role            Role     @default(STUDENT)
  totalEarnings   BigInt   @default(0)
  quizzesCreated  Int      @default(0)
  quizzesTaken    Int      @default(0)
  
  createdQuizzes  Quiz[]   @relation("TeacherQuizzes")
  attempts        QuizAttempt[]
}

model Quiz {
  id                      String      @id @default(cuid())
  contractId              String      @unique
  contractRev             String
  teacher                 User        @relation("TeacherQuizzes")
  questionHashIPFS        String
  answerHashes            String[]
  prizePool               BigInt
  entryFee                BigInt
  deadline                DateTime
  studentRevealDeadline   DateTime
  teacherRevealDeadline   DateTime
  status                  QuizStatus
  
  attempts                QuizAttempt[]
}

model QuizAttempt {
  id                String         @id @default(cuid())
  contractId        String         @unique
  contractRev       String
  student           User
  quiz              Quiz
  answerCommitment  String
  revealedAnswers   String[]
  score             Int?
  passed            Boolean?
  prizeAmount       BigInt?
  status            AttemptStatus
}
```

### Indexer Architecture

**Purpose:** Sync blockchain contracts to PostgreSQL for fast queries

**How It Works:**

1. **Initialization:**
   ```typescript
   const indexer = new BlockchainIndexer({
     chain: 'LTC',
     network: 'regtest',
     url: 'https://rltc.node.bitcoincomputer.io',
     pollInterval: 30000 // 30 seconds
   })
   ```

2. **Query Blockchain:**
   ```typescript
   // Get all revisions owned by indexer wallet
   const revisions = await computer.query({ 
     publicKey: computer.getPublicKey() 
   })
   ```

3. **Sync Objects:**
   ```typescript
   for (const rev of revisions) {
     // Deserialize contract from blockchain
     const synced = await computer.sync(rev)
     
     // Check contract type
     if (isQuizContract(synced)) {
       // Save to Quiz table
     } else if (isAttemptContract(synced)) {
       // Save to QuizAttempt table
     }
   }
   ```

4. **Database Operations:**
   - Check if contract exists (by `contractId`)
   - Create new record if not exists
   - Update existing record if changed
   - Create user records automatically
   - Link attempts to quizzes by `quizRef`

**Running the Indexer:**

```bash
# Single sync (testing)
npm run indexer:once

# Continuous sync (production)
npm run indexer:start

# Check status
npm run indexer:status
```

**Indexer State:**
- Tracks last sync timestamp in `IndexerState` table
- Logs all operations with detailed output
- Shows counts: new/updated quizzes, attempts, users

### Why We Need Both Blockchain and Database

**Blockchain (Source of Truth):**
- ✅ Immutable record of all contracts
- ✅ Cryptographic verification
- ✅ Decentralized ownership
- ✅ No single point of failure
- ❌ Slow queries
- ❌ No complex filtering
- ❌ Limited pagination

**Database (Query Layer):**
- ✅ Fast complex queries
- ✅ Filtering and sorting
- ✅ Pagination for UI
- ✅ Aggregations (counts, sums)
- ✅ Joins across tables
- ❌ Centralized
- ❌ Can become out of sync

**Together:**
- Blockchain = immutable storage
- Database = fast access layer
- Indexer = synchronization bridge

---

## 📝 Smart Contracts

### Quiz Contract

**Location:** `contracts/Quiz.js`

**Properties:**
```javascript
{
  teacher: string,              // Teacher's public key
  questionHashIPFS: string,     // IPFS hash of questions
  answerHashes: string[],       // Hashed correct answers
  questionCount: number,        // Total questions
  prizePool: bigint,            // Total prize in sats
  entryFee: bigint,             // Cost per attempt in sats
  passThreshold: number,        // % needed to pass (e.g., 70)
  platformFee: number,          // Platform fee % (e.g., 0.02 = 2%)
  deadline: number,             // Timestamp when quiz closes
  studentRevealDeadline: number,
  teacherRevealDeadline: number,
  status: string,               // 'active', 'revealed', 'completed'
  revealedAnswers: string[],    // Actual answers after reveal
  salt: string                  // Salt used for answer hashing
}
```

**Methods:**
- `reveal(answers, salt)` - Teacher reveals answers after deadline

**Answer Hashing:**
```javascript
hash = SHA256(quizId + answerIndex + answer + salt)
```

### QuizAttempt Contract

**Location:** `contracts/QuizAttempt.js`

**Properties:**
```javascript
{
  student: string,              // Student's public key
  quizRef: string,              // Reference to Quiz contract (_rev)
  answerCommitment: string,     // Hash of student's answers
  revealedAnswers: string[],    // Actual answers after reveal
  nonce: string,                // Random nonce for commitment
  score: number,                // Score after verification
  passed: boolean,              // Whether student passed
  prizeAmount: bigint,          // Prize won (if any)
  status: string,               // 'committed', 'revealed', 'verified'
  submitTimestamp: number,
  revealTimestamp: number
}
```

**Methods:**
- `reveal(answers, nonce)` - Student reveals answers after quiz deadline

**Commitment Scheme:**
```javascript
commitment = SHA256(JSON.stringify(answers) + nonce)
```

### Commit-Reveal Pattern

**Why?** Prevents students from seeing answers before submitting

**Flow:**
1. **Commit Phase (During Quiz):**
   - Student submits hash of answers
   - Cannot see other students' answers
   - Cannot change answers after submission

2. **Reveal Phase (After Deadline):**
   - Teacher reveals correct answers + salt
   - Students reveal their answers + nonce
   - System verifies commitment matches revealed answers

3. **Verification Phase:**
   - Off-chain script compares answers
   - Calculates scores
   - Distributes prizes

---

## 📊 Current State

### What's Working ✅

1. **Smart Contracts:**
   - Quiz and QuizAttempt contracts deploy successfully
   - Contracts stored on blockchain
   - Contract interactions work (methods callable)

2. **Blockchain Integration:**
   - Connection to remote regtest node ✅
   - Wallet generation and management ✅
   - Transaction signing and broadcasting ✅
   - Faucet for test funds ✅
   - Contract querying ✅
   - Object syncing ✅

3. **Database:**
   - Schema fully defined ✅
   - Migrations run successfully ✅
   - Prisma client generated ✅
   - Connection to Supabase working ✅

4. **Indexer:**
   - Queries blockchain successfully ✅
   - Syncs Quiz contracts to database ✅
   - Syncs QuizAttempt contracts to database ✅
   - Creates user records automatically ✅
   - Links attempts to quizzes ✅
   - Runs in continuous and single-run modes ✅

5. **Wallet UI:**
   - Connect wallet button ✅
   - Address display ✅
   - Balance display ✅
   - Fund from faucet ✅
   - Disconnect wallet ✅

6. **Testing:**
   - Test script deploys contracts successfully ✅
   - Gas costs verified (~1.9M sats for quiz + 2 attempts) ✅
   - Multiple students can attempt same quiz ✅

### Test Results

**Latest Test Run:**
```
Quiz Deployed: 9108a0661a8a52229944...
Attempt 1: 15eec9e5a814dd10ad7ac349...
Attempt 2: b7a8c277927cbc995df8235d...

Gas Costs:
- Started: 10,000,000 sats
- Ended: 8,095,094 sats
- Spent: 1,904,906 sats
```

**Indexer Sync Results:**
```
📊 Indexer Status:
   Quizzes: 1
   Attempts: 2
   Users: 1
```

✅ All contracts successfully synced to database!

---

## 🚀 Next Steps

### Phase 2: Quiz Creation Service

**Tasks:**
1. **Quiz Creation Form:**
   - [ ] Build UI for creating quizzes
   - [ ] Form validation
   - [ ] Question editor component
   - [ ] Answer input with validation
   - [ ] Prize pool calculator
   - [ ] Deadline picker

2. **IPFS Integration:**
   - [ ] Upload questions to IPFS
   - [ ] Get IPFS hash
   - [ ] Store hash in contract

3. **Quiz Service:**
   - [ ] `createQuiz()` function
   - [ ] Hash answers with salt
   - [ ] Deploy Quiz contract
   - [ ] Wait for transaction confirmation
   - [ ] Return contract ID

4. **API Endpoints:**
   - [ ] `POST /api/quizzes` - Create new quiz
   - [ ] `GET /api/quizzes` - List all quizzes
   - [ ] `GET /api/quizzes/[id]` - Get quiz details

### Phase 3: Quiz Taking Service

**Tasks:**
1. **Quiz Taking UI:**
   - [ ] Quiz list/browse page
   - [ ] Quiz detail page with questions
   - [ ] Answer submission form
   - [ ] Timer display
   - [ ] Progress indicator

2. **Quiz Taking Service:**
   - [ ] `attemptQuiz()` function
   - [ ] Hash answers with nonce
   - [ ] Create QuizAttempt contract
   - [ ] Pay entry fee
   - [ ] Return attempt ID

3. **Answer Reveal Service:**
   - [ ] `revealAnswers()` function (student)
   - [ ] Verify deadline passed
   - [ ] Submit answers and nonce
   - [ ] Update attempt contract

### Phase 4: Verification & Prizes

**Tasks:**
1. **Teacher Reveal:**
   - [ ] UI for teacher to reveal answers
   - [ ] `revealQuizAnswers()` function
   - [ ] Submit answers and salt
   - [ ] Update quiz status

2. **Verification Service:**
   - [ ] Off-chain verification script
   - [ ] Compare student answers to correct answers
   - [ ] Calculate scores
   - [ ] Determine winners
   - [ ] Calculate prize distribution

3. **Prize Distribution:**
   - [ ] Smart contract for prize payout
   - [ ] Transfer funds to winners
   - [ ] Update user earnings
   - [ ] Handle platform fee

### Phase 5: Advanced Features

**Tasks:**
1. **User Profile:**
   - [ ] User dashboard
   - [ ] Quiz history
   - [ ] Earnings tracker
   - [ ] Statistics

2. **Quiz Management:**
   - [ ] Edit quiz (before attempts)
   - [ ] Cancel quiz
   - [ ] Quiz analytics

3. **Leaderboard:**
   - [ ] Top earners
   - [ ] Top quiz creators
   - [ ] Recent winners

4. **Notifications:**
   - [ ] Quiz deadline reminders
   - [ ] Reveal deadline notifications
   - [ ] Prize won notifications

### Phase 6: Production Deployment

**Tasks:**
1. **Network Migration:**
   - [ ] Switch from regtest to mainnet
   - [ ] Update node URL
   - [ ] Update faucet (remove in production)
   - [ ] Test with real LTC

2. **Security:**
   - [ ] Wallet security review
   - [ ] Contract audit
   - [ ] API rate limiting
   - [ ] Input validation
   - [ ] XSS protection

3. **Performance:**
   - [ ] Indexer optimization
   - [ ] Database indexing
   - [ ] Caching layer (Redis)
   - [ ] CDN for static assets

4. **Monitoring:**
   - [ ] Error tracking (Sentry)
   - [ ] Uptime monitoring
   - [ ] Indexer health checks
   - [ ] Transaction monitoring

---

## 🔧 Technical Details

### Environment Variables

**`.env.local`:**
```env
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Bitcoin Computer
NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK=regtest
NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN=LTC
NEXT_PUBLIC_BITCOIN_COMPUTER_URL=https://rltc.node.bitcoincomputer.io

# Shared wallet for development (DO NOT USE IN PRODUCTION)
BITCOIN_COMPUTER_MNEMONIC="abandon abandon abandon..."
```

### File Structure

```
bizz/
├── contracts/
│   ├── Quiz.js                    # Quiz smart contract
│   ├── QuizAttempt.js             # Attempt smart contract
│   ├── QuizVerification.js        # Verification logic
│   └── tests/
│       └── quiz.test.js           # Contract tests
├── scripts/
│   ├── test-quiz.js               # Test deployment script
│   ├── diagnose-testnet.js        # Network diagnostic
│   └── test-report.js             # Test reporting
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Home page
│   │   └── globals.css            # Global styles
│   ├── components/
│   │   ├── wallet/
│   │   │   ├── WalletConnect.tsx  # Wallet UI component
│   │   │   └── ...
│   │   ├── quiz/
│   │   └── ui/
│   ├── contexts/
│   │   └── WalletContext.tsx      # Wallet state management
│   ├── lib/
│   │   ├── bitcoin-computer.ts    # Computer initialization
│   │   ├── prisma.ts              # Prisma client
│   │   ├── ipfs.ts                # IPFS helpers
│   │   ├── crypto.ts              # Hashing functions
│   │   └── quiz-helpers.ts        # Quiz utilities
│   ├── services/
│   │   ├── indexer.ts             # Blockchain indexer
│   │   └── indexer-cli.ts         # Indexer CLI
│   └── types/
│       ├── quiz.ts                # Quiz types
│       ├── attempt.ts             # Attempt types
│       └── user.ts                # User types
├── prisma/
│   └── schema.prisma              # Database schema
├── package.json
├── tsconfig.json
└── next.config.ts
```

### Key Commands

```bash
# Development
npm run dev                        # Start Next.js dev server

# Database
npm run db:push                    # Push schema to database
npm run db:studio                  # Open Prisma Studio
npm run db:generate                # Generate Prisma client

# Indexer
npm run indexer:start              # Start continuous indexer
npm run indexer:once               # Single sync
npm run indexer:status             # Check status

# Testing
node scripts/test-quiz.js          # Deploy test contracts
npm test                           # Run tests

# Build
npm run build                      # Production build
npm run start                      # Start production server
```

### Dependencies

**Core:**
- `next@15.1.3`
- `react@19.0.0`
- `@bitcoin-computer/lib@0.26.0-beta.0`
- `@prisma/client@5.22.0`

**Development:**
- `typescript@5`
- `@types/react@19`
- `prisma@5.22.0`
- `tsx` (for running TypeScript scripts)

---

## 📈 Success Metrics

### Current Achievements

- ✅ Smart contracts functional on blockchain
- ✅ Indexer successfully syncing 100% of contracts
- ✅ Database schema validated with real data
- ✅ Wallet integration working seamlessly
- ✅ Test coverage for contract deployment
- ✅ Gas costs measured and acceptable

### Next Milestones

1. **Quiz Creation Live:** Teachers can create quizzes via UI
2. **Quiz Taking Live:** Students can attempt quizzes and pay entry fees
3. **Full Reveal Cycle:** Complete commit-reveal-verify flow working
4. **First Prize Payout:** First successful prize distribution
5. **Mainnet Launch:** Platform live on Litecoin mainnet

---

## 🎉 Summary

**What We Built:**
A fully functional blockchain indexer that syncs decentralized quiz contracts to a PostgreSQL database, enabling fast queries while maintaining blockchain immutability. The system includes wallet integration, smart contracts, and a complete data pipeline from blockchain to database.

**Key Innovation:**
Hybrid architecture combining blockchain immutability with database performance, using a background indexer to keep both systems in sync.

**Production Readiness:**
- Infrastructure: ✅ Ready
- Smart Contracts: ✅ Tested and working
- Database: ✅ Schema validated
- Indexer: ✅ Syncing successfully
- Frontend Services: 🚧 In progress (Phases 2-3)

**Next Priority:**
Build quiz creation service and UI so teachers can deploy real quizzes.

---

**Contact:** ravishan@bizz.quiz  
**Repository:** [Add your repo URL]  
**Live Demo:** [Add demo URL when available]
