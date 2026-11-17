# Bizz — Blockchain-Powered Quiz Platform

Bizz is a decentralized quiz platform where teachers create competitive quizzes with prize pools and students participate by paying entry fees to earn Bitcoin rewards. All prize distribution and access control is governed by smart contracts deployed on the Bitcoin Computer protocol, ensuring transparent and trustless operation.

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Smart Contracts](#smart-contracts)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Database Schema](#database-schema)
- [API Overview](#api-overview)
- [Deployment](#deployment)

---

## Overview

Bizz combines traditional quiz functionality with blockchain-based economics. Teachers set entry fees and prize pools; students compete for on-chain rewards. The platform uses:

- **Smart contracts** for immutable quiz state, token-based access, and atomic prize distribution
- **IPFS** to store quiz questions publicly without revealing answers
- **Commitment schemes** to keep student answers private until the teacher reveals correct answers
- **Atomic swaps** to exchange prizes for answer proofs — no trust required between parties

---

## How It Works

### Teacher Flow

1. Create a quiz — set questions, entry fee, prize pool, passing threshold, and deadline
2. Questions are uploaded to IPFS (without correct answers); answer hashes are stored on-chain
3. Review and approve student access requests
4. After the deadline, reveal correct answers on-chain
5. The platform auto-grades all submissions and distributes prizes to passing students

### Student Flow

1. Browse available quizzes and request access from the teacher
2. Pay the entry fee — receive a quiz token (minted via on-chain atomic swap)
3. Burn the quiz token to activate a quiz attempt
4. Submit a cryptographic commitment of answers (keeps answers private)
5. After teacher reveals, claim prize via atomic swap if passing

### Prize Distribution

- Prize pool is split equally among all passing students
- Prizes are distributed atomically: student receives prize, teacher receives answer proof
- No intermediary — all settled on-chain via `PrizeSwap` contract

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   User's Browser                    │
│              Next.js Frontend (Port 3000)           │
│    Teacher UI │ Student UI │ Wallet │ Auth          │
└────────────────────────┬────────────────────────────┘
                         │ HTTP / REST
┌────────────────────────▼────────────────────────────┐
│             NestJS Backend (Port 3001)               │
│  Auth │ Quiz │ Access │ Attempt │ Prize │ Wallet     │
│                                                     │
│  ┌─────────────┐   ┌──────────┐   ┌─────────────┐  │
│  │  PostgreSQL  │   │   IPFS   │   │   Bitcoin   │  │
│  │  (Prisma)   │   │ (Pinata) │   │  Computer   │  │
│  └─────────────┘   └──────────┘   └──────┬──────┘  │
└──────────────────────────────────────────┼──────────┘
                                           │
┌──────────────────────────────────────────▼──────────┐
│           Bitcoin Computer (LTC Regtest)            │
│  Quiz │ Payment │ QuizAccess │ AnswerProof │ Swap   │
└─────────────────────────────────────────────────────┘
```

**Key design decisions:**

- The backend is the only party that interacts with the blockchain — it manages encrypted custodial wallets for each user
- Questions are stored on IPFS; answers are hashed with a salt and stored on-chain — neither the backend nor IPFS reveals answers before the reveal phase
- All token operations (minting, burning, swapping) use Bitcoin Computer's static execution pattern, enabling atomic multi-party transactions

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | Next.js | 16.x |
| UI library | React | 19.x |
| Styling | Tailwind CSS | 4.x |
| Component library | Radix UI | Latest |
| State management | Zustand | 5.x |
| Backend framework | NestJS | 11.x |
| ORM | Prisma | 5.x |
| Database | PostgreSQL | 14+ |
| Authentication | NextAuth.js + JWT + Passport | - |
| Blockchain SDK | Bitcoin Computer | 0.26.x |
| Smart contract language | TypeScript (Bitcoin Computer) | - |
| Blockchain network | Litecoin Regtest (LTC) | - |
| IPFS storage | Pinata | - |
| Process manager | PM2 | Latest |
| Web server | Nginx | Latest |
| Hosting | AWS EC2 t3.micro | - |

---

## Smart Contracts

All contracts live in `packages/contracts/src/` and are compiled to `packages/contracts/deploy/`.

| Contract | File | Purpose |
|----------|------|---------|
| `Token` | `Token.ts` | Base TBC20 fungible token — mint, transfer, burn |
| `Quiz` | `Quiz.ts` | Extends Token — represents quiz access token; stores quiz metadata on-chain |
| `Payment` | `Payment.ts` | Holds entry fees and prize pool amounts |
| `QuizAccess` | `QuizAccess.ts` | Atomic execution: student pays → receives quiz token |
| `QuizAttempt` | `QuizAttempt.ts` | Records student's answer commitment on-chain |
| `QuizRedemption` | `QuizRedemption.ts` | Atomic execution: student burns token → activates attempt |
| `AnswerProof` | `AnswerProof.ts` | Proof that student submitted verified answers |
| `PrizeSwap` | `PrizeSwap.ts` | Atomic swap: student receives prize ↔ teacher receives proof |

### Contract Interaction Flow

```
Teacher deploys Quiz contract
        │
        ▼
Student pays entry fee → QuizAccess.exec()
        │         (atomic: payment in, quiz token out)
        ▼
Student burns token → QuizRedemption.redeem()
        │         (atomic: token in, attempt activated)
        ▼
Student submits commitment → QuizAttempt.submitCommitment()
        │
        ▼
Teacher reveals answers → Quiz.revealAnswers()
        │
        ▼
Backend grades attempt → QuizAttempt.verify()
        │
        ▼
Winner claims prize → PrizeSwap.swap()
                  (atomic: prize out, answer proof in)
```

---

## Project Structure

```
bizz/
├── app/
│   ├── backend/                    # NestJS REST API (port 3001)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/           # Signup, login, JWT, wallet creation
│   │   │   │   ├── quiz/           # Create quiz, reveal, list
│   │   │   │   ├── quiz-attempt/   # Submit & verify answers
│   │   │   │   ├── access-request/ # Student access & payment flow
│   │   │   │   ├── prize/          # Prize proofs & atomic swaps
│   │   │   │   └── wallet/         # Balance & transaction history
│   │   │   ├── common/
│   │   │   │   ├── computer-manager.ts  # Bitcoin Computer singleton
│   │   │   │   └── ipfs.service.ts      # IPFS upload & retrieval
│   │   │   └── main.ts             # App bootstrap & CORS config
│   │   └── prisma/
│   │       ├── schema.prisma       # Database schema
│   │       └── migrations/         # Migration history
│   │
│   └── web/                        # Next.js frontend (port 3000)
│       └── src/
│           ├── app/
│           │   ├── (auth)/         # /signin, /signup
│           │   ├── teacher/        # /teacher/create, /teacher/dashboard
│           │   └── student/        # /student/browse, /student/take/[id]
│           ├── components/         # Reusable UI components
│           ├── lib/
│           │   ├── api.ts          # HTTP client with JWT headers
│           │   └── auth.ts         # Auth utilities
│           └── stores/
│               └── authStore.ts    # Zustand global auth state
│
└── packages/
    ├── contracts/                  # Smart contract library
    │   ├── src/                    # TypeScript source contracts
    │   ├── deploy/                 # Compiled JS contracts (used by backend)
    │   └── dist/                   # Compiled TypeScript output
    └── tests/                      # Integration test suite
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 14+
- A [Pinata](https://app.pinata.cloud) account (for IPFS)
- Bitcoin Computer node access (regtest: `https://rltc.node.bitcoincomputer.io`)

### 1. Clone and Install

```bash
git clone <repo-url>
cd bizz

# Install root workspace dependencies
npm install

# Install backend dependencies
cd app/backend && npm install && cd ../..

# Install frontend dependencies
cd app/web && npm install && cd ../..
```

### 2. Configure Environment

Copy the example and fill in your values:

```bash
cp .env.example app/web/.env.local
cp .env.example app/backend/.env
```

See the [Environment Variables](#environment-variables) section for all required values.

### 3. Build Smart Contracts

```bash
cd packages/contracts
npm run build
```

### 4. Set Up Database

```bash
cd app/backend
npx prisma migrate dev
npx prisma generate
```

### 5. Run in Development

```bash
# Terminal 1 — Backend
cd app/backend
npm run start:dev

# Terminal 2 — Frontend
cd app/web
npm run dev
```

Frontend: http://localhost:3000
Backend: http://localhost:3001

---

## Environment Variables

Create `.env.local` (frontend) and `.env` (backend) with the following:

### Database

```env
DATABASE_URL="postgresql://user:password@localhost:5432/bizz_dev"
DIRECT_URL="postgresql://user:password@localhost:5432/bizz_dev"
```

### Authentication

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=                   # openssl rand -base64 32
```

### Wallet & Encryption

```env
WALLET_ENCRYPTION_KEY=             # openssl rand -hex 32
REVEAL_DATA_KEY=                   # openssl rand -hex 32
BITCOIN_COMPUTER_MNEMONIC="your twelve word mnemonic phrase"
```

### Bitcoin Computer

```env
NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK=regtest
NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN=LTC
NEXT_PUBLIC_BITCOIN_COMPUTER_URL=https://rltc.node.bitcoincomputer.io
```

### IPFS (Pinata)

```env
PINATA_JWT=                        # From app.pinata.cloud/keys
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

### Platform Config

```env
NEXT_PUBLIC_PLATFORM_FEE=0.02
NEXT_PUBLIC_MIN_ENTRY_FEE=5000
NEXT_PUBLIC_APP_NAME=Bizz
STUDENT_REVEAL_WINDOW_MINUTES=5    # Use 1440 (24h) in production
TEACHER_REVEAL_WINDOW_MINUTES=5
```

### Backend Only

```env
PORT=3001
FRONTEND_URL=http://localhost:3000  # Comma-separated for multiple origins
NODE_ENV=development
```

---

## Available Scripts

### Root

```bash
npm run dev          # Start Next.js frontend in development
npm run build        # Build contracts + frontend
npm run test         # Run integration test suite
npm run lint         # Lint all workspaces
npm run db:migrate   # Run Prisma migrations
npm run db:studio    # Open Prisma Studio
npm run indexer      # Run blockchain indexer
```

### Backend (`app/backend/`)

```bash
npm run start:dev    # Development with hot reload
npm run start:prod   # Production (requires built dist/)
npm run build        # Compile TypeScript → dist/
npm run test         # Unit tests
npm run test:e2e     # End-to-end tests
```

### Frontend (`app/web/`)

```bash
npm run dev          # Development server
npm run build        # Production build (outputs .next/standalone/)
npm run start        # Start production server
npm run lint         # ESLint
```

### Contracts (`packages/contracts/`)

```bash
npm run build        # Compile TypeScript + generate deploy/ folder
npm run watch        # Watch mode for development
npm run clean        # Remove dist/ and deploy/
```

---

## Database Schema

### Core Models

**User** — Stores both teachers and students with their custodial wallet info

**Quiz** — Stores quiz metadata, IPFS hash of questions, hashed answers, prize pool, and blockchain contract reference

**QuizAttempt** — Records student's answer commitment, score, and prize claim status

**QuizAccessRequest** — Tracks the full student onboarding lifecycle from request → approval → payment → attempt → completion

**Transaction** — Audit log for all on-chain transactions

### QuizAccessRequest Status Flow

```
PENDING → APPROVED → PAID → FEE_CLAIMED → STARTED → COMPLETED
                                                  ↘ CANCELLED
                                   REJECTED ←─────
```

### QuizAttempt Status Flow

```
CREATED → OWNED → COMMITTED → VERIFIED → PRIZE_CLAIMED
```

---

## API Overview

All endpoints require `Authorization: Bearer <jwt>` unless noted.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Register new user, generates custodial wallet |
| POST | `/auth/login` | Login, returns JWT token |

### Quiz

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/quiz/create-ui` | Create quiz with IPFS upload |
| GET | `/quiz` | List all quizzes |
| GET | `/quiz/:id` | Get quiz details |
| PUT | `/quiz/:id/reveal` | Reveal correct answers (teacher) |
| DELETE | `/quiz/:id` | Delete quiz |

### Access Request

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/access-request` | Student requests quiz access |
| GET | `/access-request/student` | Student's access requests |
| GET | `/access-request/teacher` | Teacher's incoming requests |
| POST | `/access-request/:id/pay` | Student pays entry fee |
| POST | `/access-request/:id/claim` | Teacher claims entry fee |
| POST | `/access-request/:id/start` | Student starts quiz attempt |

### Quiz Attempt

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/quiz-attempt/:id/submit` | Submit answer commitment |
| POST | `/quiz-attempt/:id/verify` | Verify attempt after reveal |
| GET | `/quiz-attempt/student` | Student's attempts |
| GET | `/quiz-attempt/:id` | Get attempt details |

### Prize

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/prize/answer-proof` | Create answer proof contract |
| POST | `/prize/:attemptId/payment` | Create prize payment contract |
| POST | `/prize/:attemptId/swap-tx` | Build prize swap transaction |
| POST | `/prize/:attemptId/execute-swap` | Execute atomic prize swap |
| POST | `/prize/:attemptId/claim` | Claim prize |

### Wallet

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wallet/balance` | Get wallet balance |
| POST | `/wallet/faucet` | Fund wallet (regtest only) |

---

## Deployment

The platform is deployed on a single **AWS EC2 t3.micro** instance.

| Service | Location | Port |
|---------|----------|------|
| Next.js frontend | `/home/ubuntu/bizz-frontend/` | 3000 |
| NestJS backend | `/home/ubuntu/bizz/app/backend/` | 3001 |
| PostgreSQL | localhost | 5432 |
| Nginx (reverse proxy) | — | 80 |

Processes are managed by **PM2** with auto-restart on crash and auto-start on server reboot.

For the full step-by-step deployment guide including AWS setup, SSH configuration, Nginx, PM2, and common troubleshooting, refer to the [Notion Deployment Guide](https://www.notion.so/Bizz-Deployment-Guide-3180f5c4f8cc8017abe8d453ce2d5093).

### Quick Redeploy

**Backend changes:**
```bash
npm run build && \
rsync -avz -e "ssh -i ~/.ssh/bizz-key.pem" dist/ ubuntu@100.28.71.167:/home/ubuntu/bizz/app/backend/dist/ && \
ssh -i ~/.ssh/bizz-key.pem ubuntu@100.28.71.167 "pm2 restart bizz-backend"
```

**Frontend changes:**
```bash
npm run build && \
rsync -avz -e "ssh -i ~/.ssh/bizz-key.pem" .next/standalone/ ubuntu@100.28.71.167:/home/ubuntu/bizz-frontend/ && \
rsync -avz -e "ssh -i ~/.ssh/bizz-key.pem" .next/static/ ubuntu@100.28.71.167:/home/ubuntu/bizz-frontend/.next/static/ && \
ssh -i ~/.ssh/bizz-key.pem ubuntu@100.28.71.167 "pm2 restart bizz-frontend"
```

---

## Security Notes

- Never commit `.env`, `.env.local`, or `.pem` files to version control
- All wallet mnemonics are AES-256 encrypted before storage using `WALLET_ENCRYPTION_KEY`
- `NEXTAUTH_SECRET` must be at least 32 characters in production
- SSH access to EC2 is key-pair only — no password authentication
- CORS is restricted to known frontend origins via `FRONTEND_URL` environment variable

---

## License

Private — All rights reserved.
