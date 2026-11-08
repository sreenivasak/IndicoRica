import { z } from "zod";

export const DataSource = z.enum(["mock", "supabase"]);
export type DataSource = z.infer<typeof DataSource>;

export const ApiError = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string().optional() }),
});
export type ApiError = z.infer<typeof ApiError>;

export const HealthResponse = z.object({ status: z.literal("ok"), time: z.string() });
export type HealthResponse = z.infer<typeof HealthResponse>;

export const SystemInfoResponse = z.object({
  siteName: z.string(),
  dataSource: DataSource,
  /** true only when the value came from a real PostgreSQL query. */
  isRealDatabase: z.boolean(),
  apiVersion: z.literal("v1"),
});
export type SystemInfoResponse = z.infer<typeof SystemInfoResponse>;
export * from "./data";
