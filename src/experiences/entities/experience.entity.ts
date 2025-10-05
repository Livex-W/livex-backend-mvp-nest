export interface Experience {
  id: string;
  resort_id: string;
  title: string;
  slug: string;
  description?: string;
  category: 'islands' | 'nautical' | 'city_tour';
  price_cents: number;
  currency: string;
  includes?: string;
  excludes?: string;
  main_image_url?: string;
  status: 'draft' | 'under_review' | 'active' | 'rejected';
  rating_avg: number;
  rating_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface ExperienceWithImages extends Experience {
  images?: ExperienceImage[];
}

export interface ExperienceImage {
  id: string;
  experience_id: string;
  url: string;
  sort_order: number;
  created_at: Date;
}
