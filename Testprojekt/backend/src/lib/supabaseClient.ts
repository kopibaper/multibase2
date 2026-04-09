import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface CachedCredentials {
  supabaseUrl: string;
  anonKey: string;
  serviceKey: string;
  gatewayPort: number;
}

let client: SupabaseClient | null = null;
let credentials: CachedCredentials | null = null;

function loadCredentials(): CachedCredentials {
  if (credentials) return credentials;

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey || !anonKey) {
    throw new Error(
      'Missing required env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY'
    );
  }

  credentials = { supabaseUrl, anonKey, serviceKey, gatewayPort: 0 };
  console.log('[supabase] Using ' + supabaseUrl);
  return credentials;
}

export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (client) return client;
  const { supabaseUrl, serviceKey } = loadCredentials();
  client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

export async function getSupabaseUrl(): Promise<string> {
  return loadCredentials().supabaseUrl;
}

export async function getAnonKey(): Promise<string> {
  return loadCredentials().anonKey;
}

export async function getConnectionInfo(): Promise<CachedCredentials> {
  return loadCredentials();
}

export async function initSupabaseClient(): Promise<void> {
  try {
    await getSupabaseClient();
  } catch (err: any) {
    console.warn('[supabase] Could not initialize Supabase client:', err.message);
  }
}
