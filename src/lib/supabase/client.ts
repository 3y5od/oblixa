import { createBrowserClient } from "@supabase/ssr";
import {
  createSupabaseTimeoutFetch,
  SUPABASE_BROWSER_FETCH_TIMEOUT_MS,
} from "@/lib/supabase/fetch";

const supabaseBrowserFetch = createSupabaseTimeoutFetch(
  SUPABASE_BROWSER_FETCH_TIMEOUT_MS
);

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: supabaseBrowserFetch,
      },
    }
  );
}
