-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TEACHER', 'STUDENT', 'BOTH');

-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('ACTIVE', 'REVEALED', 'COMPLETED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('COMMITTED', 'REVEALED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('QUIZ_CREATION', 'QUIZ_ATTEMPT', 'REVEAL_ANSWERS', 'PAYOUT', 'REFUND');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "totalEarnings" BIGINT NOT NULL DEFAULT 0,
    "quizzesCreated" INTEGER NOT NULL DEFAULT 0,
    "quizzesTaken" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "contractRev" TEXT NOT NULL,
    "txHash" TEXT,
    "teacherId" TEXT NOT NULL,
    "questionHashIPFS" TEXT NOT NULL,
    "answerHashes" TEXT[],
    "questionCount" INTEGER NOT NULL,
    "prizePool" BIGINT NOT NULL,
    "entryFee" BIGINT NOT NULL,
    "passThreshold" INTEGER NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "deadline" TIMESTAMP(3) NOT NULL,
    "studentRevealDeadline" TIMESTAMP(3) NOT NULL,
    "teacherRevealDeadline" TIMESTAMP(3) NOT NULL,
    "status" "QuizStatus" NOT NULL DEFAULT 'ACTIVE',
    "revealedAnswers" TEXT[],
    "salt" TEXT,
    "title" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "contractRev" TEXT NOT NULL,
    "txHash" TEXT,
    "studentId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "answerCommitment" TEXT NOT NULL,
    "revealedAnswers" TEXT[],
    "nonce" TEXT,
    "score" INTEGER,
    "passed" BOOLEAN,
    "prizeAmount" BIGINT,
    "status" "AttemptStatus" NOT NULL DEFAULT 'COMMITTED',
    "submitTimestamp" TIMESTAMP(3) NOT NULL,
    "revealTimestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Winner" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "prizeAmount" BIGINT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Winner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT,
    "amount" BIGINT,
    "relatedQuizId" TEXT,
    "relatedAttemptId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastBlockHeight" INTEGER NOT NULL DEFAULT 0,
    "lastSyncTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_publicKey_key" ON "User"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE INDEX "User_publicKey_idx" ON "User"("publicKey");

-- CreateIndex
CREATE INDEX "User_address_idx" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_contractId_key" ON "Quiz"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_contractRev_key" ON "Quiz"("contractRev");

-- CreateIndex
CREATE INDEX "Quiz_teacherId_idx" ON "Quiz"("teacherId");

-- CreateIndex
CREATE INDEX "Quiz_status_idx" ON "Quiz"("status");

-- CreateIndex
CREATE INDEX "Quiz_deadline_idx" ON "Quiz"("deadline");

-- CreateIndex
CREATE INDEX "Quiz_contractId_idx" ON "Quiz"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_contractId_key" ON "QuizAttempt"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_contractRev_key" ON "QuizAttempt"("contractRev");

-- CreateIndex
CREATE INDEX "QuizAttempt_studentId_idx" ON "QuizAttempt"("studentId");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_idx" ON "QuizAttempt"("quizId");

-- CreateIndex
CREATE INDEX "QuizAttempt_status_idx" ON "QuizAttempt"("status");

-- CreateIndex
CREATE INDEX "QuizAttempt_contractId_idx" ON "QuizAttempt"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Winner_attemptId_key" ON "Winner"("attemptId");

-- CreateIndex
CREATE INDEX "Winner_quizId_idx" ON "Winner"("quizId");

-- CreateIndex
CREATE INDEX "Winner_paid_idx" ON "Winner"("paid");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txHash_key" ON "Transaction"("txHash");

-- CreateIndex
CREATE INDEX "Transaction_txHash_idx" ON "Transaction"("txHash");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_fromAddress_idx" ON "Transaction"("fromAddress");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
