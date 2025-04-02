/*
  # Update storage and RLS policies

  1. Changes
    - Enable public access to blood-test-pdfs bucket for PDF analysis
    - Add RLS policies for text file storage
    - Update existing RLS policies for better security

  2. Security
    - Allow authenticated users to manage their own files
    - Allow public read access for PDF analysis
*/

-- Update storage.buckets policies
BEGIN;

-- Enable RLS on the bucket
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to use the bucket
CREATE POLICY "Allow authenticated users to use bucket"
ON storage.buckets
FOR ALL
TO authenticated
USING (true);

-- Enable RLS on objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public access to PDFs for analysis
CREATE POLICY "Allow public access to PDFs"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'blood-test-pdfs' 
  AND (storage.extension(name) = 'pdf' OR storage.extension(name) = 'txt')
);

-- Allow authenticated users to manage their own files
CREATE POLICY "Users can manage their own files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'blood-test-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'blood-test-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

COMMIT;