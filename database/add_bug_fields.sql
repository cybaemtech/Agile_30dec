ALTER TABLE `work_items`
ADD COLUMN `estimated_hours` DECIMAL(6,2) DEFAULT NULL COMMENT 'Estimated hours for bug',
ADD COLUMN `actual_hours` DECIMAL(6,2) DEFAULT NULL COMMENT 'Actual hours spent on bug',
ADD COLUMN `current_behavior` TEXT DEFAULT NULL COMMENT 'Current behavior for bug',
ADD COLUMN `expected_behavior` TEXT DEFAULT NULL COMMENT 'Expected behavior for bug';
-- Add bug fields to work_items table for bug tracking
ALTER TABLE `work_items`
ADD COLUMN `bug_type` VARCHAR(100) DEFAULT NULL COMMENT 'Type of bug',
ADD COLUMN `severity` VARCHAR(50) DEFAULT NULL COMMENT 'Severity of bug',
ADD COLUMN `reference_url` VARCHAR(255) DEFAULT NULL COMMENT 'Reference URL for bug',
ADD COLUMN `screenshot` VARCHAR(255) DEFAULT NULL COMMENT 'Screenshot path for bug';

-- Add indexes for new fields if needed
ALTER TABLE `work_items` ADD INDEX `idx_bug_type` (`bug_type`);
ALTER TABLE `work_items` ADD INDEX `idx_severity` (`severity`);
