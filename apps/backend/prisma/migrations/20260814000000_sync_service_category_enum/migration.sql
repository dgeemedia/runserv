-- This migration documents enum values that were already added directly
-- to the live database (outside Prisma's migration history), causing a
-- drift error. IF NOT EXISTS makes this safe to run even though the
-- values already exist — nothing here touches or deletes any table data.
ALTER TYPE "ServiceCategory" ADD VALUE IF NOT EXISTS 'SOFTWARE';
ALTER TYPE "ServiceCategory" ADD VALUE IF NOT EXISTS 'DEVELOPMENT';
ALTER TYPE "ServiceCategory" ADD VALUE IF NOT EXISTS 'MAINTENANCE';
ALTER TYPE "ServiceCategory" ADD VALUE IF NOT EXISTS 'CONSULTING';