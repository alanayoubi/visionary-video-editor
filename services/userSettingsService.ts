import { supabase } from './supabaseClient';

export interface UserSettings {
  id: string;
  userId: string;
  elevenLabsApiKey: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Load user settings from Supabase for the authenticated user
 * Creates a new settings row if one doesn't exist
 */
export const loadUserSettings = async (): Promise<UserSettings> => {
  // Get current authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  // If no settings exist yet, create default settings
  if (!data) {
    const { data: newSettings, error: createError } = await supabase
      .from('user_settings')
      .insert({ user_id: user.id, elevenlabs_api_key: null })
      .select()
      .single();

    if (createError) throw createError;

    return {
      id: newSettings.id,
      userId: newSettings.user_id,
      elevenLabsApiKey: newSettings.elevenlabs_api_key ?? null,
      createdAt: newSettings.created_at,
      updatedAt: newSettings.updated_at
    };
  }

  return {
    id: data.id,
    userId: data.user_id,
    elevenLabsApiKey: data.elevenlabs_api_key ?? null,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
};

/**
 * Save Eleven Labs API key to user settings for the authenticated user
 */
export const saveElevenLabsApiKey = async (apiKey: string): Promise<void> => {
  // Get current authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // First, try to get existing settings
  const { data: existing } = await supabase
    .from('user_settings')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    // Update existing settings
    const { error } = await supabase
      .from('user_settings')
      .update({ elevenlabs_api_key: apiKey })
      .eq('id', existing.id);

    if (error) throw error;
  } else {
    // Create new settings
    const { error } = await supabase
      .from('user_settings')
      .insert({ user_id: user.id, elevenlabs_api_key: apiKey });

    if (error) throw error;
  }
};
