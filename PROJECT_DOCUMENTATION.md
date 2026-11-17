# Bizz — Complete Project Documentation

> **Last updated:** 2026-06-30  
> **Branch:** updated-architecture  
> **Knowledge graph:** 136 files · 1,079 nodes · 11,221 edges · 10 communities

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Purpose & Vision](#2-purpose--vision)
3. [Architecture Overview](#3-architecture-overview)
4. [Tech Stack](#4-tech-stack)
5. [Monorepo Structure](#5-monorepo-structure)
6. [Smart Contracts](#6-smart-contracts)
7. [Backend — NestJS API](#7-backend--nestjs-api)
8. [Frontend — Next.js](#8-frontend--nextjs)
9. [Database Schema](#9-database-schema)
10. [End-to-End Flows](#10-end-to-end-flows)
11. [Cryptography & Privacy Model](#11-cryptography--privacy-model)
12. [Environment Variables](#12-environment-variables)
13. [API Reference](#13-api-reference)
14. [Deployment](#14-deployment)
15. [Security Design](#15-security-design)
16. [Key Design Decisions & Trade-offs](#16-key-design-decisions--trade-offs)
17. [Development Guide](#17-development-guide)

---

## 1. Project Overview

**Bizz** is a decentralised quiz platform built on the **Bitcoin Computer** protocol (Litecoin Regtest). Teachers create competitive quizzes with on-chain prize pools; students compete by paying Bitcoin-based entry fees and earn cryptocurrency rewards. Every access-control, payment, and prize-distribution action is governed by smart contracts — no intermediary can manipulate results or steal funds.

The platform solves a real problem in online education: how to make quiz competition provably fair and incentivise learning through real financial stakes — without trusting a centralised server.

---

## 2. Purpose & Vision

### Problem
Traditional online quizzes have no trustless way to:
- Prove that answer keys were not changed after students submitted
- Guarantee that prizes are paid to winners without a middleman
- Allow multiple students to pay entry fees without blockchain UTXO conflicts

### Solution
Bizz uses:

| Mechanism | How it solves the problem |
|---|---|
| **IPFS** | Quiz questions are stored publicly and permanently — questions cannot be altered after creation |
| **Hash commitment scheme** | Answer hashes are stored on-chain before answers are revealed — teacher cannot change correct answers retroactively |
| **Atomic swaps** | Prize payment and answer proof are exchanged simultaneously on-chain — neither party can cheat |
| **On-demand token minting** | Each student gets a unique quiz token minted just for them — concurrent students never share a UTXO |
| **Custodial wallets** | Backend manages wallets so students/teachers never need MetaMask or a separate wallet app |

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      User's Browser                          │
│              Next.js Frontend (Port 3000)                    │
│   Teacher UI │ Student UI │ Auth │ Wallet Widget             │
│   Zustand state │ React contexts │ Tailwind + Radix UI       │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTP/REST (JWT auth)
┌───────────────────────────▼──────────────────────────────────┐
│               NestJS Backend (Port 3001)                     │
│                                                              │
│  ┌──────────┐ ┌──────┐ ┌────────────────┐ ┌──────────────┐  │
│  │   Auth   │ │ Quiz │ │ AccessRequest  │ │ QuizAttempt  │  │
│  └──────────┘ └──────┘ └────────────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────┐ ┌─────────────────────────────────┐  │
│  │  Prize   │ │Wallet│ │  ComputerManager (singleton)    │  │
│  └──────────┘ └──────┘ └─────────────────────────────────┘  │
│                                                              │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────────┐ │
│  │  PostgreSQL  │   │    Pinata    │   │  Bitcoin Computer │ │
│  │  (Prisma 5) │   │ (IPFS upload)│   │   (LTC Regtest)   │ │
│  └─────────────┘   └──────────────┘   └─────────┬─────────┘ │
└────────────────────────────────────────────────┼────────────┘
                                                 │
┌────────────────────────────────────────────────▼────────────┐
│              Bitcoin Computer (Litecoin Regtest)             │
│                                                              │
│  Token · Quiz · Payment · QuizAccess · QuizAttempt           │
│  QuizRedemption · AnswerProof · PrizeSwap                    │
└──────────────────────────────────────────────────────────────┘
```

### Core Architectural Principle

> **The backend is the sole blockchain actor.** The frontend never touches the chain directly. Every on-chain transaction is initiated, signed, and broadcast by the NestJS backend using the user's custodial wallet (mnemonic stored encrypted in PostgreSQL).

This enables a wallet-free UX while keeping all cryptographic guarantees of on-chain settlement.

### Data Layering

| Layer | Role |
|---|---|
| **Blockchain** | Source of truth — owns asset state (tokens, payments, attempts) |
| **IPFS (Pinata)** | Immutable off-chain storage for quiz questions (no answers) |
| **PostgreSQL** | Query cache and coordination layer — indexes blockchain data for fast reads |
| **Frontend** | Presentation only — reads from the backend API, never from the chain directly |

---

## 4. Tech Stack

| Layer | Technology | Version | Role |
|---|---|---|---|
| Frontend framework | Next.js | 16.x | SSR/CSR React framework |
| UI library | React | 19.x | Component model |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| Components | Radix UI | Latest | Accessible primitives |
| State management | Zustand | 5.x | Global auth/wallet state with localStorage persistence |
| Backend framework | NestJS | 11.x | Modular Node.js API framework |
| ORM | Prisma | 5.x | Type-safe DB client with migrations |
| Database | PostgreSQL | 14+ | Relational data store and query cache |
| Authentication | JWT + Passport | — | Stateless JWT auth via `@nestjs/jwt` and `passport-jwt` |
| Password hashing | bcryptjs | — | 10-round bcrypt for password storage |
| Blockchain SDK | Bitcoin Computer | 0.26.x | Smart contract runtime on UTXO chains |
| Smart contract language | TypeScript → JS | — | Contracts written in TS, compiled to JS for deployment |
| Blockchain network | Litecoin Regtest | — | Local/test Bitcoin-compatible chain |
| IPFS storage | Pinata | — | Pinned IPFS storage via REST API |
| Process manager | PM2 | Latest | Production process management with auto-restart |
| Web server | Nginx | Latest | Reverse proxy for both frontend and backend |
| Hosting | AWS EC2 t3.micro | — | Single-instance deployment |
| Scheduling | `@nestjs/schedule` | — | Cron job for auto-revealing expired quizzes |

---

## 5. Monorepo Structure

```
bizz/                               ← npm workspace root
├── package.json                    ← workspace config, shared scripts
│
├── app/
│   ├── backend/                    ← NestJS REST API (port 3001)
│   │   ├── src/
│   │   │   ├── main.ts             ← Bootstrap: CORS, ValidationPipe, listen
│   │   │   ├── app.module.ts       ← Root module — imports all feature modules
│   │   │   ├── app.controller.ts   ← Health check endpoint
│   │   │   ├── common/
│   │   │   │   ├── computer-manager.ts   ← Singleton: one Computer per mnemonic
│   │   │   │   └── ipfs.service.ts       ← Pinata upload, hash/salt utilities
│   │   │   └── modules/
│   │   │       ├── auth/           ← Signup, login, JWT, wallet creation
│   │   │       │   ├── auth.controller.ts
│   │   │       │   ├── auth.service.ts
│   │   │       │   ├── auth.module.ts
│   │   │       │   ├── dto/        ← SignupDto, LoginDto
│   │   │       │   ├── guards/     ← JwtAuthGuard (protects all API routes)
│   │   │       │   └── strategies/ ← JwtStrategy (extracts user from token)
│   │   │       ├── quiz/           ← Create/list/reveal quizzes + auto-reveal cron
│   │   │       │   ├── quiz.controller.ts
│   │   │       │   ├── quiz.service.ts
│   │   │       │   ├── quiz.module.ts
│   │   │       │   ├── dto/        ← CreateQuizDto, CreateQuizUIDto, RevealAnswersDto
│   │   │       │   └── guards/     ← TeacherGuard
│   │   │       ├── access-request/ ← Student access flow (request → pay → start)
│   │   │       │   ├── access-request.controller.ts
│   │   │       │   ├── access-request.service.ts
│   │   │       │   └── dto/        ← CreateAccessRequestDto
│   │   │       ├── quiz-attempt/   ← Submit commitment, verify attempt
│   │   │       │   ├── quiz-attempt.controller.ts
│   │   │       │   └── quiz-attempt.service.ts
│   │   │       ├── prize/          ← AnswerProof, PrizePayment, SWAP execution
│   │   │       │   ├── prize.controller.ts
│   │   │       │   └── prize.service.ts
│   │   │       └── wallet/         ← Balance query, faucet (regtest)
│   │   │           ├── wallet.controller.ts
│   │   │           └── wallet.service.ts
│   │   └── prisma/
│   │       ├── schema.prisma       ← All models, enums, relations
│   │       └── migrations/         ← Migration history (Prisma Migrate)
│   │
│   └── web/                        ← Next.js frontend (port 3000)
│       └── src/
│           ├── app/
│           │   ├── layout.tsx      ← Root layout (fonts, providers)
│           │   ├── page.tsx        ← Landing page
│           │   ├── auth/
│           │   │   ├── signin/page.tsx
│           │   │   └── signup/page.tsx
│           │   ├── teacher/
│           │   │   ├── create/page.tsx      ← Quiz creation form
│           │   │   ├── dashboard/page.tsx   ← Teacher's quizzes + student progress
│           │   │   └── reveal/[id]/page.tsx ← Trigger answer reveal
│           │   └── student/
│           │       ├── browse/page.tsx      ← Discover available quizzes
│           │       ├── dashboard/page.tsx   ← Student's attempts + status
│           │       ├── take/[id]/page.tsx   ← Submit answers
│           │       └── prize/[id]/page.tsx  ← Claim prize flow
│           ├── components/
│           │   ├── ui/             ← Badge, Button, Card, Input, Toast, CountdownTimer, etc.
│           │   ├── auth/           ← ProtectedRoute, RoleSelector
│           │   ├── navigation/     ← AppHeader, LandingNav
│           │   ├── quiz/           ← ClaimPrizeButton, PaymentStatus, QuizFinancialDetails, etc.
│           │   └── wallet/         ← WalletBalance, WalletConnect
│           ├── contexts/
│           │   ├── AuthContext.tsx      ← React context wrapping authStore
│           │   └── WalletContext.tsx    ← Wallet balance polling
│           ├── lib/
│           │   ├── api.ts          ← Axios/fetch wrapper with JWT Authorization header
│           │   ├── bitcoin-computer.ts ← Client-side BC utilities (unused in prod — backend handles BC)
│           │   ├── crypto.ts       ← Commitment generation (hash answers + nonce)
│           │   └── ipfs.ts         ← IPFS gateway fetch (questions from IPFS hash)
│           ├── services/
│           │   └── api.service.ts  ← Typed API service layer (all HTTP calls)
│           ├── stores/
│           │   └── authStore.ts    ← Zustand store: user, JWT token, login/logout actions
│           └── types/
│               ├── quiz.ts         ← Quiz and AccessRequest TypeScript interfaces
│               ├── attempt.ts      ← QuizAttempt interface
│               └── user.ts         ← User interface
│
└── packages/
    ├── contracts/                  ← Smart contract library (npm package: @bizz/contracts)
    │   ├── src/                    ← TypeScript source — for development & type checking
    │   │   ├── Token.ts            ← Base TBC20 fungible token
    │   │   ├── Quiz.ts             ← Token extension with quiz metadata
    │   │   ├── Payment.ts          ← Claimable payment container
    │   │   ├── QuizAccess.ts       ← Atomic: entry fee → quiz token
    │   │   ├── QuizAttempt.ts      ← On-chain attempt state machine
    │   │   ├── QuizRedemption.ts   ← Atomic: burn token → activate attempt
    │   │   ├── AnswerProof.ts      ← Verifiable proof of student's answers + score
    │   │   ├── PrizeSwap.ts        ← Atomic swap: prize ↔ answer proof
    │   │   └── index.ts            ← Re-exports
    │   ├── deploy/                 ← Compiled JS — imported by backend at runtime
    │   └── dist/                   ← Compiled TS output
    └── tests/                      ← Integration test suite
        ├── tbc20.test.ts           ← Full end-to-end flow test (7 phases)
        ├── tbc20-quiz-token-flow.test.ts
        └── helpers/
            └── TestHelper.ts       ← Blockchain test utilities
```

---

## 6. Smart Contracts

All contracts live in `packages/contracts/src/` and extend `Contract` from `@bitcoin-computer/lib`. They are compiled to plain JavaScript (no imports) and deployed to the Bitcoin Computer node using `computer.deploy()`. Each deployed contract gets a **module ID** stored in `.env` for reuse.

### Contract Hierarchy

```
Contract (Bitcoin Computer base)
    └── Token (TBC20 fungible token)
            └── Quiz (Token + quiz metadata + lifecycle)

Contract
    ├── Payment (entry fee / prize container)
    ├── QuizAttempt (student attempt state machine)
    └── AnswerProof (verifiable score receipt)

Static-only contracts (no instance state):
    ├── QuizAccess  (exec: payment + quiz token → atomic exchange)
    ├── QuizRedemption (redeem: burn token + activate attempt)
    └── PrizeSwap (swap: prize payment ↔ answer proof)
```

---

### 6.1 `Token` — Base TBC20 Fungible Token

**File:** `packages/contracts/src/Token.ts`

The root of the token hierarchy. Implements the TBC20 standard (inspired by ERC-20 but on UTXO chains).

| Property | Type | Description |
|---|---|---|
| `amount` | `bigint` | Number of tokens in this UTXO |
| `symbol` | `string` | Token symbol (e.g., `"MATH101"`) |
| `_owners` | `string[]` | Current owner public keys |
| `_satoshis` | `bigint` | Satoshis locked in the UTXO (dust: 546 sats) |

**Key Methods:**

| Method | Description |
|---|---|
| `mint(to, amount)` | Create new token UTXO (must be overridden by subclass) |
| `transfer(recipient, amount)` | Reduce balance, create new UTXO for recipient |
| `burn()` | Set `amount = 0n` — permanently destroys tokens |
| `balanceOf()` | Return current UTXO balance |

---

### 6.2 `Quiz` — Quiz Token Contract

**File:** `packages/contracts/src/Quiz.ts`

Extends `Token`. Each Quiz contract represents **both** the quiz template (master record) **and** each individual student's quiz access token (minted copies). The `originalQuizId` field ensures that minted copies always reference their source quiz.

| Property | Type | Description |
|---|---|---|
| `teacher` | `string` | Teacher's public key (metadata) |
| `originalQuizId` | `string` | Points to the source quiz `_id` (preserved across mints/transfers) |
| `questionHashIPFS` | `string` | IPFS CID of the question set (no answers) |
| `answerHashes` | `string[]` | SHA-256 hashes of each correct answer (salted) |
| `questionCount` | `number` | Number of questions |
| `entryFee` | `bigint` | Entry fee in satoshis |
| `prizePool` | `bigint` | Total prize pool in satoshis |
| `passThreshold` | `number` | Score % needed to pass (0–100) |
| `deadline` | `number` | Unix timestamp — after this, no new attempts |
| `teacherRevealDeadline` | `number` | Teacher must reveal answers before this (default: deadline + 48h) |
| `distributionDeadline` | `number` | Set to `revealedAt + 24h` when quiz is revealed |
| `status` | `string` | `active` → `revealed` → `completed` (or `abandoned`/`refunded`) |
| `revealedAnswers` | `string[] \| null` | Plaintext answers — only set after `revealAnswers()` |
| `salt` | `string \| null` | Salt used in answer hashing — only revealed with answers |
| `winners` | `Array<{student, prizeAmount, paymentRev}>` | Winner metadata (set at distribution) |
| `version` | `string` | Contract version (`"2.0.0"`) |

**Key Methods:**

| Method | Who calls | Description |
|---|---|---|
| `mint(to, amount)` | Teacher | Mint a new Quiz token UTXO — does NOT consume teacher's balance |
| `transfer(recipient, amount)` | Token owner | Transfer balance to another address (creates new UTXO) |
| `transferTo(to)` | QuizAccess.exec | In-place ownership transfer — used in atomic swap without creating new UTXO |
| `burn()` | QuizRedemption.redeem | Destroy quiz token to activate attempt |
| `revealAnswers(answers, salt)` | Teacher only | Reveal correct answers — requires teacher owns the quiz template |
| `distributePrizes(winners)` | Teacher | Store winner metadata and mark quiz completed |
| `triggerRefund()` | Anyone | Mark as `refunded` if teacher missed reveal deadline |
| `markAbandoned()` | Anyone | Mark as `abandoned` if deadline passed without reveal/distribution |
| `getInfo()` | Backend | Return summary including computed status flags (`isActive`, `canReveal`, `isExpired`) |

**Design Note:** When the `Quiz` contract is first created, it has `initialSupply = 1000` tokens owned by the teacher. When a student requests access, the teacher calls `quiz.mint(teacherPubKey, 1n)` to create a **separate one-token UTXO** owned by the teacher. This minted token is then transferred to the student via `QuizAccess.exec`. The original `Quiz` UTXO's `amount` never decreases — only the minted UTXOs circulate.

---

### 6.3 `Payment` — Claimable Payment Container

**File:** `packages/contracts/src/Payment.ts`

A container that holds satoshis on behalf of a designated recipient. Used for entry fees and prize payments.

| Property | Type | Description |
|---|---|---|
| `recipient` | `string` | Intended recipient's public key |
| `amount` | `bigint` | Payment amount in satoshis |
| `purpose` | `string` | `"Entry Fee"` or `"Prize Payment"` |
| `reference` | `string` | Quiz or attempt contract ID |
| `status` | `string` | `unclaimed` → `claimed` |
| `_satoshis` | `bigint` | Actual satoshis locked (set to `amount` at creation, reduced to 546 when claimed) |

**Key Methods:**

| Method | Description |
|---|---|
| `transfer(to)` | Change `_owners` — used in atomic swap to give ownership to recipient |
| `claim()` | Release satoshis (`_satoshis` → 546 dust), mark `status = "claimed"` |

---

### 6.4 `QuizAccess` — Atomic Entry Fee Exchange

**File:** `packages/contracts/src/QuizAccess.ts`

A static-method-only contract. The `exec` method atomically exchanges an entry fee payment for a pre-minted quiz token.

```typescript
static exec(mintedToken: Quiz, entryFeePayment: Payment): [Payment, Quiz] {
    const [teacher] = mintedToken._owners
    const [student] = entryFeePayment._owners
    entryFeePayment.transfer(teacher)   // Teacher receives entry fee
    mintedToken.transferTo(student)     // Student receives quiz token
    return [entryFeePayment, mintedToken]
}
```

**Why this design?** The original design (`quiz.mint(student, 1n)` inside `exec`) mutated the quiz template UTXO on every student payment. This caused UTXO conflicts when multiple students paid concurrently. The current design pre-mints a token per student (during approval) and uses `transferTo` in the atomic `exec` — zero contention between students.

---

### 6.5 `QuizAttempt` — Student Attempt State Machine

**File:** `packages/contracts/src/QuizAttempt.ts`

Represents a student's on-chain quiz attempt. Transitions through a defined lifecycle.

**State machine:**
```
available (teacher-created) ──→ owned (student takes ownership)
    │
    └──→ owned ──→ committed ──→ verified ──→ prize_claimed
                                     │
                                     └──→ failed (did not pass)
```

| Property | Type | Description |
|---|---|---|
| `student` | `string` | Student's public key |
| `quizRef` | `string` | Original quiz contract `_id` |
| `answerCommitment` | `string` | Commitment string encoding student's answers |
| `quizTeacher` | `string` | Teacher's public key |
| `entryFee` | `bigint` | Entry fee paid |
| `score` | `number \| null` | Score 0–100 (null until verified) |
| `passed` | `boolean \| null` | Whether student passed (null until verified) |
| `status` | `string` | Current state in lifecycle |
| `isRedeemed` | `boolean` | True after quiz token is burned via `QuizRedemption.redeem` |
| `claimedAt` | `number \| null` | Timestamp of prize claim |

**Key Methods:**

| Method | Description |
|---|---|
| `submitCommitment(commitment)` | Record student's answer commitment — requires `isRedeemed = true` |
| `verify(score, passed)` | Record grading result — called by student after teacher reveals |
| `claimPrize()` | Mark attempt as `prize_claimed` — called inside `PrizeSwap.swap` |
| `claimRefund(quiz)` | For abandoned quizzes — allows student to get refund |

---

### 6.6 `QuizRedemption` — Token Burn + Attempt Activation

**File:** `packages/contracts/src/QuizRedemption.ts`

Atomically burns the quiz token and activates the attempt. Enforces that the same student owns both the token and the attempt, and that the attempt is for the correct quiz.

```typescript
static redeem(quizToken: Quiz, quizAttempt: QuizAttempt): [Quiz, QuizAttempt] {
    quizToken.burn()              // Token amount → 0
    quizAttempt.markAsRedeemed() // Enables submitCommitment
    return [quizToken, quizAttempt]
}
```

**Validation enforced before calling:**
- Student owns quiz token
- Quiz token `amount === 1n`
- Attempt is owned by same student
- Attempt `quizRef` matches token's `originalQuizId`
- Attempt teacher matches token's teacher

---

### 6.7 `AnswerProof` — Verifiable Score Receipt

**File:** `packages/contracts/src/AnswerProof.ts`

An on-chain receipt proving that a student submitted specific answers and received a specific score. Created by the student after their attempt is verified. This contract is transferred to the teacher during the prize swap.

| Property | Description |
|---|---|
| `student` | Student's public key |
| `quizRef` | Quiz contract ID |
| `attemptRef` | Attempt contract ID |
| `answers` | Reconstructed answer texts (from commitment indices) |
| `score` | 0–100 |
| `passed` | Whether the student passed |

---

### 6.8 `PrizeSwap` — Atomic Prize Distribution

**File:** `packages/contracts/src/PrizeSwap.ts`

The final contract in the flow. Atomically swaps ownership of the prize payment (teacher→student) and the answer proof (student→teacher).

```typescript
static swap(
    prizePayment: Payment,
    answerProof: AnswerProof,
    attempt: QuizAttempt
): [Payment, AnswerProof, QuizAttempt] {
    const [student] = attempt._owners
    const teacher = attempt.quizTeacher
    prizePayment.transfer(student)   // Student receives prize
    answerProof.transfer(teacher)    // Teacher receives proof
    attempt.claimPrize()             // Mark attempt done
    return [prizePayment, answerProof, attempt]
}
```

**Validations before swap:**
1. Prize payment recipient matches attempt owner (student)
2. Answer proof is owned by student
3. Answer proof `attemptRef` matches attempt `_id`
4. Attempt status is `verified`
5. Attempt `passed === true`
6. Answer proof `passed === true`

**SIGHASH pattern:** The teacher creates a partial swap transaction signed with `SIGHASH_SINGLE | SIGHASH_ANYONECANPAY`. The student then funds, signs, and broadcasts this transaction — meaning neither party can steal from the other since each signs only their own input/output pair.

---

## 7. Backend — NestJS API

### 7.1 Module Architecture

```
AppModule
├── ScheduleModule (cron jobs)
├── AuthModule (JWT + Passport)
├── QuizModule
├── AccessRequestModule
├── QuizAttemptModule
├── PrizeModule
└── WalletModule
```

Each module follows NestJS conventions: `*.module.ts` (imports), `*.controller.ts` (route handlers), `*.service.ts` (business logic + blockchain + DB).

### 7.2 `ComputerManager` — Blockchain Singleton

**File:** `app/backend/src/common/computer-manager.ts`

The most critical infrastructure component. A process-level singleton that maintains one `Computer` instance per user mnemonic. This is essential because Bitcoin Computer `Computer` instances maintain UTXO cache state — creating a new instance per request would lose track of pending UTXOs.

```typescript
class ComputerManager {
    private computers: Map<string, Computer>  // mnemonic → Computer

    getComputer(mnemonic: string): Computer {
        if (!this.computers.has(mnemonic)) {
            // Create once with chain/network from .env
            this.computers.set(mnemonic, new Computer({ chain, network, mnemonic }))
        }
        return this.computers.get(mnemonic)!
    }
}

export const computerManager = ComputerManager.getInstance()  // Singleton
```

Every service calls `computerManager.getComputer(user.encryptedMnemonic)` to get the user's Computer — never `new Computer(...)` directly.

### 7.3 `IPFSService` — Question Storage

**File:** `app/backend/src/common/ipfs.service.ts`

Handles:
- **Upload:** POST questions (without answers) to Pinata → returns IPFS CID
- **Fetch:** GET from multiple gateways (`ipfs.io`, `cloudflare-ipfs.com`, `gateway.pinata.cloud`) with 5s timeout fallback
- **Hashing:** `hashAnswer(quizId, index, answer, salt)` → SHA-256 hex. Each answer is hashed with the quiz ID, its index position, and a random 32-byte salt.
- **Salt generation:** `crypto.randomBytes(32).toString('hex')`

### 7.4 Auth Module

**Flow:**
1. `POST /auth/signup` — Hash password (bcrypt, 10 rounds) → Generate Bitcoin Computer wallet (`new Computer({chain, network})` → extract mnemonic, address, publicKey) → Fund wallet via faucet (regtest only, 1,000,000 sats) → Store user with `encryptedMnemonic` (TODO: AES-256 encryption in prod) → Return JWT.
2. `POST /auth/login` — Find user by email → `bcrypt.compare(password, hash)` → Return JWT.
3. All protected routes use `JwtAuthGuard` → `JwtStrategy` extracts `sub` (userId) from token → calls `authService.validateUser(userId)`.

JWT payload structure: `{ sub: userId, email, role }`

### 7.5 Quiz Module

The most complex service. Handles:

**`createFromUI(teacherId, dto)`** — The main teacher-facing creation endpoint:
1. Generate token symbol from title (uppercase, strip non-alphanumeric, max 10 chars)
2. Upload questions (without answers) to IPFS via Pinata
3. Generate random 32-byte salt
4. Hash each correct answer: `SHA256(quizId + index + answer + salt)`
5. Call `create()` → deploy Quiz contract on blockchain
6. Store plaintext answers + salt + questions JSON in DB (for auto-reveal fallback)

**`revealAnswers(quizId, teacherId, dto)`** — Teacher triggers answer reveal:
1. Resolve answers/salt: prefer request body, fall back to DB-stored values
2. Sync quiz contract from blockchain
3. If already revealed on-chain (idempotent): skip broadcast, just sync DB
4. Call `quiz.revealAnswers(answers, salt)` via `encodeCall` → broadcast → mine 1 block
5. **Pre-grade all COMMITTED attempts** using `computeScore()` — stores score/passed in DB immediately
6. Calculate `prizePerWinner = prizePool / passedCount` — store on Quiz record
7. Update quiz status to `REVEALED`

**Auto-reveal cron** (`@Cron(CronExpression.EVERY_MINUTE)`):
- Finds all `ACTIVE` quizzes whose deadline has passed AND teacher has a mnemonic
- Caps at `MAX_REVEAL_FAILURES = 3` consecutive failures per quiz (tracked in-memory Map)
- After 3 failures: marks quiz `COMPLETED` to stop retrying permanently

**`computeScore(commitment, revealedAnswers, questions)`:**
- Parses student indices from commitment string format: `"commitment-[0,2,1,3]-<timestamp>"`
- Maps each index to the question's option at that position
- Compares with correct answer texts from `revealedAnswers`
- Returns `Math.round((correct / total) * 100)`

### 7.6 AccessRequest Module

Handles the multi-step student onboarding flow:

**`requestAccess(studentId, dto)`** — Auto-approves immediately:
1. Validate: quiz is ACTIVE, before deadline, no duplicate request
2. Create request record with `PENDING` status
3. **Auto-approve:**
   - Sync quiz contract from blockchain
   - Mint fresh quiz token: `quizContract.mint(teacherPubKey, 1n)` → broadcast → mine
   - Update `quiz.contractRev` in DB (quiz UTXO changed after mint)
   - Create `PaymentMock` with teacher's public key as recipient
   - Build partial transaction: teacher signs input[0] (mintedToken) with `SIGHASH_SINGLE | SIGHASH_ANYONECANPAY`
   - Store `{ txHex, mintedTokenId, mintedTokenRev }` in `partialExecTx` field

**`completePayment(requestId, studentId)`** — Student pays entry fee:
1. Create real `Payment` contract (student's computer) → broadcast → mine
2. Load partial tx from DB
3. Replace mock input[1] with real payment UTXO rev
4. Set output[1] to student's scriptPubKey (receives quiz token)
5. Fund + sign + broadcast → quiz token transfers to student
6. Look up minted token by stored `mintedTokenId` → verify it's now owned by student
7. Update request: `PAID`, store `quizTokenId`, `entryPaymentId`

**`claimPayment(requestId, teacherId)`** — Teacher collects entry fee:
- Syncs payment contract → calls `payment.claim()` → broadcast → mine
- Sets `feeClaimedAt` timestamp, advances status to `FEE_CLAIMED`

**`startAttempt(requestId, studentId)`** — Student burns token, starts quiz:
1. Sync quiz token → validate `amount === 1n`
2. Get `originalQuizId` from token (not `_id` — may differ for minted copies)
3. Create `QuizAttempt` contract with empty commitment → broadcast → mine
4. Re-sync both quiz token and attempt to latest revs
5. Call `QuizRedemption.redeem(token, attempt)` → broadcast → mine
6. Create DB `QuizAttempt` record with `OWNED` status
7. Update request: `STARTED`, link `attemptId`

### 7.7 QuizAttempt Module

**`submitCommitment(attemptId, studentId, dto)`:**
- Validate attempt is `OWNED` and before deadline
- Sync `QuizAttempt` contract from blockchain
- Call `attempt.submitCommitment(dto.answerCommitment)` → broadcast → mine
- Update DB: status → `COMMITTED`, store `answerCommitment`

**`verifyAttempt(attemptId, studentId, dto)`:**
- Validate attempt is `COMMITTED` and quiz is `REVEALED`
- Compute score server-side from commitment + revealed answers + question options
- Fall back to `dto.score` if server computation fails
- Call `attempt.verify(score, passed)` → broadcast → mine
- Update DB: status → `VERIFIED`, store `score`, `passed`
- **Auto-create prize pipeline** if `passed === true`:
  - Create `AnswerProof` (student's computer)
  - Create `Payment` for prize amount (teacher's computer)
  - Create partial `PrizeSwap` transaction (teacher signs with SIGHASH_SINGLE|ANYONECANPAY)
  - Store all IDs + partial swap hex in DB — student can claim immediately

### 7.8 Prize Module

**`executeSwap(studentId, attemptId)`** — Combined swap + claim:
1. Parse stored partial swap tx hex
2. Student funds + signs + broadcasts the swap transaction
3. Mine 1 block
4. Sync prize payment (now owned by student) and attempt (now `prize_claimed`)
5. **Immediately claim** the prize payment: `payment.claim()` → broadcast → mine
6. Update DB: status → `PRIZE_CLAIMED`

This combines two on-chain operations into one backend call so the student only clicks one button.

### 7.9 Wallet Module

- `GET /wallet/balance` — Queries the Bitcoin Computer node for the user's UTXO total
- `POST /wallet/faucet` — Calls `computer.faucet(amount)` (regtest only)

---

## 8. Frontend — Next.js

### 8.1 State Management

**Zustand `authStore`** (`src/stores/authStore.ts`):
- State: `user`, `token`, `isLoading`, `error`
- Actions: `login()`, `signup()`, `logout()`, `setUser()`, `setToken()`
- Persistence: `persist` middleware saves `user` and `token` to `localStorage` under key `auth-storage` — survives page refresh

### 8.2 Pages

| Route | Role | Description |
|---|---|---|
| `/` | Anyone | Landing page |
| `/auth/signin` | Unauthenticated | Login form |
| `/auth/signup` | Unauthenticated | Registration form with role selector |
| `/teacher/create` | Teacher | Multi-step quiz creation form |
| `/teacher/dashboard` | Teacher | List teacher's quizzes + access requests |
| `/teacher/reveal/[id]` | Teacher | Trigger answer reveal for a specific quiz |
| `/student/browse` | Student | Browse all active quizzes |
| `/student/dashboard` | Student | Student's attempts + status |
| `/student/take/[id]` | Student | Take a quiz (submit answers) |
| `/student/prize/[id]` | Student | Prize claim flow |

### 8.3 Key Components

| Component | Description |
|---|---|
| `FloatingWallet` | Floating wallet balance widget shown to logged-in users |
| `AuthWidget` | Login/signup widget |
| `WalletWidget` | Balance display with copy address |
| `NetworkStatus` | Shows current blockchain network |
| `QuizSummaryTeacher` | Quiz card for teacher dashboard |
| `QuizSummaryStudent` | Quiz card for student dashboard |
| `ClaimPrizeButton` | Triggers prize claim endpoint |
| `PaymentStatus` | Shows payment step in access flow |
| `QuizFinancialDetails` | Prize pool, entry fee, pass threshold display |
| `StudentAttemptDetails` | Score + status card for student |
| `CountdownTimer` | Live countdown to quiz deadline |
| `DeadlineTimeline` | Visual timeline of quiz phases |
| `FlowProgress` | Step indicator for quiz flow |
| `TransactionStatus` | Blockchain TX status indicator |

### 8.4 Answer Commitment Format

The frontend (`src/lib/crypto.ts`) generates commitments when a student submits answers:

```
"commitment-[answerIndex0,answerIndex1,...]-<timestamp>"
```

Example: `"commitment-[0,2,1,3]-1719000000000"` means the student selected option 0 for Q1, option 2 for Q2, etc.

The backend parses this format with a regex: `/commitment-(\[[\d,\s]+\])-/` to extract the indices for scoring.

---

## 9. Database Schema

PostgreSQL via Prisma 5. The database is a **query cache** — blockchain is the source of truth for all asset state. On-chain contract IDs (`contractId`, `contractRev`) are stored for blockchain sync.

### 9.1 `User`

| Field | Type | Notes |
|---|---|---|
| `id` | `String (cuid)` | Internal DB ID |
| `email` | `String?` | Unique |
| `name` | `String?` | Display name |
| `passwordHash` | `String?` | bcrypt hash |
| `publicKey` | `String?` | Unique — Bitcoin Computer public key |
| `address` | `String?` | Unique — Bitcoin Computer address |
| `encryptedMnemonic` | `String?` | BIP39 mnemonic (should be AES-256 encrypted in prod) |
| `walletType` | `String` | `CUSTODIAL` / `CONNECTED` / `NONE` |
| `walletBalance` | `BigInt` | Cached balance in satoshis |
| `role` | `Role` | `TEACHER` / `STUDENT` / `BOTH` |
| `totalEarnings` | `BigInt` | Lifetime earnings in satoshis |

### 9.2 `Quiz`

| Field | Type | Notes |
|---|---|---|
| `contractId` | `String` | Unique — Bitcoin Computer `_id` |
| `contractRev` | `String?` | Current `_rev` — updated after mint/reveal |
| `teacherId` | `String` | FK to User |
| `symbol` | `String` | TBC20 token symbol |
| `questionHashIPFS` | `String` | IPFS CID |
| `correctAnswers` | `Json` | Plaintext answers (for auto-reveal fallback) |
| `answerHashes` | `Json` | Array of SHA-256 hashes |
| `salt` | `String` | Random 32-byte hex salt |
| `questions` | `Json?` | Full question+options JSON (for scoring) |
| `entryFee` | `BigInt` | Satoshis |
| `prizePool` | `BigInt` | Satoshis |
| `passThreshold` | `Int` | 0–100 |
| `winnerCount` | `Int` | Number of passing students (set at reveal) |
| `prizePerWinner` | `BigInt?` | `prizePool / winnerCount` (set at reveal) |
| `deadline` | `DateTime` | After this: no new attempts |
| `teacherRevealDeadline` | `DateTime` | After this: quiz can be abandoned |
| `status` | `QuizStatus` | `ACTIVE` / `REVEALED` / `COMPLETED` |
| `revealedAnswers` | `Json?` | Plaintext answers (set after reveal) |

### 9.3 `QuizAttempt`

| Field | Type | Notes |
|---|---|---|
| `contractId` | `String` | Unique — Bitcoin Computer `_id` |
| `userId` | `String` | FK to User (student) |
| `quizId` | `String` | FK to Quiz |
| `answerCommitment` | `String?` | `"commitment-[indices]-timestamp"` |
| `score` | `Int?` | 0–100 (null until verified) |
| `passed` | `Boolean?` | null until verified |
| `answerProofId` | `String?` | `AnswerProof` contract `_id` |
| `prizePaymentId` | `String?` | `Payment` contract `_id` |
| `prizePaymentRev` | `String?` | `Payment` current `_rev` |
| `swapTxHex` | `String?` | Partial SWAP transaction hex (teacher-signed) |
| `prizeAmount` | `BigInt?` | Actual satoshis awarded |
| `status` | `AttemptStatus` | `CREATED` / `OWNED` / `COMMITTED` / `VERIFIED` / `PRIZE_CLAIMED` |

### 9.4 `QuizAccessRequest`

| Field | Type | Notes |
|---|---|---|
| `quizId` | `String` | FK to Quiz |
| `studentId` | `String` | FK to User |
| `status` | `QuizAccessStatus` | See status flow below |
| `partialExecTx` | `Json?` | `{ txHex, mintedTokenId, mintedTokenRev }` |
| `quizTokenId` | `String?` | Minted quiz token `_id` |
| `entryPaymentId` | `String?` | Entry fee Payment `_id` |
| `feeClaimedAt` | `DateTime?` | When teacher collected the entry fee |
| `attemptId` | `String?` | Unique FK to QuizAttempt |

**Status Flow:**
```
PENDING → APPROVED → PAID → FEE_CLAIMED → STARTED → COMPLETED
                                 ↕
                             CANCELLED
        REJECTED ←───────────────
```

### 9.5 `Transaction`

Audit log for all on-chain transactions.

| Field | Description |
|---|---|
| `txHash` | Unique — blockchain tx hash |
| `type` | `QUIZ_CREATION` / `QUIZ_ATTEMPT` / `REVEAL_ANSWERS` / `PAYOUT` / `REFUND` |
| `status` | `PENDING` / `CONFIRMING` / `CONFIRMED` / `FAILED` |
| `fromAddress` | Sender's address |
| `amount` | Satoshis (optional) |

### 9.6 `IndexerState`

Singleton record tracking the blockchain indexer's sync position.

| Field | Description |
|---|---|
| `id` | Always `"singleton"` |
| `lastBlockHeight` | Last processed block |
| `lastSyncTime` | Timestamp |

---

## 10. End-to-End Flows

### 10.1 Teacher Creates a Quiz

```
Teacher fills form (title, questions, answers, entry fee, prize pool, deadline)
    │
    ▼ POST /quiz/create-ui
    │
Backend:
1. Generate symbol (e.g., "MATH101" from title)
2. Upload questions (without answers) → IPFS via Pinata → returns CID
3. Generate random 32-byte salt
4. Hash each answer: SHA256(quizId + index + answer + salt) → array of hashes
5. Get teacher's Computer from ComputerManager
6. Encode Quiz constructor call with all params → broadcast → mine 1 block
7. Store in DB: quiz record with IPFS CID, answer hashes, salt, plaintext answers, questions
    │
    ▼
Quiz is live: questions public on IPFS, answer hashes on-chain, answers secret
```

### 10.2 Student Requests Access

```
Student clicks "Request Access" on a quiz
    │
    ▼ POST /access-request
    │
Backend (auto-approve flow):
1. Validate: quiz ACTIVE, before deadline, no duplicate request
2. Create request record (PENDING)
3. Get teacher's Computer
4. Sync quiz contract from blockchain (latest rev)
5. Mint fresh quiz token for this student: quiz.mint(teacherPubKey, 1n) → broadcast → mine
6. Update quiz.contractRev in DB
7. Create PaymentMock with teacher as recipient
8. Encode partial tx: teacher signs quiz token input with SIGHASH_SINGLE|ANYONECANPAY
9. Store { txHex, mintedTokenId, mintedTokenRev } → update request: APPROVED
    │
    ▼
Student has approved request with pre-built partial transaction
```

### 10.3 Student Pays Entry Fee

```
Student clicks "Pay Entry Fee"
    │
    ▼ POST /access-request/:id/pay
    │
Backend (student's Computer):
1. Create Payment contract (entry fee amount, teacher as recipient) → broadcast → mine
2. Load partial tx from DB
3. Replace mock input[1] with real Payment UTXO
4. Set output[1] to student's scriptPubKey (will receive quiz token)
5. Student funds + signs + broadcasts the completed tx
6. QuizAccess.exec fires atomically:
   - entryFeePayment.transfer(teacher)   ← teacher receives entry fee
   - mintedToken.transferTo(student)     ← student receives quiz token
7. Look up minted token → verify student owns it
8. Update request: PAID, store quizTokenId, entryPaymentId
    │
    ▼
Student owns quiz token. Teacher's entry fee is now in Payment contract.
```

### 10.4 Student Burns Token and Starts Quiz

```
Student clicks "Start Quiz"
    │
    ▼ POST /access-request/:id/start
    │
Backend (student's Computer):
1. Sync quiz token → validate amount === 1n
2. Get originalQuizId from token
3. Create QuizAttempt contract (status: owned, empty commitment) → broadcast → mine
4. Re-sync quiz token and attempt (latest revs)
5. QuizRedemption.redeem(quizToken, quizAttempt) → broadcast → mine
   - token.burn()              ← token amount → 0 (non-reusable)
   - attempt.markAsRedeemed()  ← enables submitCommitment
6. Create DB QuizAttempt record (OWNED status)
7. Update request: STARTED
    │
    ▼
Student can now take the quiz. Token is burned (cannot re-enter).
```

### 10.5 Student Submits Answers

```
Student selects answers and clicks "Submit"
    │
Frontend generates commitment: "commitment-[0,2,1,3]-1719000000000"
    │
    ▼ POST /quiz-attempt/:id/submit { answerCommitment }
    │
Backend (student's Computer):
1. Validate attempt is OWNED and before deadline
2. Sync QuizAttempt contract
3. attempt.submitCommitment(commitment) → broadcast → mine
4. Update DB: status → COMMITTED, store answerCommitment
    │
    ▼
Answers are committed on-chain. Teacher cannot see answers yet.
```

### 10.6 Teacher Reveals Answers

```
Quiz deadline passes. Teacher clicks "Reveal Answers" (or cron auto-triggers)
    │
    ▼ PUT /quiz/:id/reveal  (or via @Cron every minute)
    │
Backend (teacher's Computer):
1. Resolve answers + salt (from request body, fall back to DB)
2. Sync quiz contract from blockchain
3. If already revealed: skip broadcast (idempotent)
4. quiz.revealAnswers(answers, salt) → broadcast → mine
5. Update DB: status → REVEALED, store revealedAnswers + salt + new contractRev
6. Pre-grade all COMMITTED attempts:
   - Parse each commitment → extract student answer indices
   - Map indices to option texts using stored questions
   - Compare with revealedAnswers → compute score
   - Store score + passed in DB
7. Calculate prizePerWinner = prizePool / passedCount → store on Quiz
    │
    ▼
All students' scores visible. Prize amounts locked in.
```

### 10.7 Student Verifies and Claims Prize

```
Student navigates to prize page
    │
    ▼ POST /quiz-attempt/:id/verify
    │
Backend:
1. Validate attempt is COMMITTED, quiz is REVEALED
2. Compute score server-side (same algorithm as pre-grading)
3. attempt.verify(score, passed) → broadcast → mine
4. Update DB: VERIFIED, store score + passed

[If student passed — auto prize pipeline:]
5. Create AnswerProof contract (student's Computer) → broadcast → mine
6. Create Prize Payment (teacher's Computer, amount = prizePerWinner) → broadcast → mine
7. Create partial PrizeSwap tx (teacher signs SIGHASH_SINGLE|ANYONECANPAY) → store hex

    ▼ POST /prize/:id/execute-swap (student clicks "Claim Prize")
    │
Backend (student's Computer):
8. Parse stored partial swap tx
9. Fund + sign + broadcast swap:
   - prizePayment.transfer(student)   ← student owns prize
   - answerProof.transfer(teacher)    ← teacher owns proof
   - attempt.claimPrize()             ← marks attempt done
10. Immediately claim prize: payment.claim() → broadcast → mine
    - _satoshis released to student's wallet
11. Update DB: status → PRIZE_CLAIMED
    │
    ▼
Student's wallet balance increases. Teacher has on-chain proof of answers.
```

---

## 11. Cryptography & Privacy Model

### Answer Commitment Scheme

The privacy model ensures correct answers cannot be derived from what's stored on-chain or on IPFS:

| Location | What's stored | What's NOT stored |
|---|---|---|
| IPFS | Questions + options (no answers) | Correct answers |
| Blockchain (Quiz contract) | `answerHashes[i] = SHA256(quizId + i + answer + salt)` | Plaintext answers, salt |
| Blockchain (QuizAttempt) | `commitment = "commitment-[studentIndices]-timestamp"` | Student's actual answer texts |
| PostgreSQL | Plaintext answers, salt (for auto-reveal) | — |

**Security guarantee:** Neither the IPFS content nor the on-chain data reveals correct answers or student answers before the reveal phase. The salt makes brute-forcing the answer hashes infeasible.

### After Reveal

Once the teacher calls `quiz.revealAnswers(answers, salt)`:
- Both `answers` and `salt` are now public on-chain
- Anyone can verify: `SHA256(quizId + i + answer + salt) === answerHashes[i]`
- Anyone can verify a student's score by parsing their commitment and comparing indices

### Atomic Swap Security

The two-party swap (`PrizeSwap`) uses Bitcoin's SIGHASH flags to ensure:
- Teacher signs their inputs/outputs first with `SIGHASH_SINGLE | SIGHASH_ANYONECANPAY`
- Student adds their inputs/outputs and signs
- The transaction is only valid if ALL conditions are met simultaneously
- Neither party can receive value without the other party also receiving theirs

---

## 12. Environment Variables

### Frontend (`app/web/.env.local`)

```env
# API
NEXT_PUBLIC_API_URL=http://localhost:3001

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Bitcoin Computer
NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK=regtest
NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN=LTC
NEXT_PUBLIC_BITCOIN_COMPUTER_URL=https://rltc.node.bitcoincomputer.io

# IPFS
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/

# Platform
NEXT_PUBLIC_PLATFORM_FEE=0.02
NEXT_PUBLIC_MIN_ENTRY_FEE=5000
NEXT_PUBLIC_APP_NAME=Bizz
```

### Backend (`app/backend/.env`)

```env
# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000  # comma-separated for multiple origins

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bizz_dev
DIRECT_URL=postgresql://user:password@localhost:5432/bizz_dev

# JWT
JWT_SECRET=<openssl rand -base64 64>

# Wallet encryption
WALLET_ENCRYPTION_KEY=<openssl rand -hex 32>  # AES-256 for mnemonic storage
REVEAL_DATA_KEY=<openssl rand -hex 32>

# Bitcoin Computer
BC_CHAIN=LTC
BC_NETWORK=regtest
BC_URL=https://rltc.node.bitcoincomputer.io
BITCOIN_COMPUTER_MNEMONIC=<platform mnemonic>

# IPFS
PINATA_JWT=<from app.pinata.cloud/keys>

# Deployed smart contract module IDs (from 'npm run deploy')
QUIZ_MODULE_ID=
PAYMENT_MODULE_ID=
QUIZ_ACCESS_MODULE_ID=
QUIZ_ATTEMPT_MODULE_ID=
QUIZ_REDEMPTION_MODULE_ID=
ANSWER_PROOF_MODULE_ID=
PRIZE_SWAP_MODULE_ID=

# Timing
STUDENT_REVEAL_WINDOW_MINUTES=5   # Use 1440 (24h) in production
TEACHER_REVEAL_WINDOW_MINUTES=5
```

---

## 13. API Reference

All endpoints (except `/auth/*`) require: `Authorization: Bearer <jwt>`

### Auth

| Method | Endpoint | Body | Response |
|---|---|---|---|
| `POST` | `/auth/signup` | `{ email, password, name, role? }` | `{ access_token, user }` |
| `POST` | `/auth/login` | `{ email, password }` | `{ access_token, user }` |

### Quiz

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/quiz/create-ui` | Teacher | Create quiz (handles IPFS + hashing) |
| `GET` | `/quiz` | Any | List all quizzes (with attempt counts) |
| `GET` | `/quiz/:id` | Any | Get quiz details (syncs from blockchain) |
| `PUT` | `/quiz/:id/reveal` | Teacher | Reveal correct answers |
| `DELETE` | `/quiz/:id` | Teacher | Delete quiz (no attempts allowed) |

### Access Request

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/access-request` | Student | Request + auto-approve quiz access |
| `GET` | `/access-request/student` | Student | Get all student's requests |
| `GET` | `/access-request/teacher` | Teacher | Get teacher's incoming requests |
| `POST` | `/access-request/:id/approve` | Teacher | Manually approve a pending request |
| `POST` | `/access-request/:id/pay` | Student | Pay entry fee (completes partial tx) |
| `POST` | `/access-request/:id/claim` | Teacher | Claim entry fee payment |
| `POST` | `/access-request/:id/start` | Student | Burn quiz token, start attempt |

### Quiz Attempt

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/quiz-attempt/:id/submit` | Student | Submit answer commitment |
| `POST` | `/quiz-attempt/:id/verify` | Student | Verify attempt (auto-creates prize pipeline) |
| `GET` | `/quiz-attempt/student` | Student | Get all student's attempts |
| `GET` | `/quiz-attempt/:id` | Student/Teacher | Get attempt details |

### Prize

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/prize/answer-proof` | Student | Create AnswerProof contract (manual fallback) |
| `POST` | `/prize/:attemptId/payment` | Teacher | Create prize Payment contract (manual fallback) |
| `POST` | `/prize/:attemptId/swap-tx` | Teacher | Build partial swap tx (manual fallback) |
| `POST` | `/prize/:attemptId/execute-swap` | Student | Execute atomic swap + claim prize |
| `POST` | `/prize/:attemptId/claim` | Student | Claim prize payment (if already swapped) |

### Wallet

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/wallet/balance` | Any | Get current wallet balance |
| `POST` | `/wallet/faucet` | Any | Fund wallet (regtest only) |

---

## 14. Deployment

The platform runs on a single **AWS EC2 t3.micro** instance.

### Services

| Service | Directory | Port | Process Manager |
|---|---|---|---|
| NestJS backend | `/home/ubuntu/bizz/app/backend/` | 3001 | PM2 (`bizz-backend`) |
| Next.js frontend | `/home/ubuntu/bizz-frontend/` | 3000 | PM2 (`bizz-frontend`) |
| PostgreSQL | localhost | 5432 | systemd |
| Nginx | — | 80 | systemd |

### Nginx Configuration

Nginx proxies:
- `/ ` → Next.js on `:3000`
- `/api` → NestJS on `:3001` (or via subdomain)

### PM2 Commands

```bash
pm2 list                  # Show all processes
pm2 logs bizz-backend     # Stream backend logs
pm2 restart bizz-backend  # Restart backend
pm2 startup               # Generate startup script (auto-start on reboot)
pm2 save                  # Save current process list
```

### Quick Redeploy

**Backend:**
```bash
# In app/backend/
npm run build
rsync -avz -e "ssh -i ~/.ssh/bizz-key.pem" dist/ ubuntu@<EC2-IP>:/home/ubuntu/bizz/app/backend/dist/
ssh -i ~/.ssh/bizz-key.pem ubuntu@<EC2-IP> "pm2 restart bizz-backend"
```

**Frontend:**
```bash
# In app/web/
npm run build
rsync -avz -e "ssh -i ~/.ssh/bizz-key.pem" .next/standalone/ ubuntu@<EC2-IP>:/home/ubuntu/bizz-frontend/
rsync -avz -e "ssh -i ~/.ssh/bizz-key.pem" .next/static/ ubuntu@<EC2-IP>:/home/ubuntu/bizz-frontend/.next/static/
ssh -i ~/.ssh/bizz-key.pem ubuntu@<EC2-IP> "pm2 restart bizz-frontend"
```

### Smart Contract Deployment

Contracts must be deployed once (or after changes) to get module IDs:

```bash
cd packages/contracts
npm run build   # Compile TS → JS in deploy/
# Run deploy scripts to get module IDs → paste into backend .env
```

---

## 15. Security Design

### Authentication
- Passwords: bcrypt (10 rounds) — never stored plaintext
- JWT tokens: stateless, signed with `JWT_SECRET` — expire per config
- All API routes protected by `JwtAuthGuard` — only `/auth/signup` and `/auth/login` are public
- Role-based checks: `TeacherGuard` on quiz creation/reveal endpoints; ownership checks in services

### Wallet Security
- Each user gets a custodial BIP39 mnemonic generated server-side at signup
- Mnemonic stored in `encryptedMnemonic` — **production requirement: AES-256 encrypt with `WALLET_ENCRYPTION_KEY` before storage** (current code stores plaintext — a known TODO)
- `ComputerManager` keeps Computer instances in-memory only — mnemonic not logged

### CORS
- `FRONTEND_URL` environment variable controls allowed origins
- Multiple origins supported (comma-separated)
- Credentials allowed

### Input Validation
- `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` on all incoming request bodies
- Class-validator decorators on all DTOs

### Blockchain-Level Security
- Answer hashes stored on-chain before reveal — teacher cannot change answers retroactively
- Atomic swaps guarantee prize delivery without trusting either party
- SIGHASH flags ensure partial transactions cannot be repurposed

### What to Never Commit
- `.env`, `.env.local` — contain secrets
- `.pem` key files — AWS SSH keys
- `node_modules/` — always install fresh
- Wallet mnemonics in code

---

## 16. Key Design Decisions & Trade-offs

### Decision 1: Backend-Only Blockchain Access
**Choice:** The NestJS backend is the sole party that signs and broadcasts blockchain transactions.  
**Rationale:** Enables a wallet-free UX for students/teachers — no MetaMask required. Students can participate from any browser.  
**Trade-off:** The backend is a custodial party — it manages private keys. In a more decentralised design, users would sign their own transactions from the browser.

### Decision 2: On-Demand Token Minting (not quiz template minting)
**Choice:** When a student requests access, the teacher's backend mints a fresh 1-token UTXO (`quiz.mint(teacherPubKey, 1n)`) dedicated to that student.  
**Rationale:** The original design minted inside `QuizAccess.exec()` (from the quiz template), which required both parties to touch the same quiz template UTXO. Multiple concurrent students would conflict. The current design gives each student their own UTXO — zero contention.  
**Trade-off:** Requires an extra on-chain transaction per student (mint), increasing cost and latency slightly.

### Decision 3: PostgreSQL as Query Cache
**Choice:** Store blockchain data in PostgreSQL for fast reads; treat it as a derived cache.  
**Rationale:** Querying the Bitcoin Computer node for every API request is too slow. The DB gives sub-millisecond reads while blockchain operations happen asynchronously.  
**Trade-off:** DB can drift from chain state if sync fails. Services include fallback to DB-only responses when blockchain sync fails.

### Decision 4: Auto-Reveal Cron Job
**Choice:** A `@Cron(CronExpression.EVERY_MINUTE)` job automatically reveals expired quizzes using stored answers/salt.  
**Rationale:** Teachers can forget or go offline after quiz deadline. Auto-reveal ensures students can verify and claim prizes without manual teacher action.  
**Trade-off:** Requires the backend server to be running at reveal time. Capped at 3 failures per quiz to prevent infinite retries on broken contracts.

### Decision 5: Auto Prize Pipeline on Verify
**Choice:** When a student verifies their attempt and passes, the backend automatically creates AnswerProof, Prize Payment, and partial swap tx — without any teacher action.  
**Rationale:** Reduces friction. Teacher approved the quiz creation and funded the prize pool; the rest is mechanical.  
**Trade-off:** Teacher cannot review/reject individual claims. Prize payment creation uses teacher's wallet (managed by backend), so teacher must have sufficient funds.

### Decision 6: Commitment-Based Scoring (not on-chain verification)
**Choice:** Student commits answer indices on-chain (`commitment-[0,2,1,3]-ts`); backend scores by comparing indices to stored question options and revealed answers.  
**Rationale:** Simpler than fully on-chain verification. Score is computed deterministically server-side — student cannot lie about their score since the backend computes it independently.  
**Trade-off:** Student must trust the backend's scoring. A fully trustless design would verify the commitment hash on-chain (requires the answers + nonce to match the stored hash).

### Decision 7: prizePerWinner Pre-computed at Reveal
**Choice:** `prizePerWinner = prizePool / winnerCount` is computed and stored in the DB when the teacher reveals answers.  
**Rationale:** All students who passed get the same per-winner share. Computing at reveal time (when all COMMITTED attempts are graded) guarantees the count is final.  
**Trade-off:** Late-submitting students (who committed but hadn't been graded yet) might miss the window — but since all COMMITTED attempts are graded at reveal time, this is handled correctly.

---

## 17. Development Guide

### Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL 14+
- Pinata account (for IPFS)
- Bitcoin Computer node access (`https://rltc.node.bitcoincomputer.io`)

### Setup

```bash
# 1. Clone and install
git clone <repo>
cd bizz
npm install               # root workspace
cd app/backend && npm install && cd ../..
cd app/web && npm install && cd ../..

# 2. Configure environment
cp .env.example app/backend/.env
cp .env.example app/web/.env.local
# Fill in all values

# 3. Build smart contracts
cd packages/contracts && npm run build && cd ../..

# 4. Database setup
cd app/backend
npx prisma migrate dev
npx prisma generate

# 5. Run
# Terminal 1:
cd app/backend && npm run start:dev
# Terminal 2:
cd app/web && npm run dev
```

### Running Tests

```bash
# From root:
npm run test                         # Integration tests (packages/tests/)

# Backend unit/e2e:
cd app/backend
npm run test                         # Unit tests
npm run test:e2e                     # E2E tests
```

The integration tests in `packages/tests/tbc20.test.ts` run the **full 7-phase flow** against a live regtest node. The backend code mirrors this test exactly — all service methods include comments like `// EXACT PATTERN from tbc20.test.ts line 510-529`.

### Useful Scripts (root)

```bash
npm run dev          # Start Next.js frontend
npm run build        # Build contracts + frontend
npm run lint         # Lint all workspaces
npm run db:migrate   # Run Prisma migrations
npm run db:studio    # Open Prisma Studio (visual DB browser)
```

### Adding a New Smart Contract

1. Create `packages/contracts/src/MyContract.ts` extending `Contract`
2. Add a `MyContractHelper` class (same file) with `deploy()` and operation methods
3. Export from `packages/contracts/src/index.ts`
4. Run `cd packages/contracts && npm run build` → get `deploy/MyContract.deploy.js`
5. Deploy to regtest: run deploy script → paste module ID in `.env`
6. Import in backend: `import { MyContractHelper } from '@bizz/contracts/deploy/MyContract.deploy.js'`

### Debugging Blockchain Issues

All services use `computerManager.getComputer(mnemonic)` — if a Computer instance has stale UTXO state, call `computerManager.clearComputer(mnemonic)` to force a fresh instance.

For regtest, blocks must be mined after each broadcast — all services call `mineBlocks(computer, 1)` after every `broadcast()`. In production (mainnet/testnet), this would be removed since miners do it automatically.

---

*This document was generated from the full codebase (136 files, 1,079 graph nodes, 11,221 edges across 10 code communities) as of 2026-06-30.*
