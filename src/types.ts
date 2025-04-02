export interface UploadedFile {
  id: string;
  user_id: string;
  date_uploaded: string;
  filename: string;
  pdf_url: string;
  output_txt?: string;
}

export interface BloodTestResult {
  id: string;
  file_id: string;
  group_name: string;
  substance: string;
  value: number;
  unit: string;
  min_range: number | null;
  max_range: number | null;
  is_within_range: boolean | null;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
}