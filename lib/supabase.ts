
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../supabaseConfig';

const SUPABASE_URL = SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;

let supabaseInstance: SupabaseClient;

// Kontrola, zda jsou klíče vyplněné (nejsou prázdné a nejsou to placeholdery)
const isValidConfig = 
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  !SUPABASE_ANON_KEY.includes('SEM_VLOZ');

if (!isValidConfig) {
  console.warn('⚠️ Supabase URL or Anon Key is missing or invalid in supabaseConfig.ts.');
  
  // Vytvoříme "mock" objekt, aby aplikace nespadla při volání auth metod
  // Toto umožní renderování UI i bez backendu
  supabaseInstance = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOtp: async () => ({ error: { message: 'Supabase keys are missing. Check supabaseConfig.ts' } }),
      signOut: async () => ({ error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: null }),
          maybeSingle: () => ({ data: null, error: null })
        }),
      }),
      insert: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) }) }),
      delete: () => ({ eq: () => ({ data: null, error: null }) })
    })
  } as unknown as SupabaseClient;
} else {
  supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export const supabase = supabaseInstance;
