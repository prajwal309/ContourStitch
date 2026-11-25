CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'CAMERA', 'ACCURACY', 'IMPROVEMENT');
CREATE TYPE "ConsentStatus" AS ENUM ('ACCEPTED', 'DECLINED', 'REVOKED');

CREATE TABLE "ConsentEvent" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "agreementVersion" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConsentEvent_status_timestamps" CHECK (
      ("status" = 'ACCEPTED' AND "acceptedAt" IS NOT NULL AND "revokedAt" IS NULL) OR
      ("status" = 'DECLINED' AND "acceptedAt" IS NULL AND "revokedAt" IS NULL) OR
      ("status" = 'REVOKED' AND "acceptedAt" IS NOT NULL AND "revokedAt" IS NOT NULL AND "revokedAt" >= "acceptedAt")
    )
);

CREATE INDEX "ConsentEvent_userId_type_id_idx" ON "ConsentEvent"("userId", "type", "id" DESC);
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
