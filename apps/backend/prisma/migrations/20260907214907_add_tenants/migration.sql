/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,pair]` on the table `exchange_rates` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,slug]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('PLATFORM', 'AGENCY');

-- CreateEnum
CREATE TYPE "TenantFeeModel" AS ENUM ('TRANSACTION_PCT', 'FX_SPREAD_SHARE', 'FLAT_SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('PENDING_ONBOARDING', 'ACTIVE', 'SUSPENDED');

-- DropIndex
DROP INDEX "exchange_rates_pair_key";

-- DropIndex
DROP INDEX "organizations_slug_key";

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "exchange_rates" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "platformFeeUsd" DECIMAL(12,2),
ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "TenantType" NOT NULL DEFAULT 'AGENCY',
    "status" "TenantStatus" NOT NULL DEFAULT 'PENDING_ONBOARDING',
    "supportEmail" TEXT,
    "flutterwaveSubaccountId" TEXT,
    "flutterwaveOnboardedAt" TIMESTAMP(3),
    "feeModel" "TenantFeeModel" NOT NULL DEFAULT 'TRANSACTION_PCT',
    "feePct" DECIMAL(5,2) NOT NULL DEFAULT 3.0,
    "flatFeeUsd" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_fee_ledger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "feeModel" "TenantFeeModel" NOT NULL,
    "feeUsdAmount" DECIMAL(12,2) NOT NULL,
    "tenantUsdAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_fee_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "platform_fee_ledger_paymentId_key" ON "platform_fee_ledger"("paymentId");

-- CreateIndex
CREATE INDEX "platform_fee_ledger_tenantId_createdAt_idx" ON "platform_fee_ledger"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_users_tenantId_idx" ON "admin_users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_tenantId_pair_key" ON "exchange_rates"("tenantId", "pair");

-- CreateIndex
CREATE INDEX "organizations_tenantId_idx" ON "organizations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_tenantId_slug_key" ON "organizations"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "payments_tenantId_idx" ON "payments"("tenantId");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_ledger" ADD CONSTRAINT "platform_fee_ledger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_ledger" ADD CONSTRAINT "platform_fee_ledger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
