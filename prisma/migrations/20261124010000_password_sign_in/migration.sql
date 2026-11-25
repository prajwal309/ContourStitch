BEGIN;

CREATE TABLE "PasswordLogin" (
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    CONSTRAINT "PasswordLogin_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "PasswordLogin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PasswordLogin_username_key" ON "PasswordLogin"("username");

CREATE TABLE "PasswordAttempt" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PasswordAttempt_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "PasswordAttempt_expiresAt_idx" ON "PasswordAttempt"("expiresAt");

COMMIT;
