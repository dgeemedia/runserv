-- Bank/settlement details an agency submits so RunServ staff can
-- manually create their Flutterwave sub-account (subaccounts must be
-- created under RunServ's own Flutterwave account).
ALTER TABLE "tenants" ADD COLUMN "settlementBankName" TEXT;
ALTER TABLE "tenants" ADD COLUMN "settlementAccountNumber" TEXT;
ALTER TABLE "tenants" ADD COLUMN "settlementAccountName" TEXT;
ALTER TABLE "tenants" ADD COLUMN "settlementCountry" TEXT;
ALTER TABLE "tenants" ADD COLUMN "settlementSubmittedAt" TIMESTAMP(3);
