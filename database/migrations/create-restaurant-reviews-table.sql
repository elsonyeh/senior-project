-- Create restaurant_reviews table for user reviews and ratings

CREATE TABLE IF NOT EXISTS restaurant_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_restaurant_id ON restaurant_reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_user_id ON restaurant_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_created_at ON restaurant_reviews(created_at DESC);

-- Add rating fields to restaurants table
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS google_rating_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tastebuddies_rating NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS tastebuddies_rating_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS combined_rating NUMERIC(2,1) GENERATED ALWAYS AS (
    CASE
      WHEN google_rating_count = 0 AND tastebuddies_rating_count = 0 THEN NULL
      WHEN google_rating_count = 0 THEN tastebuddies_rating
      WHEN tastebuddies_rating_count = 0 THEN google_rating
      ELSE (
        (google_rating * google_rating_count * 0.7 + tastebuddies_rating * tastebuddies_rating_count * 0.3)
        / (google_rating_count * 0.7 + tastebuddies_rating_count * 0.3)
      )
    END
  ) STORED;

-- Create function to update tastebuddies rating
CREATE OR REPLACE FUNCTION update_restaurant_tastebuddies_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE restaurants
  SET
    tastebuddies_rating = (
      SELECT AVG(rating)::NUMERIC(2,1)
      FROM restaurant_reviews
      WHERE restaurant_id = COALESCE(NEW.restaurant_id, OLD.restaurant_id)
    ),
    tastebuddies_rating_count = (
      SELECT COUNT(*)
      FROM restaurant_reviews
      WHERE restaurant_id = COALESCE(NEW.restaurant_id, OLD.restaurant_id)
    )
  WHERE id = COALESCE(NEW.restaurant_id, OLD.restaurant_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update tastebuddies rating
DROP TRIGGER IF EXISTS trigger_update_tastebuddies_rating ON restaurant_reviews;
CREATE TRIGGER trigger_update_tastebuddies_rating
  AFTER INSERT OR UPDATE OR DELETE ON restaurant_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_tastebuddies_rating();

-- Enable Row Level Security
ALTER TABLE restaurant_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read reviews
CREATE POLICY "Reviews are viewable by everyone"
  ON restaurant_reviews
  FOR SELECT
  USING (true);

-- Users can insert their own reviews
CREATE POLICY "Users can insert their own reviews"
  ON restaurant_reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update their own reviews"
  ON restaurant_reviews
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete their own reviews"
  ON restaurant_reviews
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_restaurant_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER restaurant_reviews_updated_at
  BEFORE UPDATE ON restaurant_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_reviews_updated_at();
