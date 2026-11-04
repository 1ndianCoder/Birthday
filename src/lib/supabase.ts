import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key && !url.includes('YOUR-PROJECT'));

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'manhunt-auth' },
  realtime: { params: { eventsPerSecond: 20 } },
});

/** Every device gets a private anonymous account — no emails or passwords needed. */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!created.session) throw new Error('Could not start a session');
  return created.session;
}

export function errMsg(e: unknown): string {
  if (!e) return 'Something went wrong';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  const anyE = e as { message?: string; error_description?: string };
  return anyE.message || anyE.error_description || 'Something went wrong';
}

/** Calls a database function and throws a readable error if it fails. */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
