/*
  # Update storage for blood test PDFs with public access

  1. Storage Setup
    - Create bucket 'blood-test-pdfs' if not exists
    - Enable RLS
    - Make bucket public
    - Add policies for authenticated users

  2. Security
    - Public read access for PDFs
    - Users can only upload to their own directory
*/

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('blood-test-pdfs', 'blood-test-pdfs', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  -- Clean up any existing policies
  DROP POLICY IF EXISTS "Allow authenticated users to upload PDFs" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to read their PDFs" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public to read PDFs" ON storage.objects;
  
  -- Create new policies
  CREATE POLICY "Allow authenticated users to upload PDFs"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'blood-test-pdfs' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );

  CREATE POLICY "Allow public to read PDFs"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'blood-test-pdfs');
END $$;