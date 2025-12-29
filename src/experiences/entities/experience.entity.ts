export type ExperienceStatus = 'draft' | 'under_review' | 'active' | 'rejected';

export interface Experience {
  id: string;
  resort_id: string;
  title: string;
  slug: string;
  description?: string;
  category: 'islands' | 'nautical' | 'city_tour';
  price_cents: number;
  commission_cents: number;
  currency: string;
  includes?: string;
  excludes?: string;
  main_image_url?: string;
  status: ExperienceStatus;
  rating_avg: number;
  rating_count: number;
  approved_by?: string;
  approved_at?: Date;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
  // Display prices in user's preferred currency
  display_price?: number;
  display_commission?: number;
  display_currency?: string;
}

export interface ExperienceWithImages extends Experience {
  images?: ExperienceImage[];
}

export interface ExperienceImage {
  id: string;
  experience_id: string;
  url: string;
  sort_order: number;
  image_type?: 'hero' | 'gallery';
  created_at: Date;
}

export interface Review {
  id: string;
  booking_id?: string;
  user_id?: string;
  experience_id: string;
  rating: number;
  comment?: string;
  created_at: Date;
  user_full_name?: string; // Projected from join
  user_avatar?: string;    // Projected from join
}
