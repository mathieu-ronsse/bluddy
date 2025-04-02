/*
  # Set up storage for blood test PDFs

  1. Storage Setup
    - Create bucket 'blood-test-pdfs'
    - Enable RLS
    - Add policies for authenticated users

  2. Security
    - Users can only upload/read their own files
    - Files are organized by user ID
*/

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('blood-test-pdfs', 'blood-test-pdfs')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  -- Clean up any existing policies
  DROP POLICY IF EXISTS "Allow authenticated users to upload PDFs" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to read their PDFs" ON storage.objects;
  
  -- Create new policies
  CREATE POLICY "Allow authenticated users to upload PDFs"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'blood-test-pdfs' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );

  CREATE POLICY "Allow authenticated users to read their PDFs"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'blood-test-pdfs' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;