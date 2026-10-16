import { supabase } from "./supabase";
import type { Item, Note, Tag, Backup } from "./domain";
import { normalizeUrl } from "./url";
export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  let request = supabase.rpc(name, args);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw error;
  return data as T;
}
export const getTags = () => rpc<Tag[]>("list_tags");
export type Filters = {
  search: string;
  status: string;
  tag: string;
  source: string;
  favorite: boolean;
  sort: string;
  page: number;
};
export const getItems = (f: Filters, signal?: AbortSignal) =>
  rpc<Item[]>(
    "list_items",
    {
      q: f.search,
      state: f.status || null,
      tag_id: f.tag || null,
      host: f.source || null,
      starred: f.favorite,
      ordering: f.sort,
      page: f.page,
    },
    signal,
  );
export const getItem = (id: string) => rpc<Item>("get_item", { target: id });
export const getNote = (id: string) => rpc<Note>("get_note", { target: id });
export const saveNote = (id: string, body: string, version: number) =>
  rpc<Note>("save_note", { target: id, content: body, expected: version });
export async function saveItem(
  value: Partial<Item> & { url: string; title: string; description: string },
  tagIds: string[],
  expected: number | null = null,
) {
  return rpc<string>("save_item", {
    payload: { ...value, url: normalizeUrl(value.url) },
    tag_ids: tagIds,
    expected,
  });
}
export const findDuplicate = (url: string) =>
  rpc<string | null>("find_duplicate", { target_url: normalizeUrl(url) });
export const deleteItem = (id: string) => rpc("delete_item", { target: id });
export const saveTag = (name: string, id: string | null = null) =>
  rpc("save_tag", { label: name, target: id });
export const deleteTag = (id: string) => rpc("delete_tag", { target: id });
export const exportBackup = () => rpc<Backup>("export_library");
export const importBackup = (payload: Backup, mode: string) =>
  rpc<{ created: number; updated: number; skipped: number; invalid: number }>(
    "import_library",
    { payload, mode },
  );
