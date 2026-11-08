import { SystemInfoResponse } from "@indicorica/contracts";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787/api/v1";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string };

export async function getSystemInfo(): Promise<ApiResult<SystemInfoResponse>> {
  try {
    const res = await fetch(`${BASE}/public/system-info`, { cache: "no-store" });
    if (!res.ok) return { ok: false, message: `API responded with status ${res.status}` };
    const parsed = SystemInfoResponse.safeParse(await res.json());
    if (!parsed.success) return { ok: false, message: "API response did not match the expected contract" };
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, message: "Could not reach the API. Is it running?" };
  }
}
