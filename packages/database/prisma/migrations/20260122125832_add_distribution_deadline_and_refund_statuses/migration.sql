-- AlterTable: Add new columns to Quiz table
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "studentRevealDeadline" TIMESTAMP(3);
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "distributionDeadline" TIMESTAMP(3);

-- AlterEnum: Add new values to QuizStatus enum
-- Note: Cannot add to existing enum directly, need to use ALTER TYPE
ALTER TYPE "QuizStatus" ADD VALUE IF NOT EXISTS 'ABANDONED';

-- AlterEnum: Add new values to AttemptStatus enum
ALTER TYPE "AttemptStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

-- AlterTable: Rename studentId to userId in QuizAttempt (preserves data)
-- This is a column rename, not drop+add, so data is preserved
ALTER TABLE "QuizAttempt" RENAME COLUMN "studentId" TO "userId";

-- Update the Quiz table to populate studentRevealDeadline where missing
-- Set it to deadline + 5 minutes (300000 ms) for existing records
UPDATE "Quiz"
SET "studentRevealDeadline" = "deadline" + INTERVAL '5 minutes'
WHERE "studentRevealDeadline" IS NULL;

-- Update the Quiz table to populate distributionDeadline where missing
-- Set it to teacherRevealDeadline + 24 hours for existing records
UPDATE "Quiz"
SET "distributionDeadline" = "teacherRevealDeadline" + INTERVAL '24 hours'
WHERE "distributionDeadline" IS NULL;
