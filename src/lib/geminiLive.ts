import { supabase } from './supabase';

export async function getGeminiLiveToken(): Promise<string> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session?.access_token) {
    throw new Error('You must be logged in to use Live Voice.');
  }

  const { data, error } = await supabase.functions.invoke(
    'gemini-live-token',
    {
      body: {},
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.token) {
    throw new Error('Live Voice token was not returned.');
  }

  return data.token;
}