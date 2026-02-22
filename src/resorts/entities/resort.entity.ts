export type ResortStatus = 'draft' | 'under_review' | 'approved' | 'rejected';

export interface Resort {
  id: string;
  name: string;
  description?: string;
  website?: string;
  address_line?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  owner_user_id?: string;
  business_profile_id?: string;
  status: ResortStatus;
  approved_by?: string;
  approved_at?: Date;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ResortDocument {
  id: string;
  resort_id: string;
  doc_type: 'national_id' | 'tax_id' | 'license' | 'insurance' | 'bank_cert' | 'other';
  file_url: string;
  status: 'uploaded' | 'under_review' | 'approved' | 'rejected';
  uploaded_at: Date;
  reviewed_by?: string;
  reviewed_at?: Date;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ResortBankInfo {
  id: string;
  resort_id: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  account_type?: string;
  tax_id?: string;
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
}
