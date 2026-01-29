-- Migration: Fix Referral/Commission System for Production Readiness
-- Date: 2025-11-21
-- Purpose: Address three root causes:
--   1. Incomplete Idempotency Coverage (add metadata field, index on caktoOrderId)
--   2. Missing Row-Level Locking (fixed in application code - balance-scheduler.ts)
--   3. Flawed totalEarned Calculation (add totalRefunded field)

-- ROOT CAUSE 1: Add metadata field for tracking additional commission info (current_period, etc)
ALTER TABLE referral_commissions 
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- ROOT CAUSE 1: Add index on caktoOrderId for better idempotency checks
CREATE INDEX IF NOT EXISTS "IDX_referral_commissions_order" 
ON referral_commissions (cakto_order_id);

-- ROOT CAUSE 1: Drop the problematic unique constraint that doesn't handle NULLs properly
-- Note: Postgres treats NULL != NULL, so unique constraints with nullable columns don't work as expected
-- We'll rely on application-level idempotency checks instead (see storage.ts createReferralCommission)
ALTER TABLE referral_commissions 
DROP CONSTRAINT IF EXISTS "UNQ_referral_commission_idempotency";

-- ROOT CAUSE 3: Add totalRefunded field to track refunds separately from totalEarned
-- This prevents negative balances when users have already withdrawn funds
-- totalEarned = lifetime gross (IMMUTABLE - never subtract)
-- totalRefunded = lifetime refunds/chargebacks (only add)
-- Net earnings = totalEarned - totalRefunded
ALTER TABLE referral_wallet 
ADD COLUMN IF NOT EXISTS total_refunded integer DEFAULT 0;

-- Add helpful comment to totalEarned column
COMMENT ON COLUMN referral_wallet.total_earned IS 'Lifetime gross earnings - IMMUTABLE, never subtract from this value';
COMMENT ON COLUMN referral_wallet.total_refunded IS 'Lifetime refunds/chargebacks - only add to this value, never subtract';

-- Update existing wallets to set totalRefunded to 0 if NULL
UPDATE referral_wallet 
SET total_refunded = 0 
WHERE total_refunded IS NULL;

-- MIGRATION NOTES:
-- 1. This migration is backward compatible
-- 2. Existing commission records will have NULL metadata (acceptable)
-- 3. Existing wallets will have totalRefunded = 0 (correct starting state)
-- 4. Application code changes in:
--    - shared/schema.ts: Added metadata & totalRefunded fields
--    - server/storage.ts: Updated cancelReferralCommissionsForUser to use totalRefunded
--    - server/balance-scheduler.ts: Added row-level locking for wallets, use totalRefunded
--    - server/routes.ts: Updated webhooks to pass caktoOrderId and metadata
-- 5. Frontend changes needed in client/src/pages/Referrals.tsx to display net earnings
