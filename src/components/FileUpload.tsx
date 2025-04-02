import React, { useState, useEffect } from 'react';
import { Upload, Loader2, FileText, RefreshCw, Eye, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { extractTextFromPDF } from '../lib/replicate';
import { parseBloodTestResults } from '../lib/parser';
import type { UploadedFile, BloodTestResult } from '../types';

export function FileUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState<string | null>(null);
  const [selectedResults, setSelectedResults] = useState<BloodTestResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    try {
      const { data, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .order('date_uploaded', { ascending: false });

      if (error) throw error;
      console.log('Loaded files:', data);
      setFiles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
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

      // Create a unique filename with user ID path
      const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${user.id}/${uniqueFilename}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('blood-test-pdfs')
        .upload(filePath, file, {
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
        .getPublicUrl(filePath);

      // Create uploaded file record
      const { data: fileRecord, error: fileError } = await supabase
        .from('uploaded_files')
        .insert({
          user_id: user.id,
          filename: file.name,
          pdf_url: publicUrl
        })
        .select()
        .single();

      if (fileError || !fileRecord) {
        await supabase.storage
          .from('blood-test-pdfs')
          .remove([filePath]);
        throw new Error('Failed to save file record');
      }

      // Reset states and refresh file list
      setProgress(100);
      setTimeout(() => {
        setProgress(0);
        setIsUploading(false);
        setShowUpload(false);
        loadFiles();
      }, 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
      setIsUploading(false);
      setProgress(0);
    }
  }

  async function analyzeFile(file: UploadedFile) {
    try {
      setIsAnalyzing(file.id);
      setError(null);

      console.log('Starting analysis of file:', file.filename, 'with id:', file.id);

      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Extract text from PDF
      console.log('Extracting text from PDF:', file.pdf_url);
      const extractedText = await extractTextFromPDF(file.pdf_url);
      console.log('Text extraction completed, length:', extractedText.length);

      // Create the text file path with timestamp
      const timestamp = Date.now();
      const txtFilePath = `${user.id}/${file.filename.replace('.pdf', '')}-${timestamp}.txt`;
      console.log('Generated text file path:', txtFilePath);

      // Convert text to Blob and upload
      console.log('Uploading text file to storage...');
      const textBlob = new Blob([extractedText], { type: 'text/plain' });
      const { error: txtUploadError } = await supabase.storage
        .from('blood-test-pdfs')
        .upload(txtFilePath, textBlob, {
          contentType: 'text/plain',
          upsert: true
        });

      if (txtUploadError) {
        throw new Error('Failed to save extracted text file');
      }
      console.log('Text file uploaded successfully');

      // Get the public URL for the text file
      const { data: { publicUrl: txtPublicUrl } } = supabase.storage
        .from('blood-test-pdfs')
        .getPublicUrl(txtFilePath);
      console.log('Text file public URL:', txtPublicUrl);

      // Update file record with text file URL
      console.log('Updating uploaded_files record...');
      const { data: updateData, error: updateError } = await supabase
        .from('uploaded_files')
        .update({ output_txt: txtPublicUrl })
        .eq('id', file.id)
        .select();

      console.log('Update response:', { data: updateData, error: updateError });

      if (updateError) {
        // If update fails, clean up the uploaded text file
        await supabase.storage
          .from('blood-test-pdfs')
          .remove([txtFilePath]);
        throw new Error(`Failed to update file record: ${updateError.message}`);
      }

      if (!updateData || updateData.length === 0) {
        throw new Error('File record update returned no data');
      }

      console.log('File record updated successfully:', updateData[0]);

      // Refresh file list to show updated status
      console.log('Refreshing file list...');
      await loadFiles();
      console.log('Analysis completed successfully');

    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    } finally {
      setIsAnalyzing(null);
    }
  }

  async function parseAndStoreResults(fileId: string, txtUrl: string) {
    try {
      setIsParsing(fileId);
      setError(null);

      console.log('Starting parsing of text file:', txtUrl);

      // Fetch the text content from the URL
      const response = await fetch(txtUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch text file content');
      }
      const text = await response.text();
      console.log('Text file content fetched, length:', text.length);
      
      // Delete existing results
      console.log('Deleting existing results...');
      await supabase
        .from('blood_test_results')
        .delete()
        .eq('file_id', fileId);

      // Parse and store new results
      console.log('Parsing blood test results...');
      const parsedGroups = parseBloodTestResults(text);
      console.log('Parsed groups:', parsedGroups.length);
      
      for (const group of parsedGroups) {
        const testResults = group.tests.map(test => ({
          file_id: fileId,
          group_name: group.name,
          substance: test.substance,
          value: test.value,
          unit: test.unit,
          min_range: test.minRange || null,
          max_range: test.maxRange || null
        }));

        console.log(`Storing ${testResults.length} results for group: ${group.name}`);
        const { error: resultsError } = await supabase
          .from('blood_test_results')
          .insert(testResults);

        if (resultsError) {
          throw new Error(`Failed to save test results for group: ${group.name}`);
        }
      }

      console.log('All results stored successfully');

      // Refresh the results view if it's currently showing this file
      const currentResults = await showResults(fileId);
      if (currentResults.length > 0) {
        setSelectedResults(currentResults);
      }
    } catch (err) {
      console.error('Parsing failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse results');
    } finally {
      setIsParsing(null);
    }
  }

  async function showResults(fileId: string): Promise<BloodTestResult[]> {
    try {
      const { data, error } = await supabase
        .from('blood_test_results')
        .select('*')
        .eq('file_id', fileId)
        .order('group_name', { ascending: true });

      if (error) throw error;
      setSelectedResults(data || []);
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results');
      return [];
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Uploaded Files</h2>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Upload New File
        </button>
      </div>

      {/* File upload control */}
      {showUpload && (
        <div className="w-full">
          <label 
            className={`
              relative
              flex flex-col items-center justify-center w-full h-32
              border-2 border-dashed rounded-lg
              cursor-pointer
              transition-colors
              ${isUploading ? 'bg-gray-50 border-gray-300' : 'border-blue-300 hover:bg-blue-50 hover:border-blue-400'}
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
            
            {progress > 0 && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-200 rounded-b-lg overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </label>
        </div>
      )}

      {/* Files grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date Uploaded
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Filename
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {files.map(file => (
              <tr key={file.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(file.date_uploaded).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {file.filename}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {file.output_txt ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Analyzed
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Not Analyzed
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex space-x-2">
                    {!file.output_txt ? (
                      <button
                        onClick={() => analyzeFile(file)}
                        disabled={isAnalyzing === file.id}
                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50 flex items-center"
                      >
                        {isAnalyzing === file.id ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 mr-1" />
                        )}
                        Analyze
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => showResults(file.id)}
                          className="text-green-600 hover:text-green-900 flex items-center"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Show
                        </button>
                        <button
                          onClick={() => parseAndStoreResults(file.id, file.output_txt!)}
                          disabled={isParsing === file.id}
                          className="text-orange-600 hover:text-orange-900 disabled:opacity-50 flex items-center"
                        >
                          {isParsing === file.id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-1" />
                          )}
                          Parse
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Results display */}
      {selectedResults.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Test Results</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Group
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Result
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference Range
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedResults.map(result => (
                  <tr key={result.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.group_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.substance}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.value}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.min_range && result.max_range
                        ? `${result.min_range} - ${result.max_range}`
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}