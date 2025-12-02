-- Clear all folder AI messages for a specific folder
-- Replace 'YOUR_FOLDER_ID_HERE' with your actual folder ID

DELETE FROM public.folder_ai_messages
WHERE folder_id = 'YOUR_FOLDER_ID_HERE';

-- Or clear ALL folder AI messages (use with caution!)
-- DELETE FROM public.folder_ai_messages;

-- To find your folder ID, run this first:
-- SELECT id, name FROM public.chat_folders WHERE user_id = auth.uid();

