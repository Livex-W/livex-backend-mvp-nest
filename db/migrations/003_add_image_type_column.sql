-- Add image_type column to experience_images table for professional organization
-- This supports the hybrid folder structure: experiences/{resort-slug}/{experience-slug}/{hero|gallery}/

ALTER TABLE experience_images 
ADD COLUMN image_type VARCHAR(20) DEFAULT 'gallery' CHECK (image_type IN ('hero', 'gallery'));

-- Add index for better query performance
CREATE INDEX idx_experience_images_type ON experience_images(experience_id, image_type);

-- Update existing records to have 'gallery' type (safe default)
UPDATE experience_images SET image_type = 'gallery' WHERE image_type IS NULL;
