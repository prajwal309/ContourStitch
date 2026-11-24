-- AlterTable
ALTER TABLE "FamilyGroup" ADD COLUMN     "occasion" TEXT;

-- CreateTable
CREATE TABLE "FamilyProfileShare" (
    "groupId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,

    CONSTRAINT "FamilyProfileShare_pkey" PRIMARY KEY ("groupId","memberId")
);

-- CreateIndex
CREATE INDEX "FamilyProfileShare_organizerId_idx" ON "FamilyProfileShare"("organizerId");

-- CreateIndex
CREATE INDEX "FamilyProfileShare_revisionId_idx" ON "FamilyProfileShare"("revisionId");

-- AddForeignKey
ALTER TABLE "FamilyProfileShare" ADD CONSTRAINT "FamilyProfileShare_groupId_memberId_fkey" FOREIGN KEY ("groupId", "memberId") REFERENCES "FamilyMembership"("groupId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyProfileShare" ADD CONSTRAINT "FamilyProfileShare_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyProfileShare" ADD CONSTRAINT "FamilyProfileShare_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "MeasurementRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

