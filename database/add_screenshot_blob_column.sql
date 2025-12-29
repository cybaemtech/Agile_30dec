ALTER TABLE work_items
ADD COLUMN screenshot_blob LONGBLOB DEFAULT NULL COMMENT 'Binary data for uploaded screenshot';