-- Add profile_id column to conversations table
-- This enables memory creation when user selects "My Main Profile"

ALTER TABLE conversations 
ADD COLUMN profile_id UUID REFERENCES user_profile_list(id);

CREATE INDEX idx_conversations_profile_id ON conversations(profile_id);
CREATE INDEX idx_conversations_user_profile ON conversations(user_id, profile_id) 
WHERE profile_id IS NOT NULL;

-- Ensure only one primary profile per user
ALTER TABLE user_profile_list
ADD CONSTRAINT unique_primary_per_user 
UNIQUE (user_id) 
WHERE is_primary = true;

COMMENT ON COLUMN conversations.profile_id IS 'Links conversation to user profile for memory tracking - only set when user selects their primary profile';

