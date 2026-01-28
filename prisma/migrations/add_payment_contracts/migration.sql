-- Add Payment contract fields to Winner table
ALTER TABLE "Winner" ADD COLUMN "paymentContractId" TEXT;
ALTER TABLE "Winner" ADD COLUMN "paymentContractRev" TEXT;

-- Add Payment contract field to QuizAttempt table (for winners)
ALTER TABLE "QuizAttempt" ADD COLUMN "paymentContractRev" TEXT;

-- Add index for faster Payment contract lookups
CREATE INDEX "Winner_paymentContractId_idx" ON "Winner"("paymentContractId");
CREATE INDEX "QuizAttempt_paymentContractRev_idx" ON "QuizAttempt"("paymentContractRev");
