import { supabase } from './supabase';

export async function invoke<T>(
  name: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, {
    body,
  });

  if (error) {
    throw error;
  }

  return data as T;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateStreak(userId: string) {
  const { data, error } = await supabase.rpc(
    'record_learning_activity',
    {
      p_user_id: userId,
      p_activity_type: 'session',
      p_xp: 5,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}