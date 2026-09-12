import { createClient } from '@supabase/supabase-js';
import { env } from './env';
import WebSocket from 'ws';

(globalThis as any).WebSocket = WebSocket;

// Create a Supabase client with the Service Role Key for backend administration
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: WebSocket as any
  }
});
