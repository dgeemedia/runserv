-- AlterTable
ALTER TABLE "email_messages" ADD COLUMN     "userId" TEXT;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
