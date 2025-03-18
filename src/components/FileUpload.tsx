import React, { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function FileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Upload to Supabase Storage with progress tracking
      const filename = `${Date.now()}-${file.name}`;
      const { error: uploadError, data } = await supabase.storage
        .from('blood-test-pdfs')
        .upload(filename, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            const percentage = (progress.loaded / progress.total) * 100;
            setProgress(Math.round(percentage));
          },
        });

      if (uploadError) {
        throw new Error(
          uploadError.message === 'The resource already exists'
            ? 'A file with this name already exists'
            : uploadError.message
        );
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('blood-test-pdfs')
        .getPublicUrl(filename);

      console.log('File uploaded successfully:', publicUrl);
      
      // Reset progress after successful upload
      setProgress(100);
      setTimeout(() => {
        setProgress(0);
        setIsUploading(false);
      }, 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="w-full max-w-md">
      <label 
        className={`
          relative
          flex flex-col items-center justify-center w-full h-32
          border-2 border-dashed rounded-lg
          cursor-pointer
          transition-colors
          ${isUploading 
            ? 'bg-gray-50 border-gray-300' 
            : 'border-blue-300 hover:bg-blue-50 hover:border-blue-400'}
        `}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isUploading ? (
            <>
              <Loader2 className="w-8 h-8 mb-3 text-blue-500 animate-spin" />
              <p className="mb-2 text-sm text-gray-500">
                Uploading... {progress}%
              </p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 mb-3 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">PDF files only</p>
            </>
          )}
        </div>
        <input
          type="file"
          className="hidden"
          accept=".pdf,application/pdf"
          onChange={handleFileUpload}
          disabled={isUploading}
        />
        
        {/* Progress bar */}
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-200 rounded-b-lg overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </label>
      
      {error && (
        <div className="mt-2 p-3 bg-red-50 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}