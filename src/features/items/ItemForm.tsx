import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { findDuplicate, getTags, saveItem } from "../../lib/api";
import {
  friendlyError,
  statuses,
  type Item,
  type Status,
} from "../../lib/domain";
import { normalizeUrl } from "../../lib/url";
export function ItemForm({
  item,
  onDone,
}: {
  item?: Item;
  onDone: () => void;
}) {
  const [baseItem] = useState(item);
  const [url, setUrl] = useState(item?.url || "");
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [cover, setCover] = useState(item?.cover_url || "");
  const [status, setStatus] = useState<Status>(item?.status || "Unread");
  const [favorite, setFavorite] = useState(item?.favorite || false);
  const [selected, setSelected] = useState(item?.tags.map((t) => t.id) || []);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState("");
  const [busy, setBusy] = useState(false);
  const tags = useQuery({ queryKey: ["tags"], queryFn: getTags });
  const cache = useQueryClient();
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const normalized = normalizeUrl(url);
      if (!item) {
        const existing = await findDuplicate(normalized);
        if (existing) {
          setDuplicate(existing);
          return;
        }
      }
      const id = await saveItem(
        {
          ...baseItem,
          url: normalized,
          title: title.trim() || new URL(normalized).hostname,
          description,
          cover_url: cover ? normalizeUrl(cover) : null,
          status,
          favorite,
        },
        selected,
        baseItem?.version ?? null,
      );
      await cache.invalidateQueries();
      onDone();
      navigate(`/items/${id}`);
    } catch (e) {
      setError(friendlyError(e));
      if (!item) {
        try {
          const existing = await findDuplicate(url);
          if (existing) setDuplicate(existing);
        } catch {
          /* keep original error */
        }
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="item-form">
      <label>
        Link URL
        <input
          type="url"
          required
          maxLength={4096}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/a-good-read"
        />
      </label>
      <p className="hint">
        Automatic metadata is unavailable. Add a title and description, or save
        with the source hostname.
      </p>
      <label>
        Title
        <input
          maxLength={500}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Description
        <textarea
          maxLength={4000}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label>
        Cover image URL (optional)
        <input
          type="url"
          value={cover}
          onChange={(e) => setCover(e.target.value)}
        />
      </label>
      <p className="hint">
        Cover images contact their external host without a referrer.
      </p>
      <div className="row">
        <label>
          Status
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={favorite}
            onChange={(e) => setFavorite(e.target.checked)}
          />{" "}
          Favorite
        </label>
      </div>
      <fieldset>
        <legend>Tags</legend>
        {tags.data?.map((t) => (
          <label className="check" key={t.id}>
            <input
              type="checkbox"
              checked={selected.includes(t.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, t.id]
                    : selected.filter((id) => id !== t.id),
                )
              }
            />
            {t.name}
          </label>
        ))}
        {tags.isError && (
          <p role="alert">
            Could not load tags. Close and retry before saving.
          </p>
        )}
      </fieldset>
      {error && (
        <p role="alert">
          {error} Copy any edits you need to keep before canceling and reopening
          this form.
        </p>
      )}
      {duplicate && (
        <p role="status">
          Already saved.{" "}
          <button
            type="button"
            onClick={() => {
              onDone();
              navigate(`/items/${duplicate}`);
            }}
          >
            Open existing item to view or update
          </button>
        </p>
      )}
      <div className="row">
        <button className="primary" disabled={busy || tags.isError}>
          {busy ? "Saving…" : item ? "Save changes" : "Save link"}
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
