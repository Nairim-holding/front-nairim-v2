-- Existing points are deliberately unconfirmed; keep them for manual review.
ALTER TABLE "Address" ADD COLUMN "location_confirmation" TEXT;
