import { createClient } from 'npm:@supabase/supabase-js@2';

function getServiceCredentials(): { url: string; key: string } | null {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const rawKeys = Deno.env.get('SUPABASE_SECRET_KEYS') || '';
  let key = '';

  if (rawKeys) {
    try {
      const parsed = JSON.parse(rawKeys);
      key = typeof parsed === 'string'
        ? parsed
        : parsed?.default || parsed?.service_role || parsed?.serviceRole || parsed?.key || '';
    } catch {
      key = rawKeys;
    }
  }

  key ||= Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  return url && key ? { url, key } : null;
}

export function createAdminClient() {
  const credentials = getServiceCredentials();
  if (!credentials) throw new Error('Supabase service credentials are missing.');
  return createClient(credentials.url, credentials.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createOptionalAdminClient() {
  const credentials = getServiceCredentials();
  if (!credentials) return null;
  return createClient(credentials.url, credentials.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}