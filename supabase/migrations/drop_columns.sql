-- Drop the columns we added for the email-based system
ALTER TABLE conversations DROP COLUMN IF EXISTS shared_from_user_id;
ALTER TABLE conversations DROP COLUMN IF EXISTS is_shared_copy;
DROP INDEX IF EXISTS conversations_shared_from_user_id_idx;
DROP INDEX IF EXISTS conversations_is_shared_copy_idx;
