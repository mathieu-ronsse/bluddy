import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { FileUpload } from './components/FileUpload';
import { ViewData } from './components/ViewData';
import { Auth } from './components/Auth';
import { supabase } from './lib/supabase';
import { Upload, LineChart } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

function Home() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      <Link
        to="/upload"
        className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
      >
        <Upload className="w-12 h-12 mb-4 text-blue-500" />
        <h2 className="text-xl font-semibold text-gray-900">Upload New Data</h2>
        <p className="mt-2 text-gray-600 text-center">
          Upload and analyze new blood test results
        </p>
      </Link>

      <Link
        to="/view"
        className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
      >
        <LineChart className="w-12 h-12 mb-4 text-blue-500" />
        <h2 className="text-xl font-semibold text-gray-900">View Data</h2>
        <p className="mt-2 text-gray-600 text-center">
          View and analyze your blood test history
        </p>
      </Link>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 flex justify-between items-center">
            <Link to="/" className="text-3xl font-bold text-gray-900">
              Blood Test Analyzer
            </Link>
            {user && (
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            )}
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <Routes>
              <Route
                path="/"
                element={user ? <Home /> : <Navigate to="/auth" replace />}
              />
              <Route
                path="/auth"
                element={user ? <Navigate to="/" replace /> : <Auth />}
              />
              <Route
                path="/upload"
                element={user ? <FileUpload /> : <Navigate to="/auth" replace />}
              />
              <Route
                path="/view"
                element={user ? <ViewData /> : <Navigate to="/auth" replace />}
              />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;