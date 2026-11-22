BEGIN;

-- CreateTable
CREATE TABLE "MeasurementRevision" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "unit" "MeasurementUnit" NOT NULL,
    "estimates" JSONB NOT NULL,
    "corrections" JSONB NOT NULL,
    "missing" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeasurementRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "collectionKey" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMembership" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMembership_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "FamilyInvitation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "redeemedById" TEXT,

    CONSTRAINT "FamilyInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutfitSelection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "fitRevisionId" TEXT,
    "extraCm" JSONB NOT NULL,
    "preference" TEXT NOT NULL,
    "fitComplete" BOOLEAN NOT NULL,
    "usesProfile" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutfitSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementRevision_profileId_version_key" ON "MeasurementRevision"("profileId", "version");

-- CreateIndex
CREATE INDEX "FamilyGroup_organizerId_idx" ON "FamilyGroup"("organizerId");

-- CreateIndex
CREATE INDEX "FamilyMembership_userId_joinedAt_idx" ON "FamilyMembership"("userId", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyInvitation_tokenHash_key" ON "FamilyInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "FamilyInvitation_groupId_createdAt_idx" ON "FamilyInvitation"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilyInvitation_redeemedById_idx" ON "FamilyInvitation"("redeemedById");

-- CreateIndex
CREATE INDEX "OutfitSelection_userId_updatedAt_idx" ON "OutfitSelection"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "OutfitSelection_groupId_idx" ON "OutfitSelection"("groupId");

-- CreateIndex
CREATE INDEX "OutfitSelection_fitRevisionId_idx" ON "OutfitSelection"("fitRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "OutfitSelection_userId_scopeKey_key" ON "OutfitSelection"("userId", "scopeKey");

-- AddForeignKey
ALTER TABLE "MeasurementRevision" ADD CONSTRAINT "MeasurementRevision_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MeasurementProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyGroup" ADD CONSTRAINT "FamilyGroup_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvitation" ADD CONSTRAINT "FamilyInvitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvitation" ADD CONSTRAINT "FamilyInvitation_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitSelection" ADD CONSTRAINT "OutfitSelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitSelection" ADD CONSTRAINT "OutfitSelection_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitSelection" ADD CONSTRAINT "OutfitSelection_fitRevisionId_fkey" FOREIGN KEY ("fitRevisionId") REFERENCES "MeasurementRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Preserve existing profiles as their first available historical revision.
INSERT INTO "MeasurementRevision" ("id", "profileId", "version", "unit", "estimates", "corrections", "missing", "recordedAt")
SELECT "id" || ':' || "version", "id", "version", "unit", "estimates", "corrections", "missing", "updatedAt"
FROM "MeasurementProfile";

COMMIT;
