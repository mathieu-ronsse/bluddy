/*
  # Update storage policies for blood test files

  1. Security Changes
    - Enable RLS on storage buckets and objects
    - Add policies for authenticated users to manage their own files
    - Allow public read access to PDF and TXT files for analysis
    - Ensure users can only access their own files based on folder structure

  2. Changes
    - Updated bucket policies to use folder-based access control
    - Added specific policies for PDF and TXT file handling
    - Added checks to prevent duplicate policy creation
*/

DO $$
BEGIN
    -- Enable RLS on buckets if not already enabled
    IF NOT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE tablename = 'buckets'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Allow authenticated users to use bucket" ON storage.buckets;
    DROP POLICY IF EXISTS "Allow public access to PDFs and TXT files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can manage their own files" ON storage.objects;

    -- Create policy to allow authenticated users to use the bucket
    CREATE POLICY "Allow authenticated users to use bucket"
    ON storage.buckets
    FOR ALL
    TO authenticated
    USING (true);

    -- Enable RLS on objects if not already enabled
    IF NOT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE tablename = 'objects'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Allow public access to PDFs and TXT files for analysis
    CREATE POLICY "Allow public access to PDFs and TXT files"
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
END $$;