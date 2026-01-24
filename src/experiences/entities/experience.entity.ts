export type ExperienceStatus = 'draft' | 'under_review' | 'active' | 'rejected';

export interface Experience {
  id: string;
  resort_id: string;
  title: string;
  slug: string;
  description?: string;
  category:
  | 'islands'
  | 'nautical'
  | 'city_tour'
  | 'sun_beach'
  | 'cultural'
  | 'adventure'
  | 'ecotourism'
  | 'agrotourism'
  | 'gastronomic'
  | 'religious'
  | 'educational';
  // Moneda (los precios van en availability_slots)
  currency: string;
  // Configuración de niños
  allows_children: boolean;
  child_min_age?: number;
  child_max_age?: number;
  includes?: string;
  excludes?: string;
  status: ExperienceStatus;

  rating_avg: number;
  rating_count: number;
  approved_by?: string;
  approved_at?: Date;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
  // Display currency for user
  display_currency?: string;
  // Computed from availability_slots - now includes pricing info
  duration_minutes?: number;
  max_capacity?: number;
  // Representative prices from first available slot (para mostrar en listados)
  display_price_per_adult?: number;
  display_price_per_child?: number;
  display_commission_per_adult?: number;
  display_commission_per_child?: number;
}

export interface ExperienceWithImages extends Experience {
  images?: ExperienceImage[];
  locations?: ExperienceLocation[];
}

export interface ExperienceImage {
  id: string;
  experience_id: string;
  url: string;
  sort_order: number;
  image_type?: 'hero' | 'gallery';
  created_at: Date;
}

export interface ExperienceLocation {
  id: string;
  experience_id: string;
  name?: string;
  address_line?: string;
  latitude?: number;
  longitude?: number;
  meeting_instructions?: string;
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

