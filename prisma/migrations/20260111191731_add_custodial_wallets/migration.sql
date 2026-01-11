-- AlterTable
ALTER TABLE "User" ADD COLUMN     "encryptedMnemonic" TEXT,
ADD COLUMN     "lastBalanceCheck" TIMESTAMP(3),
ADD COLUMN     "walletBalance" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "walletType" TEXT NOT NULL DEFAULT 'CUSTODIAL';
