import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { UploadedFile, BloodTestResult } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function ViewData() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [results, setResults] = useState<BloodTestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    if (selectedFile) {
      loadResults(selectedFile);
    }
  }, [selectedFile]);

  async function loadFiles() {
    try {
      const { data, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .order('date_uploaded', { ascending: false });

      if (error) throw error;
      setFiles(data);
      if (data.length > 0) {
        setSelectedFile(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }

  async function loadResults(fileId: string) {
    try {
      const { data, error } = await supabase
        .from('blood_test_results')
        .select('*')
        .eq('file_id', fileId)
        .order('group_name', { ascending: true });

      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test results');
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  // Group results by group_name
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.group_name]) {
      acc[result.group_name] = [];
    }
    acc[result.group_name].push(result);
    return acc;
  }, {} as Record<string, BloodTestResult[]>);

  return (
    <div className="space-y-6">
      {/* File selector */}
      <div className="bg-white p-4 rounded-lg shadow">
        <label className="block text-sm font-medium text-gray-700">
          Select Test Report
        </label>
        <select
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          value={selectedFile || ''}
          onChange={(e) => setSelectedFile(e.target.value)}
        >
          {files.map(file => (
            <option key={file.id} value={file.id}>
              {new Date(file.date_uploaded).toLocaleDateString()} - {file.filename}
            </option>
          ))}
        </select>
      </div>

      {/* Results display */}
      {Object.entries(groupedResults).map(([groupName, groupResults]) => (
        <div key={groupName} className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">{groupName}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groupResults.map(result => (
                  <tr key={result.id}>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {result.is_within_range === null ? (
                        <span className="text-gray-500">No range</span>
                      ) : result.is_within_range ? (
                        <span className="text-green-600">Normal</span>
                      ) : (
                        <span className="text-red-600">Out of range</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}