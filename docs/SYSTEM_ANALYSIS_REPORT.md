# Bizz Quiz Platform - System Analysis Report

## Executive Summary

**Bizz** is a decentralized quiz platform built on the Bitcoin Computer blockchain (Litecoin). It enables teachers to create incentivized quizzes with cryptocurrency rewards, and students to earn crypto by passing quizzes. The system uses a **commit-reveal pattern** to ensure fair, tamper-proof quiz submissions.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [System Architecture](#2-system-architecture)
3. [Blockchain Integration](#3-blockchain-integration)
4. [Smart Contracts](#4-smart-contracts)
5. [Wallet System](#5-wallet-system)
6. [IPFS Integration](#6-ipfs-integration)
7. [Database Design](#7-database-design)
8. [Security Implementation](#8-security-implementation)
9. [Core Workflows](#9-core-workflows)
10. [Q&A: Technology Decisions](#10-qa-technology-decisions)
11. [Current TODOs & Improvements](#11-current-todos--improvements)

---

## 1. Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.1 | React framework with App Router |
| React | 19.2.3 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling |
| Radix UI | Latest | Accessible UI components |
| Lucide React | 0.562.0 | Icons |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js API Routes | - | Server-side API endpoints |
| NextAuth.js | 4.24.13 | Authentication (credentials-based) |
| Prisma | 5.22.0 | ORM for PostgreSQL |
| bcryptjs | 3.0.3 | Password hashing |

### Blockchain
| Technology | Version | Purpose |
|------------|---------|---------|
| Bitcoin Computer | 0.26.0-beta.0 | Smart contract platform |
| BIP39 | 3.1.0 | Mnemonic generation |
| Crypto-JS | 4.2.0 | Hashing & encryption |

### Storage
| Technology | Purpose |
|------------|---------|
| PostgreSQL | Primary database (via Supabase) |
| IPFS (Pinata) | Decentralized storage for quiz questions |

---

## 2. System Architecture

```
                    +------------------+
                    |   Frontend UI    |
                    |  (Next.js Pages) |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------v---------+      +-----------v-----------+
    |   NextAuth.js     |      |    API Routes         |
    |  (Authentication) |      | /api/quizzes/*        |
    +--------+----------+      | /api/attempts/*       |
             |                 | /api/wallet/*         |
             v                 +-----------+-----------+
    +------------------+                   |
    |   User Session   |                   v
    |   (JWT Tokens)   |       +-----------+-----------+
    +------------------+       |     Services Layer    |
                               | - quiz-service.ts     |
                               | - attempt-service.ts  |
                               | - wallet-service.ts   |
                               +-----------+-----------+
                                           |
              +----------------------------+----------------------------+
              |                            |                            |
    +---------v---------+      +-----------v-----------+    +-----------v-----------+
    |   Bitcoin Computer |     |     PostgreSQL        |    |       IPFS            |
    |   (Blockchain)     |     |   (via Prisma ORM)    |    |   (via Pinata)        |
    +-------------------+      +-----------------------+    +-----------------------+
```

### Data Flow Pattern

1. **User Authentication**: Email/password via NextAuth.js with JWT sessions
2. **Wallet Creation**: Auto-generated custodial wallets (BIP39 mnemonics encrypted in DB)
3. **Quiz Creation**: Questions → IPFS, Contract → Blockchain, Metadata → PostgreSQL
4. **Attempt Submission**: Commitment hash → Blockchain, Encrypted data → PostgreSQL
5. **Reveal Phase**: Decrypt stored data → Reveal on blockchain → Score calculation

---

## 3. Blockchain Integration

### Platform: Bitcoin Computer

**Location**: [src/lib/bitcoin-computer.ts](src/lib/bitcoin-computer.ts)

```typescript
// Default configuration
{
  chain: 'LTC',           // Litecoin
  network: 'regtest',     // Development network
  url: 'https://rltc.node.bitcoincomputer.io'
}
```

### Why Bitcoin Computer?

| Reason | Explanation |
|--------|-------------|
| **JavaScript Contracts** | Write smart contracts in JavaScript, not Solidity |
| **Low Transaction Fees** | Litecoin has lower fees than Ethereum |
| **Escrow Built-in** | `_satoshis` property locks value in contracts |
| **Simple API** | `computer.deploy()` and `computer.encode()` for contract operations |
| **No Gas Estimation** | Simpler than EVM-based chains |

### Contract Deployment Flow

```typescript
// 1. Define contract as string (pure JavaScript)
const QuizContract = `export class Quiz extends Contract { ... }`

// 2. Deploy the module
const moduleSpecifier = await computer.deploy(QuizContract)

// 3. Create instance
const { tx, effect } = await computer.encode({
  mod: moduleSpecifier,
  exp: `new Quiz(...params)`
})

// 4. Broadcast transaction
const txId = await computer.broadcast(tx)
```

### Network Configuration

| Environment | Network | URL |
|-------------|---------|-----|
| Development | regtest | https://rltc.node.bitcoincomputer.io |
| Testing | testnet | (configurable) |
| Production | mainnet | (configurable) |

---

## 4. Smart Contracts

### 4.1 Quiz Contract

**Location**: [public/contracts/Quiz.js](public/contracts/Quiz.js)

**Purpose**: Represents a quiz created by a teacher with prize pool escrow.

#### State Properties

| Property | Type | Description |
|----------|------|-------------|
| `_owners` | string[] | Teacher's public key (owner) |
| `_satoshis` | bigint | Prize pool locked in contract |
| `teacher` | string | Teacher's public key |
| `questionHashIPFS` | string | IPFS CID of questions |
| `answerHashes` | string[] | SHA256 hashes of correct answers |
| `entryFee` | bigint | Cost to attempt (min 5,000 sats) |
| `prizePool` | bigint | Total prize (min 10,000 sats) |
| `passThreshold` | number | Score needed to win (0-100) |
| `deadline` | number | Submission deadline (Unix ms) |
| `studentRevealDeadline` | number | When students must reveal |
| `teacherRevealDeadline` | number | When teacher must reveal |
| `status` | string | 'active' | 'revealed' | 'completed' | 'refunded' |
| `revealedAnswers` | string[] | Correct answers (after reveal) |

#### Methods

| Method | Caller | Description |
|--------|--------|-------------|
| `getInfo()` | Anyone | Returns quiz metadata (no answers) |
| `revealAnswers(answers, salt)` | Teacher | Publishes correct answers |
| `complete(winners)` | System | Marks quiz as completed |
| `triggerRefund()` | Anyone | Initiates refund if teacher didn't reveal |

#### State Transitions

```
ACTIVE → (teacher reveals) → REVEALED → (winners calculated) → COMPLETED
   ↓
(teacher doesn't reveal)
   ↓
REFUNDED
```

### 4.2 QuizAttempt Contract

**Location**: [contracts/QuizAttempt.js](contracts/QuizAttempt.js)

**Purpose**: Represents a student's quiz attempt with commit-reveal pattern.

#### State Properties

| Property | Type | Description |
|----------|------|-------------|
| `_owners` | string[] | Student's public key |
| `_satoshis` | bigint | Entry fee locked |
| `student` | string | Student's public key |
| `quizRef` | string | Reference to Quiz contract |
| `answerCommitment` | string | SHA256(answers + nonce) |
| `revealedAnswers` | string[] | Actual answers (after reveal) |
| `nonce` | string | Random string used in commitment |
| `score` | number | Calculated score (0-100) |
| `passed` | boolean | Whether student passed |
| `status` | string | 'committed' | 'revealed' | 'verified' | 'failed' |

#### Methods

| Method | Caller | Description |
|--------|--------|-------------|
| `reveal(answers, nonce)` | Student | Reveals actual answers |
| `verify(score, passed)` | System | Sets final score |
| `fail()` | System | Marks as failed (didn't reveal) |
| `getInfo()` | Anyone | Returns attempt information |

### 4.3 QuizVerification (Helper)

**Location**: [contracts/QuizVerification.js](contracts/QuizVerification.js)

**Purpose**: Off-chain scoring and verification logic.

#### Functions

| Function | Purpose |
|----------|---------|
| `calculateScore(studentAnswers, correctAnswers)` | Returns percentage score |
| `didPass(score, threshold, totalQuestions)` | Determines pass/fail |
| `verifyQuiz(quiz, attempts)` | Processes all attempts for a quiz |
| `calculatePayouts(quiz, winners)` | Calculates prize distribution |
| `calculateRefunds(quiz)` | Calculates refund amounts |

---

## 5. Wallet System

### 5.1 Custodial Wallet Architecture

**Location**: [src/lib/wallet-service.ts](src/lib/wallet-service.ts)

The platform uses **custodial wallets** - the platform manages wallet keys on behalf of users.

#### Why Custodial Wallets?

| Reason | Explanation |
|--------|-------------|
| **Better UX** | Users don't need to manage private keys |
| **Simpler Onboarding** | Email/password login, wallet auto-created |
| **Recovery** | Platform can help recover access |
| **No Browser Extension** | Works on any device |

#### Wallet Creation Flow

```typescript
// 1. Generate BIP39 mnemonic (12 words)
const mnemonic = await generateMnemonic()

// 2. Encrypt mnemonic with AES-256
const encrypted = encryptMnemonic(mnemonic, WALLET_ENCRYPTION_KEY)

// 3. Store encrypted mnemonic in database
await prisma.user.update({
  data: {
    encryptedMnemonic: encrypted,
    walletType: 'CUSTODIAL',
    address: computer.getAddress(),
    publicKey: computer.getPublicKey()
  }
})

// 4. Fund wallet from faucet (regtest only)
await computer.faucet(0.1e8)
```

### 5.2 Wallet Operations

| Operation | Implementation |
|-----------|---------------|
| **Create** | Auto-created on user signup |
| **Fund** | Faucet (regtest) or transfer (mainnet) |
| **Check Balance** | `computer.getBalance()` |
| **Sign Transactions** | Automatic via custodial mnemonic |

### 5.3 Security Measures

| Measure | Implementation |
|---------|----------------|
| **Mnemonic Encryption** | AES-256 via `WALLET_ENCRYPTION_KEY` |
| **Key Storage** | Environment variable, never in code |
| **Decryption** | Server-side only, never in browser |

---

## 6. IPFS Integration

### 6.1 Purpose

**Location**: [src/lib/ipfs.ts](src/lib/ipfs.ts)

IPFS (InterPlanetary File System) stores quiz questions in a decentralized manner.

### Why IPFS?

| Reason | Explanation |
|--------|-------------|
| **Immutability** | Content-addressed - CID changes if content changes |
| **Decentralization** | No single point of failure |
| **Cost Efficiency** | Store large data off-chain, only hash on-chain |
| **Censorship Resistance** | Content persists across multiple nodes |

### 6.2 Implementation

#### Upload (via Pinata)

```typescript
export async function uploadQuestionsToIPFS(questions: QuizQuestion[]): Promise<string> {
  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PINATA_JWT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pinataContent: questions,
      pinataMetadata: { name: `quiz-questions-${Date.now()}.json` }
    })
  })

  return data.IpfsHash // CID like "Qm..."
}
```

#### Fetch (Multiple Gateways)

```typescript
const gateways = [
  `https://ipfs.io/ipfs/${ipfsHash}`,
  `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
  `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
]

// Try each gateway until one succeeds
```

### 6.3 Data Stored on IPFS

| Data | Format | Contains |
|------|--------|----------|
| Quiz Questions | JSON array | `[{ question: string, options: string[] }]` |

**Note**: Correct answers are **NOT** stored on IPFS - only hashes are stored on blockchain.

---

## 7. Database Design

### 7.1 Schema Overview

**Location**: [prisma/schema.prisma](prisma/schema.prisma)

```
+------------------+       +------------------+       +------------------+
|      User        |       |       Quiz       |       |   QuizAttempt    |
+------------------+       +------------------+       +------------------+
| id               |<----->| teacherId        |       | studentId        |
| email            |       | contractId       |<----->| quizId           |
| passwordHash     |       | questionHashIPFS |       | contractId       |
| encryptedMnemonic|       | answerHashes     |       | answerCommitment |
| address          |       | prizePool        |       | score            |
| publicKey        |       | entryFee         |       | passed           |
| role             |       | deadline         |       | status           |
| walletBalance    |       | status           |       +------------------+
+------------------+       +------------------+
                                   |
                           +-------v-------+
                           |    Winner     |
                           +---------------+
                           | quizId        |
                           | attemptId     |
                           | prizeAmount   |
                           | paid          |
                           +---------------+
```

### 7.2 Key Models

#### User Model
```prisma
model User {
  id                String   @id @default(cuid())
  email             String?  @unique
  passwordHash      String?
  publicKey         String?  @unique
  address           String?  @unique
  encryptedMnemonic String?           // Encrypted BIP39 mnemonic
  walletType        String   @default("CUSTODIAL")
  walletBalance     BigInt   @default(0)
  role              Role     @default(STUDENT)  // TEACHER | STUDENT | BOTH
  totalEarnings     BigInt   @default(0)
  quizzesCreated    Int      @default(0)
  quizzesTaken      Int      @default(0)
}
```

#### Quiz Model
```prisma
model Quiz {
  id                    String     @id @default(cuid())
  contractId            String     @unique    // Blockchain contract ID
  contractRev           String     @unique    // Blockchain revision
  teacherId             String
  questions             Json?                 // Backup of questions
  questionHashIPFS      String                // IPFS CID
  answerHashes          String[]              // SHA256 hashes
  hashingQuizId         String?               // Used for hash verification
  prizePool             BigInt
  entryFee              BigInt
  passThreshold         Int
  deadline              DateTime
  studentRevealDeadline DateTime
  teacherRevealDeadline DateTime
  status                QuizStatus @default(ACTIVE)
  encryptedRevealData   String?               // Encrypted answers + salt
  salt                  String?
}
```

### 7.3 Why PostgreSQL + Blockchain?

| Data Location | What | Why |
|---------------|------|-----|
| **Blockchain** | Contracts, commitments, reveals | Immutability, trustless verification |
| **PostgreSQL** | User accounts, quiz metadata, indexes | Fast queries, relationships, sessions |
| **IPFS** | Quiz questions | Decentralized, content-addressed |

---

## 8. Security Implementation

### 8.1 Cryptographic Utilities

**Location**: [src/lib/crypto.ts](src/lib/crypto.ts)

#### Answer Hashing (Teacher)

```typescript
// Format: SHA256(quizId + index + answer + salt)
export function hashAnswer(quizId: string, index: number, answer: string, salt: string): string {
  const data = `${quizId}${index}${answer}${salt}`
  return CryptoJS.SHA256(data).toString()
}
```

**Purpose**: Teachers store hashed answers on-chain. Nobody can see correct answers until teacher reveals.

#### Commitment Hashing (Student)

```typescript
// Format: SHA256(JSON.stringify(answers) + nonce)
export function hashCommitment(answers: string[], nonce: string): string {
  const data = JSON.stringify(answers) + nonce
  return CryptoJS.SHA256(data).toString()
}
```

**Purpose**: Students commit to answers before deadline. After deadline, they reveal answers + nonce to prove commitment.

### 8.2 Commit-Reveal Pattern

**Why?** Prevents cheating in a decentralized environment.

```
Timeline:
─────────────────────────────────────────────────────────────────────────────
|           COMMIT PHASE           |    STUDENT REVEAL    |  TEACHER REVEAL  |
|    (Students submit hashes)      |   (Reveal answers)   |  (Grade + Pay)   |
─────────────────────────────────────────────────────────────────────────────
         ↑                          ↑                       ↑
     Quiz Created              Deadline               Teacher Deadline
```

| Phase | What Happens | Security Guarantee |
|-------|--------------|-------------------|
| **Commit** | Student submits `hash(answers + nonce)` | Answers hidden, can't be changed later |
| **Student Reveal** | Student reveals `answers + nonce` | Proves they knew answers before deadline |
| **Teacher Reveal** | Teacher reveals correct answers | Students can verify scoring |

### 8.3 Encryption

| Data | Encryption | Key |
|------|------------|-----|
| Wallet Mnemonics | AES-256 | `WALLET_ENCRYPTION_KEY` |
| Quiz Reveal Data | AES-256 | `REVEAL_DATA_KEY` |
| Attempt Reveal Data | AES-256 | `REVEAL_DATA_KEY` |

### 8.4 Authentication

| Feature | Implementation |
|---------|----------------|
| **Password Storage** | bcrypt (10 rounds) |
| **Session Management** | JWT via NextAuth.js |
| **Session Duration** | 30 days |
| **Token Security** | Server-side `NEXTAUTH_SECRET` |

---

## 9. Core Workflows

### 9.1 User Registration

```
User fills signup form
        ↓
Validate email/password
        ↓
Hash password with bcrypt
        ↓
Create user in PostgreSQL
        ↓
Generate BIP39 mnemonic
        ↓
Encrypt mnemonic (AES-256)
        ↓
Store encrypted mnemonic in DB
        ↓
Fund wallet from faucet (regtest)
        ↓
Return success + wallet address
```

**API Route**: [src/app/api/auth/signup/route.ts](src/app/api/auth/signup/route.ts)

### 9.2 Quiz Creation (Teacher)

```
Teacher fills quiz form
        ↓
Validate inputs (prizePool >= 10k, entryFee >= 5k, etc.)
        ↓
Generate random salt
        ↓
Hash correct answers: SHA256(quizId + index + answer + salt)
        ↓
Upload questions to IPFS (via Pinata)
        ↓
Get teacher's custodial wallet
        ↓
Deploy Quiz contract to blockchain
        ↓
Save quiz to PostgreSQL
        ↓
Encrypt and store reveal data (answers + salt)
        ↓
Return quizId to teacher
```

**API Route**: [src/app/api/quizzes/create/route.ts](src/app/api/quizzes/create/route.ts)

### 9.3 Quiz Attempt (Student)

```
Student browses available quizzes
        ↓
Student selects quiz and confirms entry fee
        ↓
Validate: deadline not passed, quiz is ACTIVE
        ↓
Student answers all questions
        ↓
Generate random nonce
        ↓
Create commitment: SHA256(answers + nonce)
        ↓
Get student's custodial wallet
        ↓
Deploy QuizAttempt contract (locks entry fee)
        ↓
Save attempt to PostgreSQL
        ↓
Encrypt and store reveal data (answers + nonce)
        ↓
Return attemptId to student
```

**API Route**: [src/app/api/attempts/submit/route.ts](src/app/api/attempts/submit/route.ts)

### 9.4 Student Reveal

```
After quiz deadline passes
        ↓
Student clicks "Reveal Answers"
        ↓
Server decrypts stored answers + nonce
        ↓
Verify commitment: SHA256(answers + nonce) === stored commitment
        ↓
Call attempt.reveal(answers, nonce) on blockchain
        ↓
Update attempt status to REVEALED
        ↓
Wait for teacher reveal
```

**API Route**: [src/app/api/attempts/[id]/reveal/route.ts](src/app/api/attempts/[id]/reveal/route.ts)

### 9.5 Teacher Reveal & Grading

```
After student reveal window closes
        ↓
Teacher clicks "Reveal & Grade"
        ↓
Server decrypts stored answers + salt
        ↓
Call quiz.revealAnswers(answers, salt) on blockchain
        ↓
For each revealed attempt:
    → Calculate score = (correct / total) * 100
    → Determine pass/fail based on threshold
    → Call attempt.verify(score, passed)
        ↓
Update quiz status to REVEALED
        ↓
Distribute prizes to winners
```

**API Route**: [src/app/api/quizzes/[id]/reveal/route.ts](src/app/api/quizzes/[id]/reveal/route.ts)

---

## 10. Q&A: Technology Decisions

### Q: Why use Bitcoin Computer instead of Ethereum?

**A:**
1. **JavaScript contracts** - No need to learn Solidity
2. **Lower fees** - Litecoin has much lower transaction fees
3. **Simpler mental model** - Objects on blockchain vs. complex EVM
4. **Built-in escrow** - `_satoshis` property automatically locks value
5. **UTXO-based** - Better for value transfer use cases

### Q: Why custodial wallets instead of letting users connect their own?

**A:**
1. **UX simplicity** - Users don't need MetaMask or any wallet extension
2. **Cross-device** - Works on mobile, desktop, any browser
3. **Key recovery** - Platform can help recover access
4. **Onboarding** - Email/password is familiar to everyone
5. **Reduced friction** - No blockchain knowledge required

### Q: Why store data in both PostgreSQL and blockchain?

**A:**
| PostgreSQL | Blockchain |
|------------|------------|
| Fast queries for UI | Immutable record of truth |
| User accounts & sessions | Contract state & escrow |
| Quiz metadata & indexes | Commitment proofs |
| Encrypted reveal data | Revealed answers |

### Q: Why IPFS for questions instead of storing on-chain?

**A:**
1. **Cost** - Storing large text on-chain is expensive
2. **Size limits** - Blockchain has practical data size limits
3. **Content addressing** - IPFS CID proves content hasn't changed
4. **Decentralization** - Questions available even if platform goes down

### Q: Why the commit-reveal pattern?

**A:** Without it, in a decentralized environment:
1. Teacher could see student answers and change correct answers
2. Students could copy answers from each other
3. Late submissions could see early answers

The pattern ensures:
- Nobody can see answers until everyone commits
- Nobody can change answers after committing
- Fair timing for all participants

### Q: Why encrypt reveal data in the database?

**A:**
1. **Security** - Even if DB is breached, answers are protected
2. **Cross-device** - Students can reveal from any device
3. **No localStorage** - Doesn't depend on browser storage
4. **Backup** - Data persists even if user clears browser

### Q: Why use NextAuth.js for authentication?

**A:**
1. **Battle-tested** - Widely used, security audited
2. **JWT sessions** - Stateless, scalable
3. **Flexible** - Can add OAuth providers later
4. **Next.js integration** - First-class support

---

## 11. Current TODOs & Improvements

### High Priority

| Task | Description | Location |
|------|-------------|----------|
| Prize Distribution | Implement actual LTC transfer to winners | Quiz reveal API |
| Entry Fee Transfer | Transfer entry fees to teacher after grading | Quiz reveal API |
| Platform Fee | Collect 2% platform fee from entry fees | Quiz reveal API |
| Balance Refresh | Refresh wallet balance after transactions | Wallet service |

### Medium Priority

| Task | Description | Location |
|------|-------------|----------|
| Indexer Integration | Auto-sync blockchain data to DB | Indexer service |
| Transaction Tracking | Track all transactions in DB | Transaction model |
| Email Notifications | Notify on quiz deadlines, results | Email service (new) |
| Rate Limiting | Prevent API abuse | API middleware |

### Low Priority / Enhancements

| Task | Description | Location |
|------|-------------|----------|
| Quiz Categories | Add categories/tags to quizzes | Quiz model |
| Leaderboard | Show top earners, quiz stats | New page |
| Quiz Search | Full-text search for quizzes | Search API |
| Quiz Preview | Allow teacher to preview quiz | Create page |
| Analytics | Track user engagement, quiz performance | Analytics service |

### Security Improvements

| Task | Description | Location |
|------|-------------|----------|
| Rate Limiting | Limit API calls per user/IP | Middleware |
| Input Sanitization | Sanitize all user inputs | API routes |
| CORS Configuration | Restrict origins in production | Next.js config |
| Audit Logging | Log sensitive operations | Logging service |
| Key Rotation | Implement encryption key rotation | Crypto utilities |

### Production Readiness

| Task | Description | Location |
|------|-------------|----------|
| Mainnet Support | Switch from regtest to mainnet | Environment config |
| Error Monitoring | Add Sentry or similar | Error handler |
| Performance Monitoring | Add APM tools | Middleware |
| Backup Strategy | Database and key backups | DevOps |
| Load Testing | Test under high load | Testing suite |

---

## File Reference Guide

### Core Configuration
- [package.json](package.json) - Dependencies and scripts
- [prisma/schema.prisma](prisma/schema.prisma) - Database schema
- [.env.example](.env.example) - Environment variables template

### Smart Contracts
- [public/contracts/Quiz.js](public/contracts/Quiz.js) - Quiz contract (deployed version)
- [contracts/Quiz.js](contracts/Quiz.js) - Quiz contract (source)
- [contracts/QuizAttempt.js](contracts/QuizAttempt.js) - Attempt contract
- [contracts/QuizVerification.js](contracts/QuizVerification.js) - Verification helpers

### Blockchain & Wallet
- [src/lib/bitcoin-computer.ts](src/lib/bitcoin-computer.ts) - Blockchain configuration
- [src/lib/wallet-service.ts](src/lib/wallet-service.ts) - Custodial wallet service
- [src/contexts/WalletContext.tsx](src/contexts/WalletContext.tsx) - Wallet React context

### Security & Crypto
- [src/lib/crypto.ts](src/lib/crypto.ts) - Hashing and encryption utilities
- [src/lib/auth.ts](src/lib/auth.ts) - NextAuth configuration

### Services
- [src/services/quiz-service.ts](src/services/quiz-service.ts) - Quiz operations
- [src/services/attempt-service.ts](src/services/attempt-service.ts) - Attempt operations
- [src/services/indexer.ts](src/services/indexer.ts) - Blockchain indexer

### API Routes
- [src/app/api/quizzes/create/route.ts](src/app/api/quizzes/create/route.ts) - Create quiz
- [src/app/api/attempts/submit/route.ts](src/app/api/attempts/submit/route.ts) - Submit attempt
- [src/app/api/quizzes/[id]/reveal/route.ts](src/app/api/quizzes/[id]/reveal/route.ts) - Teacher reveal
- [src/app/api/attempts/[id]/reveal/route.ts](src/app/api/attempts/[id]/reveal/route.ts) - Student reveal
- [src/app/api/auth/signup/route.ts](src/app/api/auth/signup/route.ts) - User registration

### Frontend Pages
- [src/app/teacher/create/page.tsx](src/app/teacher/create/page.tsx) - Create quiz UI
- [src/app/student/take/[id]/page.tsx](src/app/student/take/[id]/page.tsx) - Take quiz UI
- [src/app/teacher/reveal/[id]/page.tsx](src/app/teacher/reveal/[id]/page.tsx) - Teacher reveal UI
- [src/app/student/reveal/[id]/page.tsx](src/app/student/reveal/[id]/page.tsx) - Student reveal UI

---

*Report generated: January 2026*
*Based on analysis of: feature/contracts-uploads-to-blockchain branch*
