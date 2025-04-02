/*
  # Update blood test results schema

  1. Changes
    - Make certain fields nullable to handle partial data
    - Add default values where appropriate
    - Ensure proper constraints for required fields

  2. Security
    - Maintain existing RLS policies
*/

-- Modify blood_test_results table
ALTER TABLE blood_test_results
ALTER COLUMN substance SET NOT NULL,
ALTER COLUMN value SET NOT NULL,
ALTER COLUMN unit SET NOT NULL,
ALTER COLUMN group_name SET NOT NULL,
ALTER COLUMN file_id SET NOT NULL,
ALTER COLUMN min_range DROP NOT NULL,
ALTER COLUMN max_range DROP NOT NULL,
ALTER COLUMN is_within_range DROP NOT NULL,
ALTER COLUMN created_at SET DEFAULT now();

-- Ensure proper foreign key constraint
ALTER TABLE blood_test_results
DROP CONSTRAINT IF EXISTS blood_test_results_file_id_fkey,
ADD CONSTRAINT blood_test_results_file_id_fkey 
  FOREIGN KEY (file_id) 
  REFERENCES uploaded_files(id) 
  ON DELETE CASCADE;

-- Update or create the RLS policy
ALTER TABLE blood_test_results ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view their own results" ON blood_test_results;
  DROP POLICY IF EXISTS "Users can manage their own results" ON blood_test_results;
  
  -- Create new policies
  CREATE POLICY "Users can manage their own results"
    ON blood_test_results
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM uploaded_files
        WHERE uploaded_files.id = blood_test_results.file_id
        AND uploaded_files.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM uploaded_files
        WHERE uploaded_files.id = blood_test_results.file_id
        AND uploaded_files.user_id = auth.uid()
      )
    );
END $$;