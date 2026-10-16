import { z } from "zod";
import { normalizeUrl } from "./url";
export const statuses = ["Unread", "Reading", "Finished", "Archived"] as const;
export type Status = (typeof statuses)[number];
export type Tag = { id: string; name: string };
export type Item = {
  id: string;
  url: string;
  title: string;
  description: string;
  source: string;
  cover_url: string | null;
  status: Status;
  favorite: boolean;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  version: number;
  tags: Tag[];
};
export type Note = { body: string; version: number };
const date = z.string().datetime({ offset: true });
export const recordSchema = z
  .object({
    url: z.string().transform((s, ctx) => {
      try {
        return normalizeUrl(s);
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid URL" });
        return z.NEVER;
      }
    }),
    title: z.string().max(500),
    description: z.string().max(4000),
    cover_url: z
      .string()
      .nullable()
      .transform((s, ctx) => {
        if (!s) return null;
        try {
          return normalizeUrl(s);
        } catch {
          ctx.addIssue({ code: "custom", message: "Invalid cover" });
          return z.NEVER;
        }
      }),
    status: z.enum(statuses),
    favorite: z.boolean(),
    created_at: date,
    updated_at: date,
    finished_at: date.nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(50),
    note: z.string().max(100000),
  })
  .refine((r) => (r.status === "Finished") === (r.finished_at !== null), {
    message:
      "Finished items require a finished timestamp; other states must omit it.",
  });
export const backupSchema = z.object({
  version: z.literal(1),
  exported_at: date,
  tags: z.array(z.string().trim().min(1).max(40)).max(1000),
  items: z.array(recordSchema).max(1000),
});
export type Backup = z.infer<typeof backupSchema>;
export function parseBackup(text: string): Backup {
  if (new TextEncoder().encode(text).length > 5 * 1024 * 1024)
    throw new Error("Maximum backup size is 5 MiB.");
  return backupSchema.parse(JSON.parse(text));
}
export function friendlyError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e?.code === "54000")
    return "Backup limit exceeded (1,000 items/tags or 5 MiB). Use a direct database backup for larger libraries.";
  if (e?.code === "23505") return "This link or tag already exists.";
  if (e?.code === "40001")
    return "Another tab changed this record. Reload the latest version before saving.";
  if (e?.code === "PGRST301" || e?.code === "42501")
    return "Your session expired or this record is unavailable. Sign in again; keep your unsaved text.";
  if (error instanceof TypeError)
    return "Network unavailable. Check your connection and try again.";
  return e?.message?.startsWith("Enter ") || e?.message?.startsWith("Use ")
    ? e.message
    : "Could not complete the request. Retry, or sign in again if your session expired.";
}
