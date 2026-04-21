-- Add subscription columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_expiry TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_trial_used BOOLEAN DEFAULT false;

-- Create an index for faster lookup of expired subscriptions
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_expiry ON profiles (subscription_expiry);
