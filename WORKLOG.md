# Bizz Quiz Platform — Day-by-Day Work Log

**Developer:** Pasindu Ravishan
**Project:** Bizz — Blockchain-Powered Quiz Platform
**Stack:** Next.js · NestJS · Bitcoin Computer · PostgreSQL · AWS EC2

---

## Overview

This log tracks every working day on the Bizz project, from initial project setup through smart contract development, full-stack integration, architecture restructure, frontend connectivity, and final AWS deployment.

---

## January 7, 2026 — Project Initialization

**Commits:** `Initial commit from Create Next App`, `feat:project-structure-done`, `feat:contracts-and-tests-added`, `fix:lint-errors-fixed`

### What was done

- Bootstrapped the project using `create-next-app`
- Defined the initial project structure — Next.js app with smart contract support
- Created the first versions of the smart contracts in TypeScript using the Bitcoin Computer SDK
- Wrote initial test cases for the contracts
- Fixed ESLint errors from the initial setup
- Established the overall vision: a quiz platform where entry fees and prizes are managed on-chain

### Key files created

- `src/` — Next.js app structure
- Initial smart contract files
- Test scaffolding

---

## January 8, 2026 — Contracts on Regtest + Lint Fixes

**Commits:** `fix:contracts-tested-on-regtest`, `fix:lint-errors-fixed`

### What was done

- Successfully tested smart contracts against the Bitcoin Computer LTC regtest node (`https://rltc.node.bitcoincomputer.io`)
- Verified that contracts deploy and execute correctly on the regtest network
- Resolved further lint issues across the codebase
- Confirmed blockchain connectivity and transaction flow works

### Key outcome

Contracts are deployable and testable on the live regtest node — the blockchain layer is functional.

---

## January 9, 2026 — API Routes, Database, UI, and Indexer

**Commits:** `feat:api-routes-defined-and-connected-db`, `feat:ui-updates`, `feat:indexer-and-test-added`

### What was done

- Defined and implemented the core API routes within Next.js
- Connected the app to PostgreSQL using Prisma ORM
- Set up the initial database schema
- Built initial UI pages for teachers and students
- Implemented a blockchain **indexer** to poll and sync on-chain state to the database
- Added tests for the new functionality

### Key files created

- Next.js API route handlers
- `prisma/schema.prisma` — initial schema
- Indexer service for syncing blockchain events
- UI page components

---

## January 11, 2026 — Blockchain Contracts, Auth, Wallets, IPFS

**Commits:** `feat:contracts-deploying-on-blockchain`, `feat:Authentication-added`, `feat:custodial-wallet-integration`, `feat:IPFS-integrated`

### What was done

**4 major features shipped in one day:**

1. **Contracts on blockchain** — Full contract deployment pipeline working; Quiz, Payment, and related contracts deploy to regtest and return valid contract IDs and revisions

2. **Authentication** — Implemented user signup and login using NextAuth.js; JWT-based sessions; password hashing with bcrypt; role-based access (TEACHER / STUDENT)

3. **Custodial wallets** — Each user automatically gets a Bitcoin Computer wallet on signup; wallet mnemonic is AES-256 encrypted and stored in PostgreSQL; users interact with blockchain without managing their own keys

4. **IPFS integration** — Quiz questions are uploaded to IPFS via Pinata on quiz creation; only the IPFS content hash is stored on-chain and in the database; correct answers are never uploaded to IPFS — only hashed with a salt on-chain

### Key files created

- Auth service and NextAuth config
- Wallet generation and encryption utilities
- IPFS upload/retrieval service (Pinata)
- Contract deployment scripts

---

## January 12, 2026 — Vercel Deployment Fix

**Commits:** `fix:postinstall-added-for-vercel-build`

### What was done

- Fixed the Vercel build pipeline — added a `postinstall` script to ensure contracts are built before the Next.js build runs
- This was necessary because `@bizz/contracts` is a workspace package that must be compiled before it can be imported by the web app
- Resolved Vercel deployment failures caused by missing compiled contract files

---

## January 13, 2026 — Reveal Phase and Payment Distribution

**Commits:** `chore:trigger-redeploy-with-env-vars`, `feat:reveal-done`, `feat:payment-distribution-implement`

### What was done

1. **Answer reveal phase** — Implemented the teacher reveal flow:
   - Teacher calls `revealAnswers()` on the Quiz contract after the deadline
   - Revealed answers are stored on-chain and cached in the database
   - All student attempts are auto-graded by comparing stored commitments to revealed answers
   - Pass/fail status calculated against the configurable `passThreshold`

2. **Payment distribution** — Implemented full prize payout logic:
   - Prize pool divided equally among all passing students
   - Per-winner prize amount calculated: `prizePool / winnerCount`
   - `PrizeSwap` contract handles atomic exchange — student receives prize, teacher receives answer proof
   - Entry fee claim flow for teacher implemented

3. **Environment variable fix** — Triggered Vercel redeploy with corrected env vars

---

## January 14, 2026 — Main Quiz Flow Complete

**Commit:** `feat:Quiz-main-flow-done`

### What was done

- Completed the full end-to-end quiz flow connecting all previously built pieces:
  - Teacher creates quiz → deploys contract → quiz goes live
  - Student requests access → teacher approves
  - Student pays entry fee → receives quiz token via `QuizAccess.exec()` atomic swap
  - Student burns token → activates `QuizAttempt` via `QuizRedemption.redeem()`
  - Student submits answer commitment (hashed answers, kept private)
  - Teacher reveals answers → attempts auto-graded
  - Passing students claim prize via `PrizeSwap.swap()` atomic swap
- All 7 steps of the lifecycle are wired together and functional

### This was the first time the complete quiz lifecycle ran successfully end-to-end.

---

## January 21, 2026 — Full Flow Tests + Bug Fixes

**Commits:** `fix:fixed-flow-issues-upto-reveal-phase`, `test:added-test-cases-for-full-flow`, `fix:fixed-test-errors-and-added-typescript-contracts`

### What was done

- Fixed multiple issues discovered while testing the full reveal phase
- Wrote comprehensive test cases covering the complete quiz lifecycle from creation to prize claim
- Added proper TypeScript typing to all smart contracts
- Fixed test errors that appeared when running the full flow integration tests
- Ensured contracts are strongly typed and export correct TypeScript interfaces

---

## January 23, 2026 — Updated Main Flow

**Commit:** `feat:updated-flow-with-main-flow`

### What was done

- Refined and updated the main quiz flow based on integration test findings
- Improved the overall state machine logic for `QuizAccessRequest` status transitions
- Ensured all edge cases in the flow (e.g. already-started attempts, duplicate requests) are handled

---

## January 26, 2026 — Test Case Updates

**Commit:** `fix:test-cases-updated`

### What was done

- Updated test cases to reflect the latest flow changes
- Improved test reliability and reduced flakiness
- Ensured tests accurately reflect the production flow

---

## January 28, 2026 — Monorepo Migration (Major Restructure)

**Commits:** `Pre-monorepo migration checkpoint`, `feat:Migrate to monorepo structure with packages`, `docs:Add comprehensive migration completion summary`, `feat:Implement automated deploy file generation`, `fix:Remove property declarations from generated deploy files`, `fix:monorepo-structure` (×4 fixes)

### What was done

This was the biggest structural change in the project — a full migration from a single Next.js package to an **npm workspaces monorepo**.

**Before:**
```
packages/
├── web/         # Next.js with embedded API routes
├── api/         # Shared services
├── contracts/   # Smart contracts
├── database/    # Prisma
└── tests/
```

**After:**
```
bizz/
├── app/
│   └── web/     # Pure Next.js frontend (no API routes)
└── packages/
    ├── contracts/
    └── tests/
```

**Key changes:**
- Split the monorepo cleanly with `packages/*` workspace declarations
- Separated smart contract code into `packages/contracts/`
- Implemented automated `deploy/` file generation — a `scripts/build-deploy.js` script automatically extracts and generates JavaScript deploy files from TypeScript contract sources
- Eliminated hardcoded property declarations from generated deploy files
- Took a checkpoint commit before migration to allow rollback

### Why this was done

- Next.js mixing frontend and backend concerns was causing maintainability issues
- The contracts package needed to be independently buildable and importable
- Foundation for the upcoming NestJS backend separation

---

## January 29, 2026 — Exec Function + Test Flow

**Commits:** `feat:added-exec-function-to-test-flow`, `fix:monorepo-structure-2`, `fix:test-fix`

### What was done

- Implemented the `exec()` static function pattern in `QuizAccess` contract — this enables atomic execution where two parties (student and teacher) each sign a transaction and the swap happens in one atomic step
- Updated the test flow to use `exec()` for the token transfer step
- Fixed further monorepo structure issues (import paths, workspace references)
- Fixed failing tests after the monorepo migration

---

## January 30, 2026 — Updated Test Flow with Exec

**Commit:** `feat:updated-test-flow-with-exec-function`

### What was done

- Fully updated all integration tests to use the new `exec()` function pattern
- Validated that atomic swaps work correctly in tests: payment in → quiz token out
- Confirmed all previously passing tests still pass with the new contract pattern

---

## February 3, 2026 — TBC20 Fungible Token Integration

**Commits:** `feat:updated-test-flow-with-TBC20-usage`, `fix:updated-the-seat-access-redemption`, `feature:used-TBC20-Quiz-as-fungible-tokens`

### What was done

- **Major contract redesign** — migrated Quiz access tokens to the **TBC20 fungible token standard** (Bitcoin Computer's equivalent of ERC-20)
- The `Quiz` contract now extends the `Token` base class, making quiz access tokens proper fungible tokens with `mint()`, `transfer()`, and `burn()` methods
- Updated `QuizAccess` and `QuizRedemption` contracts to work with the new token standard
- Updated `SeatAccess` and `SeatRedemption` contracts to match the new redemption pattern
- Updated all integration tests to use TBC20-style token interactions

### Why TBC20

Using fungible tokens gives each quiz its own on-chain token, making access control transparent, auditable, and composable with other Bitcoin Computer contracts.

---

## February 5, 2026 — TBC20 Test Flow Fixed

**Commit:** `fix:fixed-the-test-flow-on-TBC20`

### What was done

- Fixed integration test failures caused by the TBC20 migration
- Resolved issues with token minting and burning in the test environment
- Verified full flow: mint token → transfer to student → burn to start attempt → works correctly

---

## February 10, 2026 — Helper Functions Refactor

**Commit:** `fix:helper-function-used`

### What was done

- Refactored contract interaction code to use dedicated helper functions
- Reduced code duplication across service layer
- Improved readability and maintainability of blockchain interaction code

---

## February 11, 2026 — Naming Fixes

**Commit:** `fix:fixed-namings`

### What was done

- Standardized naming conventions across contracts, services, and DTOs
- Renamed methods and variables for consistency with the established patterns
- Ensured contract method names align with the test suite and frontend expectations

---

## February 12, 2026 — Architecture Restructure Plan

**Commit:** `added-for-versioning(not using)`

### What was done

- Documented and planned the major architecture restructure: moving from Next.js API routes to a dedicated **NestJS** backend
- Created `ARCHITECTURE_RESTRUCTURE.md` with full migration plan, including:
  - Current vs new architecture comparison
  - Module structure for NestJS (auth, quiz, access-request, prize, wallet)
  - Database schema changes
  - API endpoint mapping
  - Student request flow design
  - 6 phased migration plan with time estimates

### The problem being solved

The Next.js app was mixing frontend rendering and backend API logic in the same codebase. This made it hard to:
- Test the backend independently
- Deploy frontend and backend separately
- Scale and maintain each concern independently

The plan: extract all business logic into a dedicated NestJS backend and make Next.js a pure frontend that calls the REST API.

---

## February 13, 2026 — NestJS Phase 1: Infrastructure + DTO Scaffolding

*(No git commit — active development day, tracked via file timestamps)*

### What was done

- **Started Phase 1 of the NestJS migration** — created the NestJS backend skeleton
- Set up the `src/modules/` folder structure housing all feature modules
- Scaffolded the initial **Data Transfer Objects (DTOs)** for the core flows:
  - `quiz-attempt/dto/submit-commitment.dto.ts` — DTO for student answer commitment submission
  - `wallet/dto/fund-wallet.dto.ts` — DTO for wallet funding (regtest faucet)
  - `prize/dto/execute-swap.dto.ts` — DTO for atomic prize swap execution
- DTOs define the shape and validation rules for each API request body using `class-validator` decorators

### Key files created

- `src/modules/` — module folder structure initialized
- `quiz-attempt/dto/submit-commitment.dto.ts`
- `wallet/dto/fund-wallet.dto.ts`
- `prize/dto/execute-swap.dto.ts`

---

## February 16, 2026 — NestJS Phase 2: Auth, Wallet, Prize and ComputerManager

*(No git commit — active development day, tracked via file timestamps)*

### What was done

- **Auth service built** — full implementation of `auth.service.ts`:
  - User signup with password hashing (bcrypt)
  - Bitcoin Computer wallet generation on signup
  - Wallet mnemonic AES-256 encryption before storage
  - Login with JWT token generation
  - JWT payload structure: `{ sub: userId, email }`

- **ComputerManager singleton built** — `common/computer-manager.ts`:
  - Manages one Bitcoin Computer instance per user (keyed by mnemonic)
  - Preserves UTXO state across multiple API requests within a session
  - Critical for correct blockchain transaction ordering

- **Wallet service built** — `wallet/wallet.service.ts`:
  - Get balance from Bitcoin Computer node
  - Get transaction history for a user address
  - Faucet endpoint for funding wallets (regtest only)

- **Controllers scaffolded:**
  - `quiz-attempt/quiz-attempt.controller.ts` — routes for attempt submission and verification
  - `prize/prize.controller.ts` — routes for answer proof, prize payment, and swap

### Key files created

- `src/common/computer-manager.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/wallet/wallet.service.ts`
- `src/modules/quiz-attempt/quiz-attempt.controller.ts`
- `src/modules/prize/prize.controller.ts`

---

## February 17, 2026 — NestJS Phase 3: Quiz Module + Full Frontend Scaffolding

*(No git commit — active development day, tracked via file timestamps)*

### What was done

**Backend:**

- **Quiz module built:**
  - `quiz/quiz.controller.ts` — all quiz routes (create, list, get, reveal, delete)
  - `quiz/dto/create-quiz-ui.dto.ts` — DTO for UI-driven quiz creation (with IPFS upload)
  - `quiz/dto/index.ts` — DTO barrel export
- **IPFS service built** — `common/ipfs.service.ts`:
  - Upload questions to Pinata
  - Multi-gateway retrieval with fallback (ipfs.io → cloudflare-ipfs.com → gateway.pinata.cloud)
  - Answer hashing with salt

**Frontend — major scaffolding day (all components created Feb 17 10:07):**

UI Component library:
- `ui/Button.tsx`, `ui/Badge.tsx`, `ui/Card.tsx`, `ui/Input.tsx`
- `ui/Toast.tsx` — notification system
- `ui/CountdownTimer.tsx` — live countdown to quiz/reveal deadline
- `ui/DeadlineTimeline.tsx` — visual deadline progression
- `ui/FlowProgress.tsx` — step progress indicator for multi-step flows
- `ui/RefundBanner.tsx` — refund notification banner

Feature components:
- `components/AuthWidget.tsx` — login/signup toggle widget
- `components/auth/RoleSelector.tsx` — teacher vs student role selection on signup
- `components/wallet/WalletConnect.tsx` — wallet connection UI
- `components/wallet/WalletBalance.tsx` — balance display with refresh
- `components/TransactionStatus.tsx` — on-chain transaction status tracker
- `components/NetworkStatus.tsx` — blockchain network connectivity indicator
- `components/quiz/ClaimPrizeButton.tsx` — prize claim button with state handling
- `components/quiz/PaymentStatus.tsx` — entry fee payment status display
- `components/quiz/StudentAttemptDetails.tsx` — full attempt detail view
- `components/quiz/RefundClaimModal.tsx` — modal for refund scenarios

State and utilities:
- `stores/authStore.ts` — Zustand store for user auth state
- `contexts/AuthContext.tsx` — React auth context provider
- `contexts/WalletContext.tsx` — React wallet context provider
- `lib/bitcoin-computer.ts` — Bitcoin Computer client helper
- `lib/ipfs.ts` — frontend IPFS utilities
- `lib/crypto.ts` — client-side cryptography helpers
- `types/quiz.ts`, `types/attempt.ts`, `types/user.ts` — TypeScript type definitions

Pages:
- `app/auth/signup/page.tsx` — user registration page with role selection

### Key outcome

By end of day the entire frontend UI component library was in place and the backend quiz module was wired up with IPFS support.

---

## February 18, 2026 — NestJS Phase 4: Module Registration + Remaining DTOs

*(No git commit — active development day, tracked via file timestamps)*

### What was done

- **All NestJS modules formally registered:**
  - `quiz-attempt/quiz-attempt.module.ts` — QuizAttempt module with service and controller
  - `prize/prize.module.ts` — Prize module with service and controller
  - `wallet/wallet.module.ts` — Wallet module with service and controller

- **Remaining DTOs completed:**
  - `quiz-attempt/dto/verify-attempt.dto.ts` — DTO for post-reveal attempt verification
  - `quiz/dto/reveal-answers.dto.ts` — DTO for teacher answer reveal submission
  - `prize/dto/create-answer-proof.dto.ts` — DTO for creating an on-chain answer proof contract (contains contractId, contractRev, answers, nonce, quizId)

- **Wallet controller completed** — `wallet/wallet.controller.ts`:
  - `GET /wallet/balance` — returns user's LTC balance
  - `POST /wallet/faucet` — funds wallet from regtest faucet

### Key outcome

All 6 modules (auth, quiz, quiz-attempt, access-request, prize, wallet) are now formally declared with their module files. The full NestJS module graph is defined.

---

## February 19, 2026 — Integration Planning + Access Request Flow Design

*(No git commit — internal planning and research day)*

### What was done

- Designed the complete `access-request` flow — the most complex module in the system:
  - Student requests → Teacher approves (creates partial signed tx) → Student pays → Student receives token → Teacher claims fee → Student starts attempt
  - Mapped out all 6 status transitions: `PENDING → APPROVED → PAID → FEE_CLAIMED → STARTED → COMPLETED`
  - Planned the partial transaction signing pattern used for atomic QuizAccess token transfer
- Reviewed Bitcoin Computer's `exec()` pattern for atomic multi-party transactions
- Planned how `ComputerManager` would handle the teacher and student Bitcoin Computer instances independently within the same request lifecycle

---

## February 20, 2026 — NestJS Backend Complete (Architecture Restructure)

**Commit:** `fix:updated-architecture`

### What was done

This was the execution of the architecture plan. A full NestJS backend was built from scratch and integrated:

**NestJS Backend modules built:**

| Module | Responsibility |
|--------|---------------|
| `auth` | Signup, login, JWT generation, custodial wallet creation |
| `quiz` | Create quiz, IPFS upload, reveal answers, auto-reveal cron |
| `quiz-attempt` | Submit answer commitment, verify after reveal |
| `access-request` | Full student access lifecycle (request → approve → pay → start) |
| `prize` | Answer proof creation, prize payment, atomic swap execution |
| `wallet` | Balance checking, faucet (regtest), transaction history |

**Infrastructure built:**

- `ComputerManager` singleton — maintains one Bitcoin Computer instance per user mnemonic across requests (preserves UTXO state)
- `IpfsService` — multi-gateway IPFS retrieval with fallback (ipfs.io → cloudflare-ipfs → gateway.pinata.cloud)
- `ValidationPipe` — global DTO validation using class-validator
- JWT `AuthGuard` and `TeacherGuard` for route protection
- CORS configured for frontend origin

**Also done:**

- Removed old Next.js API routes
- Removed old monorepo docs (`MONOREPO_MIGRATION_COMPLETE.md`, `VERCEL_DEPLOYMENT.md`)
- Updated `.gitignore` to exclude `dist/` and sensitive files
- The entire `app/backend/dist/` was committed (compiled output for deployment)

### New folder structure

```
app/
├── backend/     ← New NestJS service (port 3001)
└── web/         ← Pure Next.js frontend (port 3000)
```

---

## February 21, 2026 (Late Night / Saturday) — Prize and Attempt Services + Reveal Page

*(No git commit — tracked via file timestamps: 00:54–01:00, continuation of Friday Feb 20)*

### What was done

Working late into the night extending the Feb 20 session:

- **`prize/prize.service.ts` completed** (21KB):
  - `createAnswerProof()` — deploys AnswerProof contract on-chain for a verified winner
  - `createPrizePayment()` — deploys Payment contract holding prize amount
  - `buildSwapTx()` — constructs the unsigned atomic swap transaction
  - `executeSwap()` — broadcasts the PrizeSwap atomic transaction: student receives prize, teacher receives proof
  - `claimPrize()` — final claim step completing the prize lifecycle

- **`quiz-attempt/quiz-attempt.service.ts` completed** (22KB):
  - `submitCommitment()` — student submits hashed answer commitment on-chain
  - `verifyAttempt()` — after teacher reveals, compares commitment to correct answers and calculates score
  - `computeScore()` — parses commitment format `"commitment-[idx1,idx2,...]-timestamp"`, compares student indices to correct option indices, returns percentage (0–100)
  - `getStudentAttempts()` — fetches all attempts for a student with quiz details

- **Teacher reveal page built** — `app/teacher/reveal/[id]/page.tsx` (24KB):
  - Full reveal flow UI: show quiz stats, trigger reveal, auto-grade all students, display per-student results with scores
  - Prize distribution buttons for each passing student
  - Real-time status updates as prize contracts are created and swapped

- **`QuizSummaryStudent.tsx` component built** (19KB):
  - Comprehensive student-facing quiz card: shows status, entry fee, prize, deadline, attempt status, score after reveal

### Key outcome

The two heaviest backend services (prize and quiz-attempt) completed. Full teacher reveal page built and working.

---

## February 23, 2026 — Quiz Service, Access Request Service + Dashboard Pages

*(No git commit — active development day, tracked via file timestamps)*

### What was done

**Backend (the two largest service files in the entire project):**

- **`quiz/quiz.service.ts` completed** (25KB, ~800 lines):
  - `create()` — deploys Quiz contract to blockchain, caches in DB
  - `createFromUI()` — full pipeline: generate symbol → upload questions to IPFS → hash answers with salt → deploy Quiz contract → cache everything
  - `revealAnswers()` — broadcasts reveal transaction, mines blocks, pre-grades all student attempts, calculates per-winner prize
  - `autoRevealExpiredQuizzes()` — cron job (runs every minute): finds expired ACTIVE quizzes, auto-reveals with failure counter (max 3 retries, then marks COMPLETED)
  - `getAll()`, `getById()`, `delete()`

- **`access-request/access-request.service.ts` completed** (32KB, ~1000 lines — largest file in the project):
  - `request()` — student creates access request, validates no duplicate
  - `approve()` — teacher approves and creates a **partial signed transaction** (teacher's signature on the QuizAccess atomic swap)
  - `executePayment()` — student pays entry fee → receives quiz token via `QuizAccess.exec()` atomic swap
  - `claimEntryFee()` — teacher claims the entry fee payment
  - `startAttempt()` — student burns quiz token → activates `QuizAttempt` via `QuizRedemption.redeem()`
  - Full SYNC logic to reconcile on-chain state with database on every status change

**Frontend:**

- **Teacher dashboard built** — `app/teacher/dashboard/page.tsx` (38KB):
  - List all quizzes created by the teacher with status badges
  - Access request management: view all pending/approved requests, approve/reject with one click
  - Entry fee claim buttons for paid requests
  - Live countdown timers for quiz and reveal deadlines

- **Student dashboard built** — `app/student/dashboard/page.tsx` (24KB):
  - View all quizzes the student has attempted or requested
  - Track access request status per quiz
  - View attempt scores after reveal
  - Navigate to prize claim for passing attempts

- **Student browse page built** — `app/student/browse/page.tsx` (14KB):
  - Browse all active quizzes with entry fee, prize pool, and deadline info
  - Request access button with real-time status feedback

- **`QuizSummaryTeacher.tsx` component** (24KB):
  - Teacher-facing quiz card showing all student attempts, scores, pass/fail counts, and prize distribution status

### Key outcome

The most complex backend services completed. All four main dashboard and browse pages built. The platform is feature-complete from an API and UI perspective — just needs integration testing and final wiring.

---

## February 24, 2026 — Full Frontend-Backend Connectivity

**Commits:** `feat:frontend-connectivity-done`, `fix:loading-with-details-added`

### What was done

This was the day the frontend was wired up to the NestJS backend — the two halves of the app became one working system.

**Frontend pages connected to backend:**

| Page | Connected API Calls |
|------|-------------------|
| `/teacher/create` | `POST /quiz/create-ui` |
| `/teacher/dashboard` | `GET /quiz`, `GET /access-request/teacher`, approve/reject requests |
| `/teacher/reveal/[id]` | `PUT /quiz/:id/reveal`, prize distribution endpoints |
| `/student/browse` | `GET /quiz` |
| `/student/dashboard` | `GET /quiz-attempt/student`, `GET /access-request/student` |
| `/student/take/[id]` | `POST /access-request/:id/start`, `POST /quiz-attempt/:id/submit` |
| `/student/prize/[id]` | `POST /prize/*`, `POST /prize/:id/execute-swap` |

**Also done:**

- Rebuilt `QuizAccess` contract to correctly handle the multi-party exec pattern for teacher-student atomic token transfer
- Updated `Quiz` contract with new fields for frontend display
- Fixed `build-deploy.js` script to correctly generate deploy files
- Updated `QuizSummaryStudent` and `QuizSummaryTeacher` components
- Added loading states and detail views across pages
- Enhanced the prize claiming page with full status tracking and loading details
- Removed old root `package-lock.json` (frontend and backend now manage deps independently)
- Added `@nestjs/schedule` module for the auto-reveal cron job
- Updated Prisma schema with new fields needed by the connected frontend

---

## February 25, 2026 — AWS Account Setup and EC2 Launch

*(No git commit — infrastructure setup day)*

### What was done

- **Created AWS account** — signed up for AWS free tier
- **Launched EC2 instance:**
  - Type: t3.micro (1 vCPU, 1 GB RAM — free tier eligible)
  - OS: Ubuntu Server 22.04 LTS
  - Storage: 20 GB gp3
  - Region: us-east-1
- **Created SSH key pair** — `bizz-key.pem` downloaded and stored at `~/.ssh/bizz-key.pem` with `chmod 400`
- **Allocated Elastic IP** — `100.28.71.167` associated with the instance for a permanent static IP
- **Configured Security Group** — opened inbound ports: 22 (SSH), 80 (HTTP), 3000 (Next.js), 3001 (NestJS)
- **First successful SSH connection** to the EC2 from local Mac

---

## February 26, 2026 — Server Setup: Node.js, PostgreSQL, PM2, Nginx, Swap

*(No git commit — server configuration day)*

### What was done

- **System update:** `sudo apt update && sudo apt upgrade -y`
- **Added 2 GB swap** — critical for t3.micro (1 GB RAM); without swap, Node.js npm install gets killed by OOM:
  ```
  fallocate -l 2G /swapfile → mkswap → swapon → added to /etc/fstab
  ```
- **Installed Node.js 20** via NodeSource setup script
- **Installed PM2 globally** — process manager for keeping both apps alive
- **Installed Nginx** — reverse proxy, enabled and started
- **Installed PostgreSQL** — created `bizz_db` database and `bizz_user` with full privileges
- **Ran Prisma migrations** using `npx prisma@5.22.0 migrate deploy` (version pinned to avoid Prisma 7 breaking changes)

---

## February 27, 2026 — Backend Deployment to EC2 (Issues and Fixes)

*(No git commit — deployment troubleshooting day)*

### What was done

Uploaded the codebase and got the NestJS backend running. Encountered and resolved 4 deployment issues:

**Issue 1 — Cannot find module '@bizz/contracts'**
- Cause: Only `app/backend/` was uploaded; the `@bizz/contracts` workspace package was missing
- Fix: Rsynced the full monorepo to `/home/ubuntu/bizz/` and ran `npm install` from workspace root

**Issue 2 — Cannot find module '@nestjs/core'**
- Cause: Root `package.json` only declares `packages/*` as workspaces; `app/backend/` is not a workspace so its deps were never installed
- Fix: Ran `npm install --omit=dev` separately inside `app/backend/`

**Issue 3 — Wrong PM2 entry point**
- Tried `pm2 start dist/main.js` → "Script not found"
- NestJS compiles to `dist/src/main.js` (mirrors the `src/` folder structure)
- Fix: `pm2 start dist/src/main.js`

**Issue 4 — tsc not found when trying to build contracts on server**
- TypeScript is a devDependency; `--omit=dev` skips it
- Fix: Build locally, upload pre-built `dist/` and `deploy/` folders via rsync

**Result:** `bizz-backend` running via PM2 on port 3001. Verified with `pm2 logs bizz-backend` showing all NestJS routes mapped successfully.

---

## February 28, 2026 (Saturday) + March 1, 2026 (Sunday) — Weekend

---

## March 2, 2026 — Frontend Deployment to EC2

*(No git commit — deployment day)*

### What was done

- **Enabled `output: 'standalone'`** in `next.config.ts` — this tells Next.js to create a self-contained build in `.next/standalone/` with only the minimum required `node_modules`. No `npm install` needed on the server.
- **Built the Next.js app locally** with correct `NEXT_PUBLIC_*` environment variables baked in at compile time (including `NEXT_PUBLIC_API_URL=http://100.28.71.167:3001`)
- **Uploaded three separate folders** via rsync:
  - `.next/standalone/` → `/home/ubuntu/bizz-frontend/`
  - `.next/static/` → `/home/ubuntu/bizz-frontend/.next/static/`
  - `public/` → `/home/ubuntu/bizz-frontend/public/`
- **Created `/home/ubuntu/bizz-frontend/.env.local`** with all runtime secrets: `NEXTAUTH_SECRET`, `WALLET_ENCRYPTION_KEY`, `REVEAL_DATA_KEY`, `DATABASE_URL`, `NEXTAUTH_URL`, `BITCOIN_COMPUTER_MNEMONIC`, `PINATA_JWT`
- **Started frontend with PM2:**
  ```
  pm2 start /home/ubuntu/bizz-frontend/server.js --name bizz-frontend -- -p 3000
  ```
- **Ran `pm2 save` and `pm2 startup`** — both apps now auto-start on EC2 reboot

---

## March 3, 2026 — Nginx Configuration + CORS Initial Fix

*(No git commit — deployment configuration day)*

### What was done

- **Configured Nginx** as reverse proxy:
  - `location /` → proxy to Next.js on port 3000
  - `location /api/` → proxy to NestJS on port 3001
- Hit initial Nginx config issue: placeholder `YOUR_ELASTIC_IP` was not replaced before saving, causing `unknown directive "YOUR_ELASTIC_IPserver"` error
- Fixed config, passed `sudo nginx -t`, reloaded Nginx
- **Discovered CORS issue:** browser showing `Access-Control-Allow-Origin: http://localhost:3000` when frontend at `http://100.28.71.167:3000`
- Root cause traced to broken JavaScript OR chain in `main.ts` where the EC2 IP fallback was unreachable
- **Quick fix applied:** added `FRONTEND_URL=http://100.28.71.167:3000` to `/home/ubuntu/bizz/app/backend/.env` and restarted PM2 — CORS resolved temporarily

---

## March 4, 2026 — End-to-End Testing + DuckDNS Domain Setup

*(No git commit — testing and domain configuration day)*

### What was done

- **Full end-to-end testing** of the deployed application:
  - Teacher signup → wallet created → quiz created → IPFS upload verified
  - Student signup → access request → teacher approval → entry fee payment → quiz token received
  - Student takes quiz → answer commitment submitted
  - Teacher reveals answers → student graded
  - Passing student claims prize → atomic swap executed
- **Added `bizzapp.duckdns.org`** as an additional allowed CORS origin
- Discovered that multiple comma-separated origins in `FRONTEND_URL` caused the `Access-Control-Allow-Origin` header to contain **both** values at once (browser requires exactly one)
- Root cause: NestJS was returning the full array as a header string instead of dynamically returning only the matching origin
- Identified the fix needed: function-based origin callback in NestJS CORS config

---

## March 5, 2026 — CORS Fix (Production Deployment)

**Commit:** `fix:CORS-fixed`

### What was done

**Deployed to AWS EC2** and encountered CORS issues in production.

**Problem:** The backend `main.ts` had a broken JavaScript OR chain that never reached the EC2 IP fallback:

```typescript
// Bug: second fallback never reached
origin: process.env.FRONTEND_URL || 'http://localhost:3000' || 'http://100.28.71.167:3000'
```

**Fix:** Replaced with a function-based origin callback that correctly returns only the matching origin:

```typescript
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',')
  : ['http://localhost:3000'];

app.enableCors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin || true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
});
```

This supports comma-separated multiple origins via `FRONTEND_URL` env var (e.g. `http://100.28.71.167:3000,https://bizzapp.duckdns.org`).

**Also done on this day:**

- Enabled `output: 'standalone'` in `next.config.ts` for optimized EC2 deployment
- Updated `Quiz` and `QuizAccess` contract dist files

---

## AWS Deployment Log (February–March 2026)

The following deployment work was done over multiple sessions. Not all steps are reflected in git commits as they involved server configuration.

### Infrastructure Setup

| Step | What was done |
|------|--------------|
| AWS account created | Free tier account setup |
| EC2 t3.micro launched | Ubuntu 22.04, us-east-1, 20GB gp3 |
| Elastic IP allocated | 100.28.71.167 — permanent static IP |
| SSH key created | `bizz-key.pem` — `chmod 400` on local Mac |
| Security group configured | Ports 22, 80, 3000, 3001 opened |
| 2GB swap added | Required for t3.micro (1GB RAM) |
| Node.js 20 installed | Via NodeSource setup script |
| PM2 installed globally | Process manager for both apps |
| Nginx installed | Reverse proxy for port 80 routing |
| PostgreSQL installed | Local database server |

### Database Setup

- Created `bizz_db` database and `bizz_user` with full privileges
- Ran Prisma migrations using `npx prisma@5.22.0 migrate deploy` (version pinned to avoid Prisma 7 breaking changes)

### Backend Deployment Issues and Fixes

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `Cannot find module '@bizz/contracts'` | Only `app/backend/` uploaded; workspace package missing | Upload full monorepo; run `npm install` from workspace root |
| `Cannot find module '@nestjs/core'` | `app/backend/` not declared as workspace; root install skipped it | Run `npm install --omit=dev` separately in `app/backend/` |
| Prisma P1012 error | `npx prisma` installed v7 (latest); project uses v5 | Always use `npx prisma@5.22.0` |
| Wrong PM2 entry point | Used `dist/main.js`; NestJS compiles to `dist/src/main.js` | Changed to `pm2 start dist/src/main.js` |
| `tsc: not found` on EC2 | TypeScript is devDependency, excluded by `--omit=dev` | Build locally, upload pre-built `dist/` |

### Frontend Deployment

- Enabled `output: 'standalone'` in Next.js config
- Built locally (EC2 has 1GB RAM — building on server risks OOM)
- Uploaded `.next/standalone/`, `.next/static/`, and `public/` separately
- Created `.env.local` on server with all runtime secrets

### Nginx Config

- Configured Nginx to proxy `/` → Next.js (port 3000) and `/api/` → NestJS (port 3001)
- Fixed issue where placeholder `YOUR_ELASTIC_IP` merged with word `server` in config

### PM2 Setup

- Both processes running: `bizz-backend` (port 3001) and `bizz-frontend` (port 3000)
- `pm2 save` + `pm2 startup` configured for auto-start on reboot

### CORS Resolution

- Discovered Nginx was adding duplicate `Access-Control-Allow-Origin` headers alongside NestJS
- Removed all CORS headers from Nginx config
- Fixed NestJS CORS to use function-based origin check returning only the matching origin
- Added `bizzapp.duckdns.org` as an allowed origin via `FRONTEND_URL` env var

### Final Production State

| Service | Location | Status |
|---------|----------|--------|
| Next.js frontend | `http://100.28.71.167:3000` | Running via PM2 |
| NestJS backend | `http://100.28.71.167:3001` | Running via PM2 |
| PostgreSQL | `localhost:5432` | Running |
| Nginx | Port 80 | Active |

---

## Summary of All Working Days

| Date | Focus Area | Key Deliverable |
|------|-----------|----------------|
| Jan 7 | Project setup | Bootstrapped, contracts written, initial tests |
| Jan 8 | Blockchain testing | Contracts verified on LTC regtest node |
| Jan 9 | API + DB + UI + Indexer | Database connected, API routes, UI pages, indexer |
| Jan 11 | Core features | Auth, custodial wallets, IPFS, contract deployment |
| Jan 12 | Deployment fix | Vercel build pipeline fixed with postinstall script |
| Jan 13 | Quiz economics | Reveal phase done, payment distribution working |
| Jan 14 | End-to-end flow | Complete quiz lifecycle working for first time |
| Jan 21 | Testing | Full flow test suite written, TypeScript contracts |
| Jan 23 | Flow refinement | Updated main flow logic and edge case handling |
| Jan 26 | Tests | Updated test cases after flow changes |
| Jan 28 | Monorepo migration | Full restructure to npm workspaces monorepo |
| Jan 29 | Exec function | Atomic `exec()` pattern added to QuizAccess contract |
| Jan 30 | Test update | All tests updated for exec() pattern |
| Feb 3 | TBC20 tokens | Quiz tokens migrated to TBC20 fungible token standard |
| Feb 5 | Test fix | TBC20 test flow fixed and verified |
| Feb 10 | Refactor | Helper functions extracted, code cleaned up |
| Feb 11 | Naming | Naming conventions standardized across codebase |
| Feb 12 | Architecture plan | NestJS migration plan documented (6 phases) |
| Feb 13 | NestJS Phase 1 | Backend skeleton + DTO scaffolding |
| Feb 16 | NestJS Phase 2 | Auth service, ComputerManager, Wallet service, controllers |
| Feb 17 | NestJS Phase 3 | Quiz module, IPFS service, entire frontend component library |
| Feb 18 | NestJS Phase 4 | Module registration, remaining DTOs, wallet controller |
| Feb 19 | Planning | Access request flow design and partial tx pattern research |
| Feb 20 | NestJS complete | Full NestJS backend committed, access-request controller |
| Feb 21 | Prize + Attempt + Reveal | Prize service, quiz-attempt service, teacher reveal page |
| Feb 23 | Largest services | Quiz service (800 lines), access-request service (1000 lines), 4 dashboard pages |
| Feb 24 | Full connectivity | Frontend wired to NestJS backend, all pages connected |
| Feb 25 | AWS setup | EC2 launched, SSH key, Elastic IP, security group |
| Feb 26 | Server setup | Node.js, PostgreSQL, PM2, Nginx, swap, migrations |
| Feb 27 | Backend deploy | Monorepo uploaded, 4 deployment issues resolved, backend running |
| Mar 2 | Frontend deploy | Standalone build, PM2 for frontend, auto-start configured |
| Mar 3 | Nginx + CORS | Nginx configured, initial CORS fix applied |
| Mar 4 | E2E testing | Full flow tested, DuckDNS domain, CORS bug identified |
| Mar 5 | CORS final fix | Function-based CORS origin callback, deployment stable |
