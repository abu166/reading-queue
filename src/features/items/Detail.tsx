import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteItem, getItem, getNote } from "../../lib/api";
import { friendlyError } from "../../lib/domain";
import { ItemForm } from "./ItemForm";
import { NoteEditor } from "../notes/NoteEditor";
export function Detail({ userId }: { userId: string }) {
  const { id } = useParams();
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const item = useQuery({
    queryKey: ["item", id],
    queryFn: () => getItem(id!),
  });
  const note = useQuery({
    queryKey: ["note", id],
    queryFn: () => getNote(id!),
  });
  if (item.isPending || note.isPending)
    return (
      <main className="detail" role="status">
        Loading your saved link…
      </main>
    );
  if (item.isError || note.isError || !item.data || !note.data)
    return (
      <main className="detail">
        <Link to="/">← Library</Link>
        <p role="alert">
          Could not load this item. Check your connection or sign in again.
        </p>
        <button
          onClick={() => {
            void item.refetch();
            void note.refetch();
          }}
        >
          Retry
        </button>
      </main>
    );
  const value = item.data;
  return (
    <main className="detail">
      <Link to="/" className="back">
        ← Back to library
      </Link>
      <div className="detail-top">
        <span className="source">{value.source}</span>
        <span className="badge">{value.status}</span>
      </div>
      <h1>{value.title}</h1>
      <p className="description">{value.description}</p>
      <div className="row">
        <a
          className="primary button"
          href={value.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open original ↗
        </a>
        <button onClick={() => setEdit(!edit)}>Edit link, tags & status</button>
        <span>{value.favorite ? "★ Favorite" : ""}</span>
      </div>
      <div className="chips">
        {value.tags.map((t) => (
          <span key={t.id}>{t.name}</span>
        ))}
      </div>
      <p className="hint">
        Saved {new Date(value.created_at).toLocaleDateString()}
        {value.finished_at
          ? ` · Finished ${new Date(value.finished_at).toLocaleDateString()}`
          : ""}
      </p>
      {edit && <ItemForm item={value} onDone={() => setEdit(false)} />}
      <NoteEditor
        key={id}
        id={id!}
        userId={userId}
        initial={note.data}
        onSaved={() => cache.invalidateQueries({ queryKey: ["item", id] })}
      />
      <div className="danger-zone">
        <button
          disabled={deleting}
          onClick={async () => {
            if (
              !confirm(
                "Delete this link and its private note? This cannot be undone.",
              )
            )
              return;
            setDeleting(true);
            try {
              await deleteItem(id!);
              await cache.invalidateQueries();
              navigate("/");
            } catch (e) {
              setError(friendlyError(e));
            } finally {
              setDeleting(false);
            }
          }}
        >
          Delete link
        </button>
        <p role="alert">{error}</p>
      </div>
    </main>
  );
}
