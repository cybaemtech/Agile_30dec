-- ============================================================
-- SQL Script to Backfill Creator Information in work_items
-- ============================================================
-- This script updates existing work_items to populate the
-- createdByName and createdByEmail fields from the users table
-- based on the reporter_id.
--
-- Run this script in your MySQL database (phpMyAdmin or command line)
-- ============================================================

-- Step 1: Add createdByEmail column if it doesn't exist
ALTER TABLE `work_items` 
ADD COLUMN IF NOT EXISTS `createdByEmail` VARCHAR(255) DEFAULT NULL 
AFTER `createdByName`;

-- Step 2: Update all existing work_items to populate creator information
-- This will set createdByName and createdByEmail from the users table
UPDATE `work_items` wi
INNER JOIN `users` u ON wi.reporter_id = u.id
SET 
  wi.createdByName = u.name,
  wi.createdByEmail = u.email
WHERE wi.reporter_id IS NOT NULL;

-- Step 3: Verify the update
SELECT 
  COUNT(*) as total_items,
  COUNT(createdByName) as items_with_creator_name,
  COUNT(reporter_id) as items_with_reporter
FROM `work_items`;

-- Step 4: Show sample of updated records
SELECT 
  id,
  external_id,
  title,
  reporter_id,
  createdByName,
  createdByEmail,
  created_at
FROM `work_items`
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================
-- NOTES:
-- - This script is safe to run multiple times (it will just update the same records)
-- - Any work items without a reporter_id will keep NULL values for createdByName
-- - After running this, refresh your application to see the updated names
-- ============================================================
