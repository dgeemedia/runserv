/*
  Warnings:

  - Made the column `tenantId` on table `admin_users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `exchange_rates` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `organizations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `payments` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_tenantId_fkey";

-- AlterTable
ALTER TABLE "admin_users" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "exchange_rates" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "tenantId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
