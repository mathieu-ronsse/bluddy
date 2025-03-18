/*
  # Configure storage policies for blood test PDFs

  1. Storage Policies
    - Enable authenticated users to upload PDFs to the blood-test-pdfs bucket
    - Allow users to read their own uploaded files
    - Restrict file types to PDFs only
*/

-- Create storage policy to allow authenticated users to upload PDFs
CREATE POLICY "Allow authenticated users to upload PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'blood-test-pdfs' AND
  (storage.extension(name) = 'pdf')
);

-- Create storage policy to allow users to read their own files
CREATE POLICY "Allow users to read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'blood-test-pdfs' AND
  auth.uid() = owner
);

-- Create storage policy to allow users to update their own files
CREATE POLICY "Allow users to update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'blood-test-pdfs' AND
  auth.uid() = owner
)
WITH CHECK (
  bucket_id = 'blood-test-pdfs' AND
  auth.uid() = owner AND
  (storage.extension(name) = 'pdf')
);

-- Create storage policy to allow users to delete their own files
CREATE POLICY "Allow users to delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'blood-test-pdfs' AND
  auth.uid() = owner
);