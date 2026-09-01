-- AlterTable
ALTER TABLE "FieldProvenance" ADD COLUMN "confidence" REAL;
ALTER TABLE "FieldProvenance" ADD COLUMN "fieldConfidences" JSONB;
