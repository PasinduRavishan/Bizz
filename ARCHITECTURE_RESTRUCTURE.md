# 🏗️ Bizz Quiz Platform - Architecture Restructure Implementation Plan

**Version:** 1.0
**Date:** February 12, 2026
**Goal:** Migrate from Next.js API routes to NestJS backend with proper separation of concerns

---

## 📋 Table of Contents

1. [Current vs New Architecture](#current-vs-new-architecture)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Database Schema Changes](#database-schema-changes)
5. [Authentication Flow](#authentication-flow)
6. [Module Deployment Strategy](#module-deployment-strategy)
7. [API Endpoints Mapping](#api-endpoints-mapping)
8. [Student Request Flow](#student-request-flow)
9. [Migration Phases](#migration-phases)
10. [Environment Variables](#environment-variables)
11. [Development Workflow](#development-workflow)

---

## 🔄 Current vs New Architecture

### Current Architecture (Before)
```
packages/
├── web/                    # Next.js app with API routes
│   ├── src/app/api/        # API endpoints (TO BE REMOVED)
│   └── src/app/(pages)/    # Frontend pages
├── api/                    # Shared services
├── contracts/              # Smart contracts
├── database/               # Prisma schema
└── tests/                  # Tests
```

**Problems:**
- Next.js mixing frontend and backend concerns
- NextAuth tied to Next.js
- No clear API boundary
- Hard to scale backend independently
- Services scattered across packages

### New Architecture (After)
```
app/
├── web/                    # Pure Next.js frontend
│   └── src/                # No API routes, only UI
└── backend/                # NestJS backend
    ├── src/modules/        # Feature modules
    └── prisma/             # Database schema

packages/
├── contracts/              # Smart contracts only
└── tests/                  # Integration tests
```

**Benefits:**
- Clear separation: Frontend (web) vs Backend (NestJS)
- Independent deployment and scaling
- Better code organization with NestJS modules
- Single source of truth for API (NestJS)
- Easier testing and maintenance

---

## 🛠️ Technology Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Auth:** JWT tokens (stored in localStorage)
- **HTTP Client:** Fetch API with Authorization headers
- **State Management:** Zustand (global state for auth, user, etc.)
- **Local State:** React hooks

### Backend
- **Framework:** NestJS
- **Auth:** Passport.js with JWT strategy
- **Database ORM:** Prisma
- **Validation:** class-validator
- **API Style:** RESTful

### Blockchain
- **SDK:** Bitcoin Computer (@bitcoin-computer/lib)
- **Network:** Litecoin Regtest
- **Pattern:** TBC20 Fungible Token

### Storage
- **Database:** PostgreSQL (development: SQLite)
- **IPFS:** Pinata (backend only)
- **Files:** Local file system for module specs

---

## 📁 Project Structure

```
bizz/
├── app/
│   ├── web/                                    # Next.js Frontend
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/page.tsx
│   │   │   │   │   └── signup/page.tsx
│   │   │   │   ├── teacher/
│   │   │   │   │   ├── dashboard/page.tsx      # Shows pending requests
│   │   │   │   │   └── create/page.tsx
│   │   │   │   ├── student/
│   │   │   │   │   ├── browse/page.tsx
│   │   │   │   │   ├── quiz/[id]/page.tsx      # Request access flow
│   │   │   │   │   └── take/[attemptId]/page.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/
│   │   │   │   └── WalletWidget.tsx
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts               # JWT HTTP client
│   │   │   │   └── auth.ts                     # Auth helpers
│   │   │   └── types/
│   │   │       └── api.types.ts                # API response types
│   │   ├── .env.local
│   │   │   # NEXT_PUBLIC_API_URL=http://localhost:3001
│   │   ├── next.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── backend/                                # NestJS Backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   │   ├── auth.controller.ts      # signup, login
│       │   │   │   ├── auth.service.ts
│       │   │   │   ├── auth.module.ts
│       │   │   │   ├── jwt.strategy.ts
│       │   │   │   ├── dto/
│       │   │   │   │   ├── signup.dto.ts
│       │   │   │   │   └── login.dto.ts
│       │   │   │   └── guards/
│       │   │   │       └── jwt-auth.guard.ts
│       │   │   │
│       │   │   ├── quiz/
│       │   │   │   ├── quiz.controller.ts      # CRUD operations
│       │   │   │   ├── quiz.service.ts
│       │   │   │   ├── quiz.module.ts
│       │   │   │   └── dto/
│       │   │   │       └── create-quiz.dto.ts
│       │   │   │
│       │   │   ├── access-request/             # NEW MODULE
│       │   │   │   ├── access-request.controller.ts
│       │   │   │   ├── access-request.service.ts
│       │   │   │   ├── access-request.module.ts
│       │   │   │   └── dto/
│       │   │   │       ├── request-access.dto.ts
│       │   │   │       └── approve-request.dto.ts
│       │   │   │
│       │   │   ├── attempt/
│       │   │   │   ├── attempt.controller.ts
│       │   │   │   ├── attempt.service.ts
│       │   │   │   └── attempt.module.ts
│       │   │   │
│       │   │   ├── wallet/
│       │   │   │   ├── wallet.controller.ts
│       │   │   │   ├── wallet.service.ts
│       │   │   │   └── wallet.module.ts
│       │   │   │
│       │   │   ├── ipfs/
│       │   │   │   ├── ipfs.service.ts         # Pinata integration
│       │   │   │   └── ipfs.module.ts
│       │   │   │
│       │   │   └── blockchain/
│       │   │       ├── blockchain.service.ts   # Bitcoin Computer wrapper
│       │   │       ├── blockchain.module.ts
│       │   │       └── helpers/
│       │   │           ├── quiz.helper.ts      # From contracts package
│       │   │           ├── payment.helper.ts
│       │   │           ├── attempt.helper.ts
│       │   │           └── redemption.helper.ts
│       │   │
│       │   ├── common/
│       │   │   ├── decorators/
│       │   │   │   └── current-user.decorator.ts
│       │   │   ├── filters/
│       │   │   │   └── http-exception.filter.ts
│       │   │   └── interceptors/
│       │   │       └── transform.interceptor.ts
│       │   │
│       │   ├── database/
│       │   │   └── prisma.service.ts
│       │   │
│       │   ├── app.module.ts
│       │   └── main.ts
│       │
│       ├── prisma/
│       │   ├── schema.prisma                   # All models here
│       │   ├── migrations/
│       │   └── seed.ts
│       │
│       ├── test/
│       │   └── app.e2e-spec.ts
│       │
│       ├── .env
│       │   # See "Environment Variables" section
│       │
│       ├── nest-cli.json
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── contracts/                              # Smart Contracts Only
│   │   ├── src/
│   │   │   ├── Quiz.ts
│   │   │   ├── Token.ts
│   │   │   ├── Payment.ts
│   │   │   ├── QuizAttempt.ts
│   │   │   ├── QuizAccess.ts
│   │   │   ├── QuizRedemption.ts
│   │   │   ├── PrizeSwap.ts
│   │   │   └── AnswerProof.ts
│   │   │
│   │   ├── deploy/                             # Pre-built deploy files
│   │   │   ├── Quiz.deploy.js
│   │   │   ├── Token.deploy.js
│   │   │   ├── Payment.deploy.js
│   │   │   ├── QuizAttempt.deploy.js
│   │   │   ├── QuizAccess.deploy.js
│   │   │   ├── QuizRedemption.deploy.js
│   │   │   ├── PrizeSwap.deploy.js
│   │   │   └── AnswerProof.deploy.js
│   │   │
│   │   ├── scripts/
│   │   │   ├── build-deploy.js                 # Existing: Builds deploy files
│   │   │   └── deploy-all.js                   # NEW: One-time deployment
│   │   │
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── tests/                                  # Integration Tests
│       ├── tbc20.test.ts                       # Reference implementation
│       ├── helpers/
│       └── package.json
│
├── .gitignore
├── package.json                                # Root workspace config
├── turbo.json                                  # Turborepo config (optional)
└── README.md
```

---

## 🗄️ Database Schema Changes

### New Table: QuizAccessRequest

**Purpose:** Tracks the request → approve → pay → start flow

```prisma
model QuizAccessRequest {
  id              String              @id @default(cuid())
  quizId          String
  studentId       String
  status          QuizAccessStatus    @default(PENDING)

  // Teacher approval phase
  partialExecTx   Json?               // Partial signed transaction (serialized)
  approvedAt      DateTime?
  approvedBy      String?             // Teacher who approved

  // Student payment phase
  quizTokenId     String?             // Blockchain NFT ID (rev:...)
  paidAt          DateTime?

  // Quiz start phase
  attemptId       String?             // Links to QuizAttempt
  startedAt       DateTime?

  // Metadata
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  // Relations
  quiz            Quiz                @relation(fields: [quizId], references: [id], onDelete: Cascade)
  student         User                @relation("StudentRequests", fields: [studentId], references: [id], onDelete: Cascade)
  approver        User?               @relation("ApprovedRequests", fields: [approvedBy], references: [id])
  attempt         QuizAttempt?        @relation(fields: [attemptId], references: [id])

  @@index([studentId])
  @@index([quizId])
  @@index([status])
  @@index([approvedBy])
}

enum QuizAccessStatus {
  PENDING      // Student requested access
  APPROVED     // Teacher approved, partial tx created
  PAID         // Student paid entry fee, has Quiz Token NFT
  STARTED      // Student burned NFT, quiz attempt active
  COMPLETED    // Student submitted answers
  CANCELLED    // Cancelled by student
  REJECTED     // Rejected by teacher
}
```

### Updated Table: User

Add relations for access requests:

```prisma
model User {
  id                String              @id @default(cuid())
  email             String              @unique
  name              String
  passwordHash      String
  role              UserRole

  // Existing relations
  quizzesCreated    Quiz[]              @relation("TeacherQuizzes")
  attempts          QuizAttempt[]

  // NEW relations
  accessRequests    QuizAccessRequest[] @relation("StudentRequests")
  approvedRequests  QuizAccessRequest[] @relation("ApprovedRequests")

  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
}
```

### Updated Table: QuizAttempt

Add reverse relation:

```prisma
model QuizAttempt {
  id                String              @id @default(cuid())
  contractId        String              @unique
  quizId            String
  studentId         String

  // Blockchain state
  answerCommitment  String?
  status            String              @default("PENDING")
  score             Int?
  passed            Boolean?

  // Relations
  quiz              Quiz                @relation(fields: [quizId], references: [id])
  student           User                @relation(fields: [studentId], references: [id])
  accessRequest     QuizAccessRequest?  // NEW: Reverse relation

  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@index([studentId])
  @@index([quizId])
}
```

---

## 🔐 Authentication Flow

### Signup Flow

**Frontend:**
```
1. User fills signup form (name, email, password, role)
2. POST /api/auth/signup
3. Store JWT token in localStorage
4. Redirect to dashboard
```

**Backend:**
```
1. Validate DTO (email format, password length, role)
2. Hash password with bcrypt
3. Create user in database
4. Generate unique wallet path: getUserWalletPath(userId, role)
5. Fund wallet with 1M sats (development only)
6. Mine block to confirm
7. Generate JWT token with payload: { id, email, role }
8. Return: { token, user: { id, name, email, role } }
```

### Login Flow

**Frontend:**
```
1. User enters email + password
2. POST /api/auth/login
3. Store JWT token in localStorage
4. Redirect to dashboard
```

**Backend:**
```
1. Find user by email
2. Verify password with bcrypt.compare()
3. Generate JWT token
4. Return: { token, user }
```

### Protected Routes

**All subsequent requests:**
```
Headers: {
  'Authorization': 'Bearer <jwt-token>',
  'Content-Type': 'application/json'
}
```

**Backend validation:**
```
1. @UseGuards(JwtAuthGuard) on controller
2. JwtStrategy validates token signature
3. Token payload attached to request: req.user = { id, email, role }
4. Use @CurrentUser() decorator to access user in controllers
```

---

## 🚀 Module Deployment Strategy

### One-Time Deployment Process

**Step 1: Build Deploy Files**
```bash
cd packages/contracts
npm run build
# Outputs: deploy/*.deploy.js files
```

**Step 2: Deploy All Contracts (Manual, Once)**
```bash
npm run deploy:regtest
```

**Script Output:**
```
🚀 Deploying all contracts to regtest...

✅ Quiz module deployed
   Module ID: rev:ltc1qxyz...abc:0

✅ Token module deployed
   Module ID: rev:ltc1qxyz...def:1

✅ Payment module deployed
   Module ID: rev:ltc1qxyz...ghi:2

✅ QuizAttempt module deployed
   Module ID: rev:ltc1qxyz...jkl:3

✅ QuizAccess module deployed
   Module ID: rev:ltc1qxyz...mno:4

✅ QuizRedemption module deployed
   Module ID: rev:ltc1qxyz...pqr:5

✅ PrizeSwap module deployed
   Module ID: rev:ltc1qxyz...stu:6

✅ AnswerProof module deployed
   Module ID: rev:ltc1qxyz...vwx:7

📋 Copy these to app/backend/.env:
```

**Step 3: Update .env**
```bash
cd app/backend
# Paste module IDs into .env file
```

### Backend Usage

**QuizService example:**
```typescript
@Injectable()
export class QuizService {
  private readonly quizModuleId = process.env.QUIZ_MODULE_ID;

  async createQuiz(teacherId: string, dto: CreateQuizDto) {
    const walletPath = getUserWalletPath(teacherId, 'TEACHER');
    const computer = createBitcoinComputer({ path: walletPath });

    // Use pre-deployed module spec
    const quizHelper = new QuizHelper(computer, this.quizModuleId);

    return quizHelper.createQuiz({
      teacherPubKey: computer.getPublicKey(),
      initialSupply: 1000,
      symbol: dto.symbol,
      questionHashIPFS: dto.questionHashIPFS,
      answerHashes: dto.answerHashes,
      prizePool: dto.prizePool,
      entryFee: dto.entryFee,
      passThreshold: dto.passThreshold,
      deadline: dto.deadline,
      teacherRevealDeadline: dto.teacherRevealDeadline
    });
  }
}
```

**Key Points:**
- Contracts deployed ONCE manually
- Module IDs stored in .env
- Backend reads from .env at startup
- No runtime deployment
- If regtest resets, redeploy and update .env

---

## 🔌 API Endpoints Mapping

### Auth Module

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/signup` | Create new user + fund wallet | No |
| POST | `/api/auth/login` | Login and get JWT token | No |
| GET | `/api/auth/me` | Get current user info | Yes |

### Quiz Module

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/quizzes` | List all active quizzes | No |
| GET | `/api/quizzes/:id` | Get quiz details | No |
| POST | `/api/quizzes` | Create new quiz (teacher) | Yes |
| GET | `/api/quizzes/my` | Get my quizzes (teacher) | Yes |

### Access Request Module (NEW)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/api/access-requests` | Student requests access | Yes | Student |
| GET | `/api/access-requests/my` | Get my requests (student) | Yes | Student |
| GET | `/api/access-requests/pending` | List pending requests (teacher) | Yes | Teacher |
| POST | `/api/access-requests/:id/approve` | Teacher approves request | Yes | Teacher |
| POST | `/api/access-requests/:id/reject` | Teacher rejects request | Yes | Teacher |
| POST | `/api/access-requests/:id/pay` | Student pays entry fee | Yes | Student |
| POST | `/api/access-requests/:id/start` | Student starts quiz (burns NFT) | Yes | Student |
| DELETE | `/api/access-requests/:id` | Cancel request | Yes | Student |

### Attempt Module

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/attempts/:id` | Get attempt details | Yes |
| POST | `/api/attempts/:id/submit` | Submit answers | Yes |
| GET | `/api/attempts/my` | Get my attempts | Yes |

### Wallet Module

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/wallet/balance` | Get wallet balance | Yes |
| POST | `/api/wallet/faucet` | Fund wallet (dev only) | Yes |

---

## 📋 Student Request Flow

### Complete Flow with API Calls

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: STUDENT REQUESTS ACCESS                            │
└─────────────────────────────────────────────────────────────┘

Student Frontend:
  - User clicks "📝 Request Access" on quiz page
  - POST /api/access-requests
    Body: { quizId: "quiz_123" }
  - UI shows: "⏳ Waiting for teacher approval..."

Backend:
  - Validate JWT token → get studentId
  - Create QuizAccessRequest record:
      status: PENDING
      quizId, studentId, createdAt
  - Return: { requestId: "req_456", status: "PENDING" }

Database State:
  QuizAccessRequest
    ├── id: req_456
    ├── quizId: quiz_123
    ├── studentId: student_789
    ├── status: PENDING
    ├── partialExecTx: null
    ├── quizTokenId: null
    └── attemptId: null

─────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: TEACHER APPROVES REQUEST                           │
└─────────────────────────────────────────────────────────────┘

Teacher Frontend:
  - GET /api/access-requests/pending
    Returns: [{ id, student, quiz, createdAt }]
  - Teacher dashboard shows pending requests list
  - Teacher clicks "✅ Approve Access" button
  - POST /api/access-requests/req_456/approve
  - UI shows: "Approved! Student can now pay"

Backend:
  - Validate JWT → get teacherId
  - Verify teacher owns the quiz
  - Get teacher's Bitcoin Computer with unique wallet
  - Create PaymentMock object
  - Create partial EXEC transaction:
      * Uses SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
      * Teacher signs inputs/outputs
      * Mock payment as placeholder
  - Serialize partial transaction to JSON
  - Update QuizAccessRequest:
      status: APPROVED
      partialExecTx: <serialized tx>
      approvedAt: now
      approvedBy: teacherId
  - Return: { success: true }

Database State:
  QuizAccessRequest
    ├── status: APPROVED  ← Changed
    ├── partialExecTx: {...}  ← Filled
    ├── approvedAt: 2026-02-12T10:30:00Z
    ├── approvedBy: teacher_001
    ├── quizTokenId: null
    └── attemptId: null

─────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: STUDENT PAYS ENTRY FEE                             │
└─────────────────────────────────────────────────────────────┘

Student Frontend:
  - GET /api/access-requests/my
    Returns: [{ id, status: "APPROVED", quiz }]
  - UI shows: "💰 Pay Entry Fee (10,000 sats)" button
  - Student clicks button
  - POST /api/access-requests/req_456/pay
  - Loading: "Processing payment..."
  - Success: "✅ Payment successful! You now have Quiz Token"

Backend:
  - Validate JWT → get studentId
  - Get QuizAccessRequest with partial tx
  - Get student's Bitcoin Computer
  - Create real Payment object:
      * recipient: teacher's pubkey
      * amount: quiz.entryFee
      * purpose: "Entry Fee"
      * reference: quiz.contractId
  - Broadcast Payment transaction
  - Wait for mempool
  - Deserialize partial EXEC transaction
  - Complete partial transaction:
      * Replace mock payment with real payment
      * Update input: real payment txId and index
      * Update output: student's scriptPubKey
  - Fund transaction (add inputs for fees)
  - Sign transaction with student's key
  - Broadcast completed transaction
  - Wait for mempool
  - Mine 1 block to confirm
  - Query blockchain for student's new Quiz Token
  - Update QuizAccessRequest:
      status: PAID
      quizTokenId: <token contract id>
      paidAt: now
  - Return: { success: true, quizTokenId }

Database State:
  QuizAccessRequest
    ├── status: PAID  ← Changed
    ├── quizTokenId: "rev:ltc1q...xyz:0"  ← Filled
    ├── paidAt: 2026-02-12T10:35:00Z
    └── attemptId: null

Blockchain State:
  - Teacher received Payment (entry fee)
  - Student received Quiz Token (NFT)
  - Both confirmed on-chain

─────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: STUDENT STARTS QUIZ (BURNS NFT)                    │
└─────────────────────────────────────────────────────────────┘

Student Frontend:
  - GET /api/access-requests/my
    Returns: [{ id, status: "PAID", quiz }]
  - UI shows: "🎯 Start Quiz" button
  - Student clicks button
  - POST /api/access-requests/req_456/start
  - Loading: "Preparing quiz..."
  - Success: Redirect to /student/take/attempt_999

Backend:
  - Validate JWT → get studentId
  - Get QuizAccessRequest with quizTokenId
  - Get student's Bitcoin Computer

  Step 1: Create QuizAttempt object
    - Use QuizAttemptHelper
    - Create attempt with:
        * studentPubKey
        * quizId (contract ID)
        * answerCommitment: "" (empty, will fill on submit)
        * entryFee
        * teacher pubkey
    - Broadcast transaction
    - Wait for mempool
    - Get tempAttempt object from effect

  Step 2: Redeem (Burn) Quiz Token
    - Query latest Quiz Token revision
    - Sync Quiz Token
    - Query latest QuizAttempt revision
    - Sync QuizAttempt
    - Use QuizRedemptionHelper
    - Call redeemQuizToken(syncedToken, syncedAttempt)
    - Broadcast redemption transaction
    - Wait for mempool
    - Mine 1 block to confirm
    - Get validated attempt from effect

  Step 3: Save to database
    - Create QuizAttempt record:
        * contractId: validatedAttempt._id
        * quizId, studentId
        * status: "ACTIVE"
    - Update QuizAccessRequest:
        * status: STARTED
        * attemptId: <db attempt id>
        * startedAt: now

  Step 4: Fetch questions
    - Get quiz.questionHashIPFS from database
    - Fetch questions from IPFS via Pinata
    - Parse JSON

  - Return: {
      attemptId: "attempt_999",
      questions: [...],
      timeLimit: 3600
    }

Database State:
  QuizAccessRequest
    ├── status: STARTED  ← Changed
    ├── attemptId: "attempt_999"  ← Filled
    └── startedAt: 2026-02-12T10:40:00Z

  QuizAttempt (NEW RECORD)
    ├── id: attempt_999
    ├── contractId: "rev:ltc1q...abc:0"
    ├── quizId: quiz_123
    ├── studentId: student_789
    └── status: ACTIVE

Blockchain State:
  - Quiz Token amount: 0 (BURNED ✅)
  - QuizAttempt status: "owned"
  - QuizAttempt isRedeemed: true

─────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: STUDENT TAKES QUIZ                                 │
└─────────────────────────────────────────────────────────────┘

Student Frontend:
  - Quiz interface loads with questions
  - Student answers questions
  - Student clicks "Submit Answers"
  - POST /api/attempts/attempt_999/submit
    Body: { answers: [0, 2, 1, 3, 0] }

Backend:
  - Hash answers with salt (commitment)
  - Update QuizAttempt on blockchain
  - Update database record:
      status: "SUBMITTED"
      answerCommitment: <hash>
  - Update QuizAccessRequest:
      status: "COMPLETED"

...Flow continues with reveal, grading, prize distribution...
```

---

## 🔄 Migration Phases

### Phase 1: Infrastructure Setup (2-3 hours)

**Objectives:**
- Create NestJS backend skeleton
- Setup Prisma in backend
- Deploy contracts once
- Configure environment variables

**Tasks:**
1. Create `app/backend/` directory
2. Initialize NestJS: `nest new backend`
3. Install dependencies:
   - `@nestjs/jwt @nestjs/passport passport-jwt`
   - `@prisma/client prisma`
   - `class-validator class-transformer`
   - `bcryptjs @types/bcryptjs`
   - `@bitcoin-computer/lib`
4. Move `packages/database/prisma` → `app/backend/prisma`
5. Update Prisma schema with QuizAccessRequest table
6. Generate Prisma client: `npx prisma generate`
7. Deploy contracts: `cd packages/contracts && npm run deploy:regtest`
8. Copy module IDs to `app/backend/.env`
9. Create PrismaService in backend
10. Test: Can backend connect to database?

**Success Criteria:**
- ✅ NestJS server starts on port 3001
- ✅ Prisma connects to database
- ✅ All module IDs in .env
- ✅ No build errors

---

### Phase 2: Auth Module Migration (3-4 hours)

**Objectives:**
- Implement JWT authentication in NestJS
- Migrate signup/login from Next.js to NestJS
- Update frontend to use JWT

**Tasks:**

**Backend:**
1. Create AuthModule, AuthController, AuthService
2. Create DTOs: SignupDto, LoginDto
3. Implement JWT strategy with Passport
4. Create JwtAuthGuard
5. Create @CurrentUser() decorator
6. Implement endpoints:
   - POST /api/auth/signup → create user, fund wallet, return JWT
   - POST /api/auth/login → validate credentials, return JWT
   - GET /api/auth/me → return current user (protected)
7. Test with Postman/Insomnia

**Frontend:**
1. Create `lib/api-client.ts` with JWT headers
2. Update signup page to call NestJS endpoint
3. Update login page to call NestJS endpoint
4. Store JWT in localStorage
5. Add Authorization header to all requests
6. Create auth context/hook for user state
7. Update protected routes to check JWT
8. Remove NextAuth completely

**Success Criteria:**
- ✅ Can signup via NestJS → get JWT
- ✅ Can login via NestJS → get JWT
- ✅ Frontend stores JWT and sends in headers
- ✅ Protected endpoints reject without valid JWT
- ✅ Wallet funded on signup (1M sats)

---

### Phase 3: Quiz Module Migration (4-5 hours)

**Objectives:**
- Migrate quiz creation to NestJS
- Implement IPFS upload in backend
- Use pre-deployed module IDs

**Tasks:**

**Backend:**
1. Create QuizModule, QuizController, QuizService
2. Create IpfsService (Pinata integration)
3. Create BlockchainService (Bitcoin Computer wrapper)
4. Create CreateQuizDto
5. Implement endpoints:
   - POST /api/quizzes → create quiz with IPFS upload
   - GET /api/quizzes → list all active quizzes
   - GET /api/quizzes/:id → get quiz details
   - GET /api/quizzes/my → get teacher's quizzes
6. Import QuizHelper from contracts package
7. Use QUIZ_MODULE_ID from .env

**Frontend:**
1. Update teacher create page to call NestJS
2. Send questions in request body (backend uploads to IPFS)
3. Update quiz list to call NestJS endpoint
4. Update quiz detail to call NestJS endpoint

**Success Criteria:**
- ✅ Teacher can create quiz via backend
- ✅ Questions uploaded to IPFS by backend
- ✅ Quiz created on blockchain using pre-deployed module
- ✅ Quiz appears in student browse page
- ✅ Quiz details load correctly

---

### Phase 4: Access Request Flow (6-8 hours)

**Objectives:**
- Implement complete request → approve → pay → start flow
- Create all necessary endpoints
- Build UI for each phase

**Tasks:**

**Database:**
1. Add QuizAccessRequest table via migration
2. Test migrations: `npx prisma migrate dev`

**Backend:**
1. Create AccessRequestModule, Controller, Service
2. Create DTOs: RequestAccessDto, ApproveRequestDto
3. Implement endpoints:
   - POST /api/access-requests → student requests
   - GET /api/access-requests/my → student's requests
   - GET /api/access-requests/pending → teacher's pending list
   - POST /api/access-requests/:id/approve → teacher approves
   - POST /api/access-requests/:id/reject → teacher rejects
   - POST /api/access-requests/:id/pay → student pays
   - POST /api/access-requests/:id/start → student starts
   - DELETE /api/access-requests/:id → cancel request
4. Import helpers: QuizHelper, PaymentHelper, AttemptHelper, RedemptionHelper
5. Use module IDs from .env
6. Implement EXEC pattern (SIGHASH_SINGLE | SIGHASH_ANYONECANPAY)

**Frontend:**
1. Update student quiz detail page:
   - Show "Request Access" button
   - Show "Waiting for approval" status
   - Show "Pay Entry Fee" button when approved
   - Show "Start Quiz" button when paid
2. Create teacher dashboard section:
   - List pending requests
   - "Approve" and "Reject" buttons
   - Request details modal
3. Add loading states and error handling
4. Poll for status updates or use optimistic UI

**Success Criteria:**
- ✅ Student can request access
- ✅ Teacher sees pending request in dashboard
- ✅ Teacher can approve request
- ✅ Student sees "Pay Entry Fee" button
- ✅ Student can pay and receive Quiz Token NFT
- ✅ Student sees "Start Quiz" button
- ✅ Student can start quiz (NFT burned, attempt created)
- ✅ Student sees questions
- ✅ Complete flow matches tbc20.test.ts

---

### Phase 5: Remaining Features (6-8 hours)

**Objectives:**
- Migrate answer submission
- Migrate teacher reveal
- Migrate prize distribution
- Update all dashboard views

**Tasks:**

**Backend:**
1. Create AttemptModule with submit endpoint
2. Create RevealModule for teacher reveal
3. Create PrizeModule for prize distribution
4. Import remaining helpers from contracts

**Frontend:**
1. Update quiz taking page for answer submission
2. Update teacher reveal page
3. Update prize claiming flow
4. Update all dashboard stats and lists

**Success Criteria:**
- ✅ Student can submit answers
- ✅ Teacher can reveal and grade
- ✅ Student can claim prize
- ✅ All dashboards show correct data
- ✅ No Next.js API routes remaining

---

### Phase 6: Cleanup & Testing (2-3 hours)

**Tasks:**
1. Remove all Next.js API routes (`app/web/src/app/api/`)
2. Remove NextAuth configuration
3. Remove packages/api directory
4. Update README with new architecture
5. Test complete flow end-to-end
6. Fix any remaining bugs

**Success Criteria:**
- ✅ No API routes in Next.js
- ✅ All features working through NestJS
- ✅ Complete flow tested: signup → create quiz → request → approve → pay → start → submit → reveal → prize
- ✅ Documentation updated

---

## 🌍 Environment Variables

### Frontend (.env.local)

```bash
# API URL
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Backend (.env)

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/bizz?schema=public"
# or for development:
# DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=7d

# Bitcoin Computer
BC_NETWORK=regtest
BC_CHAIN=LTC
BC_URL=http://localhost:18443
BC_RPC_USER=user
BC_RPC_PASSWORD=password

# Pre-deployed Module IDs (from deploy script)
QUIZ_MODULE_ID=rev:ltc1q...abc:0
TOKEN_MODULE_ID=rev:ltc1q...def:1
PAYMENT_MODULE_ID=rev:ltc1q...ghi:2
QUIZ_ATTEMPT_MODULE_ID=rev:ltc1q...jkl:3
QUIZ_ACCESS_MODULE_ID=rev:ltc1q...mno:4
QUIZ_REDEMPTION_MODULE_ID=rev:ltc1q...pqr:5
PRIZE_SWAP_MODULE_ID=rev:ltc1q...stu:6
ANSWER_PROOF_MODULE_ID=rev:ltc1q...vwx:7

# IPFS (Pinata)
PINATA_API_KEY=your-pinata-api-key
PINATA_SECRET_KEY=your-pinata-secret-key
PINATA_JWT=your-pinata-jwt

# Server
PORT=3001
NODE_ENV=development
```

---

## 💻 Development Workflow

### Initial Setup

```bash
# 1. Install dependencies
npm install

# 2. Setup database
cd app/backend
npx prisma migrate dev
npx prisma generate

# 3. Deploy contracts (one time)
cd packages/contracts
npm run build
npm run deploy:regtest
# Copy module IDs to app/backend/.env

# 4. Seed database (optional)
cd app/backend
npx prisma db seed
```

### Running Development Servers

**Terminal 1: Backend**
```bash
cd app/backend
npm run start:dev
# Runs on http://localhost:3001
# Hot reload enabled
```

**Terminal 2: Frontend**
```bash
cd app/web
npm run dev
# Runs on http://localhost:3000
```

**Terminal 3: Prisma Studio (optional)**
```bash
cd app/backend
npx prisma studio
# Runs on http://localhost:5555
# Visual database browser
```

### Making Changes

**Backend changes:**
1. Edit files in `app/backend/src/`
2. NestJS auto-reloads (watch mode)
3. Test via frontend or Postman

**Frontend changes:**
1. Edit files in `app/web/src/`
2. Next.js auto-reloads (Fast Refresh)
3. Changes visible immediately

**Database schema changes:**
1. Edit `app/backend/prisma/schema.prisma`
2. Run: `npx prisma migrate dev --name your_change_name`
3. Run: `npx prisma generate`
4. Restart backend

**Contract changes:**
1. Edit files in `packages/contracts/src/`
2. Run: `npm run build` (generates deploy files)
3. Run: `npm run deploy:regtest` (redeploy)
4. Update module IDs in `app/backend/.env`
5. Restart backend

### Testing Flow

**1. Test Auth:**
- Signup new user → check JWT returned
- Login existing user → check JWT returned
- Call protected endpoint without JWT → expect 401
- Call protected endpoint with JWT → expect success

**2. Test Quiz Creation:**
- Login as teacher
- Create quiz with questions
- Check IPFS upload (verify hash)
- Check blockchain (verify contract created)
- Check database (verify record saved)

**3. Test Access Request Flow:**
- Login as student
- Request access to quiz
- Login as teacher
- See pending request
- Approve request
- Login as student
- Pay entry fee
- Start quiz
- Verify NFT burned
- See questions

**4. Test Complete Flow:**
- Follow tbc20.test.ts flow exactly
- Verify each step matches test expectations

---

## 📝 Notes

**Important Reminders:**

1. **Module Deployment:**
   - Only deploy contracts ONCE
   - Reuse module IDs from .env
   - If regtest resets, redeploy and update .env

2. **Database Migrations:**
   - Always create migrations for schema changes
   - Never edit migrations manually
   - Run migrations before starting backend

3. **Environment Variables:**
   - Never commit .env files to git
   - Add .env to .gitignore
   - Use .env.example as template

4. **Error Handling:**
   - All endpoints should return consistent format
   - Use NestJS exception filters
   - Log errors for debugging

5. **Security:**
   - Validate all DTOs with class-validator
   - Hash passwords with bcrypt
   - Validate JWT on all protected routes
   - Never expose private keys or module specs

6. **Testing:**
   - Test each phase before moving to next
   - Use tbc20.test.ts as reference
   - Test error cases (invalid data, unauthorized, etc.)

---

## 🎯 Success Metrics

**The restructure is complete when:**

- ✅ No API routes exist in Next.js (`app/web/src/app/api/` is deleted)
- ✅ All API calls go to NestJS backend (port 3001)
- ✅ Authentication uses JWT (no NextAuth)
- ✅ Complete quiz flow works: create → request → approve → pay → start → submit → reveal → prize
- ✅ All blockchain operations use pre-deployed modules
- ✅ Teachers see pending requests and can approve
- ✅ Students see status updates (pending → approved → paid → started)
- ✅ Flow matches tbc20.test.ts exactly
- ✅ All tests pass
- ✅ Documentation updated

---

**End of Implementation Plan**
