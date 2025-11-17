// src/services/compatibility.ts
import { supabase } from '@/integrations/supabase/client';

export interface PersonData {
  name: string;
  birth_date: string;
  birth_time: string;
  location: string;
  latitude?: number;
  longitude?: number;
  tz?: string;
  house_system?: string;
}

export interface CompatibilityConversation {
  id: string;
  title: string;
  mode: string;
  created_at: string;
  person_a_name?: string;
  person_b_name?: string;
}

/**
 * Creates a compatibility (sync_score) conversation between two people
 */
export async function createCompatibilityConversation(
  userId: string,
  folderId: string,
  personA: PersonData,
  personB: PersonData
): Promise<string> {
  // Create conversation with sync_score mode
  const title = `Compatibility: ${personA.name} & ${personB.name}`;
  
  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      mode: 'sync_score',
      title,
      folder_id: folderId,
    })
    .select()
    .single();

  if (conversationError || !conversation) {
    console.error('[compatibility] Failed to create conversation:', conversationError);
    throw conversationError || new Error('Failed to create conversation');
  }

  return conversation.id;
}

/**
 * Builds the payload for the sync chart request
 */
export function buildSyncPayload(
  chatId: string,
  personA: PersonData,
  personB: PersonData
) {
  return {
    chat_id: chatId,
    mode: 'sync_score',
    report_data: {
      request: 'sync', // Tell translator this is a sync request
      reportType: null, // No report needed, just Swiss data
      person_a: {
        name: personA.name,
        birth_date: personA.birth_date,
        birth_time: personA.birth_time,
        location: personA.location,
        latitude: personA.latitude,
        longitude: personA.longitude,
        tz: personA.tz,
        house_system: personA.house_system || 'placidus',
      },
      person_b: {
        name: personB.name,
        birth_date: personB.birth_date,
        birth_time: personB.birth_time,
        location: personB.location,
        latitude: personB.latitude,
        longitude: personB.longitude,
        tz: personB.tz,
        house_system: personB.house_system || 'placidus',
      },
    },
  };
}

/**
 * Fetches all compatibility conversations for a folder
 */
export async function getCompatibilityConversations(
  folderId: string
): Promise<CompatibilityConversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, mode, created_at')
    .eq('folder_id', folderId)
    .eq('mode', 'sync_score')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[compatibility] Failed to fetch compatibility conversations:', error);
    return [];
  }

  return data || [];
}

/**
 * Creates or finds a profile in user_profile_list
 * Returns the profile ID
 */
export async function ensureProfileExists(
  userId: string,
  profileData: {
    name: string;
    birth_date: string;
    birth_time: string;
    location: string;
    latitude?: number;
    longitude?: number;
    place_id?: string;
    timezone?: string;
  }
): Promise<string> {
  // Try to find existing profile
  const { data: existingProfiles } = await supabase
    .from('user_profile_list')
    .select('id')
    .eq('user_id', userId)
    .eq('name', profileData.name)
    .eq('birth_date', profileData.birth_date)
    .eq('birth_time', profileData.birth_time)
    .limit(1);

  if (existingProfiles && existingProfiles.length > 0) {
    return existingProfiles[0].id;
  }

  // Create new profile
  const { data: newProfile, error } = await supabase
    .from('user_profile_list')
    .insert({
      user_id: userId,
      profile_name: profileData.name,
      name: profileData.name,
      birth_date: profileData.birth_date,
      birth_time: profileData.birth_time,
      birth_location: profileData.location,
      birth_latitude: profileData.latitude,
      birth_longitude: profileData.longitude,
      birth_place_id: profileData.place_id,
      timezone: profileData.timezone,
      is_primary: false,
    })
    .select('id')
    .single();

  if (error || !newProfile) {
    console.error('[compatibility] Failed to create profile:', error);
    throw error || new Error('Failed to create profile');
  }

  return newProfile.id;
}


