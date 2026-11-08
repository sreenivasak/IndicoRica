import { createClient } from "@supabase/supabase-js";
import type { DataSource } from "@indicorica/contracts";

export interface Env {
  DATA_SOURCE?: string;
  ALLOWED_ORIGINS?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
}

export interface SettingsRepo {
  source: DataSource;
  getPublicSetting(key: string): Promise<string | null>;
}

/** In-memory stand-in for Supabase. Clearly labelled; never counts as a real DB query. */
export const mockRepo: SettingsRepo = {
  source: "mock",
  async getPublicSetting(key) {
    const data: Record<string, string> = { site_name: "IndicoRica (mock data)" };
    return data[key] ?? null;
  },
};

export function supabaseRepo(url: string, key: string): SettingsRepo {
  const client = createClient(url, key, { auth: { persistSession: false } });
  return {
    source: "supabase",
    async getPublicSetting(k) {
      const { data, error } = await client
        .from("app_settings_public").select("value").eq("key", k).maybeSingle();
      if (error) throw new Error(`supabase: ${error.message}`);
      return data?.value ?? null;
    },
  };
}

export function selectRepo(env: Env): SettingsRepo {
  if (env.DATA_SOURCE === "supabase") {
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)
      throw new Error("DATA_SOURCE=supabase requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY");
    return supabaseRepo(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);
  }
  // Fail closed: an unset/typo'd DATA_SOURCE must not silently serve mock data in production.
  if (env.DATA_SOURCE === "mock") return mockRepo;
  throw new Error("DATA_SOURCE must be 'mock' or 'supabase'");
}
