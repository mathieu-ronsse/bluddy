/*
  # Initial Schema for Blood Test Analyzer

  1. New Tables
    - `blood_test_results`
      - Stores metadata about uploaded PDF files
      - Links to user who uploaded the file
    - `blood_components`
      - Stores individual blood test measurements
      - References blood_test_results
    
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create blood_test_results table
CREATE TABLE IF NOT EXISTS blood_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  test_date date NOT NULL,
  pdf_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_test_date CHECK (test_date <= CURRENT_DATE)
);

-- Create blood_components table
CREATE TABLE IF NOT EXISTS blood_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES blood_test_results(id) ON DELETE CASCADE NOT NULL,
  component_name text NOT NULL,
  measured_value decimal NOT NULL,
  min_range decimal NOT NULL,
  max_range decimal NOT NULL,
  unit text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE blood_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_components ENABLE ROW LEVEL SECURITY;

-- Policies for blood_test_results
CREATE POLICY "Users can insert their own results"
  ON blood_test_results
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own results"
  ON blood_test_results
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for blood_components
CREATE POLICY "Users can insert components for their results"
  ON blood_components
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM blood_test_results
      WHERE id = blood_components.result_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view components for their results"
  ON blood_components
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM blood_test_results
      WHERE id = blood_components.result_id
      AND user_id = auth.uid()
    )
  );