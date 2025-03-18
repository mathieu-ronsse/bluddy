export interface BloodTestResult {
  id: string;
  user_id: string;
  test_date: string;
  pdf_url: string;
  created_at: string;
}

export interface BloodComponent {
  id: string;
  result_id: string;
  component_name: string;
  measured_value: number;
  min_range: number;
  max_range: number;
  unit: string;
}

export interface AuthUser {
  id: string;
  email: string;
}