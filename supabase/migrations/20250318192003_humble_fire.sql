/*
  # Update schema for blood test results and file storage

  1. Schema Changes
    - Add output_txt column to uploaded_files
    - Drop test_groups table and its dependencies
    - Modify blood_test_results to use group_name instead of group_id

  2. Security
    - Update RLS policies for blood_test_results
    - Ensure proper cascading of changes
*/

-- Add output_txt column to uploaded_files
ALTER TABLE uploaded_files
ADD COLUMN IF NOT EXISTS output_txt text;

-- Drop existing policies that depend on test_groups
DROP POLICY IF EXISTS "Users can insert results for their groups" ON blood_test_results;
DROP POLICY IF EXISTS "Users can view results for their groups" ON blood_test_results;

-- Drop foreign key constraints
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'blood_test_results_group_id_fkey'
  ) THEN
    ALTER TABLE blood_test_results DROP CONSTRAINT blood_test_results_group_id_fkey;
  END IF;
END $$;

-- Add new columns before dropping the old ones to preserve data
ALTER TABLE blood_test_results
ADD COLUMN IF NOT EXISTS group_name text,
ADD COLUMN IF NOT EXISTS file_id uuid;

-- Update new columns with data from existing relationships
UPDATE blood_test_results
SET 
  group_name = test_groups.group_name,
  file_id = test_groups.file_id
FROM test_groups
WHERE blood_test_results.group_id = test_groups.id;

-- Now we can drop the old column and table
ALTER TABLE blood_test_results DROP COLUMN group_id;
DROP TABLE test_groups;

-- Make new columns NOT NULL now that they contain data
ALTER TABLE blood_test_results
ALTER COLUMN group_name SET NOT NULL,
ALTER COLUMN file_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE blood_test_results
ADD CONSTRAINT blood_test_results_file_id_fkey 
FOREIGN KEY (file_id) REFERENCES uploaded_files(id) ON DELETE CASCADE;

-- Update RLS policies
ALTER TABLE blood_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own results"
ON blood_test_results
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM uploaded_files
    WHERE uploaded_files.id = blood_test_results.file_id
    AND uploaded_files.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own results"
ON blood_test_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM uploaded_files
    WHERE uploaded_files.id = blood_test_results.file_id
    AND uploaded_files.user_id = auth.uid()
  )
);