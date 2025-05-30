import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl) {
  throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

if (!supabaseServiceKey) {
  throw new Error('Missing env var: SUPABASE_SERVICE_KEY');
}

// Create a Supabase client for server-side operations (with service role)
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
);

// Create a Supabase client for client-side operations (with anon key)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
