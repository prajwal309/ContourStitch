CREATE TYPE "FitPreference" AS ENUM ('slim', 'regular', 'relaxed');

ALTER TABLE "User"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "measurementUnit" "MeasurementUnit" NOT NULL DEFAULT 'cm',
  ADD COLUMN "fitPreference" "FitPreference" NOT NULL DEFAULT 'regular';
