BEGIN;

CREATE TYPE "MeasurementKey" AS ENUM (
    'height',
    'shoulder',
    'chest',
    'waist',
    'hip',
    'sleeve',
    'inseam',
    'outseam',
    'arm',
    'neck'
);

CREATE TYPE "MeasurementConfidence" AS ENUM ('low', 'medium', 'high');

CREATE TABLE "MeasurementObservation" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "key" "MeasurementKey" NOT NULL,
    "valueCm" DOUBLE PRECISION NOT NULL,
    "unit" "MeasurementUnit" NOT NULL,
    "uncertaintyCm" DOUBLE PRECISION,
    "confidence" "MeasurementConfidence" NOT NULL,
    "method" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeasurementObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeasurementObservation_revisionId_key_key"
    ON "MeasurementObservation"("revisionId", "key");
CREATE INDEX "MeasurementObservation_key_recordedAt_idx"
    ON "MeasurementObservation"("key", "recordedAt");

ALTER TABLE "MeasurementObservation"
    ADD CONSTRAINT "MeasurementObservation_revisionId_fkey"
    FOREIGN KEY ("revisionId") REFERENCES "MeasurementRevision"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

WITH saved AS (
    SELECT
        revision."id" AS revision_id,
        revision."unit" AS unit,
        revision."recordedAt" AS recorded_at,
        estimate.value->>'key' AS measurement_key,
        CASE
            WHEN revision."corrections" ? (estimate.value->>'key')
                THEN (revision."corrections"->>(estimate.value->>'key'))::DOUBLE PRECISION
            ELSE (estimate.value->>'valueCm')::DOUBLE PRECISION
        END AS value_cm,
        CASE
            WHEN revision."corrections" ? (estimate.value->>'key')
                THEN NULL::DOUBLE PRECISION
            ELSE NULLIF(estimate.value->>'uncertaintyCm', 'null')::DOUBLE PRECISION
        END AS uncertainty_cm,
        CASE
            WHEN revision."corrections" ? (estimate.value->>'key')
                THEN 'low'
            ELSE COALESCE(estimate.value->>'confidence', 'low')
        END AS confidence,
        CASE
            WHEN revision."corrections" ? (estimate.value->>'key')
                THEN 'Manually entered tape measurement'
            ELSE COALESCE(estimate.value->>'method', 'Legacy saved estimate')
        END AS method
    FROM "MeasurementRevision" AS revision
    CROSS JOIN LATERAL jsonb_array_elements(revision."estimates") AS estimate(value)
    WHERE estimate.value->>'key' IN (
        'height',
        'shoulder',
        'chest',
        'waist',
        'hip',
        'sleeve',
        'inseam',
        'outseam',
        'arm',
        'neck'
    )
    UNION ALL
    SELECT
        revision."id",
        revision."unit",
        revision."recordedAt",
        correction.key,
        correction.value::DOUBLE PRECISION,
        NULL::DOUBLE PRECISION,
        'low',
        'Manually entered tape measurement'
    FROM "MeasurementRevision" AS revision
    CROSS JOIN LATERAL jsonb_each_text(revision."corrections") AS correction(key, value)
    WHERE correction.key IN (
        'height',
        'shoulder',
        'chest',
        'waist',
        'hip',
        'sleeve',
        'inseam',
        'outseam',
        'arm',
        'neck'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(revision."estimates") AS estimate(value)
        WHERE estimate.value->>'key' = correction.key
    )
)
INSERT INTO "MeasurementObservation" (
    "id",
    "revisionId",
    "key",
    "valueCm",
    "unit",
    "uncertaintyCm",
    "confidence",
    "method",
    "recordedAt"
)
SELECT
    saved.revision_id || ':' || saved.measurement_key,
    saved.revision_id,
    saved.measurement_key::"MeasurementKey",
    saved.value_cm,
    saved.unit,
    saved.uncertainty_cm,
    saved.confidence::"MeasurementConfidence",
    saved.method,
    saved.recorded_at
FROM saved;

COMMIT;
