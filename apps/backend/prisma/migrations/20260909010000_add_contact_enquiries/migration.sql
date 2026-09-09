-- CreateTable
CREATE TABLE "contact_enquiries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "topic" TEXT NOT NULL DEFAULT 'General enquiry',
    "message" TEXT NOT NULL,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_enquiries_createdAt_idx" ON "contact_enquiries"("createdAt");
