import { useEffect, useRef, useState } from "react";
import { getNote, saveNote } from "../../lib/api";
import { friendlyError, type Note } from "../../lib/domain";
import { readDraft, writeDraft } from "./drafts";
import { Markdown } from "../../components/Markdown";
export function NoteEditor({
  id,
  userId,
  initial,
  onSaved,
}: {
  id: string;
  userId: string;
  initial: Note;
  onSaved?: () => Promise<unknown>;
}) {
  const key = `reading-queue-draft:${userId}:${id}`;
  const [recovered] = useState(() => readDraft(key));
  const [body, setBody] = useState(recovered?.body ?? initial.body);
  const [saved, setSaved] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<Note | null>(
    recovered &&
      recovered.version !== initial.version &&
      recovered.body !== initial.body
      ? initial
      : null,
  );
  const [preview, setPreview] = useState(false);
  const dirty = body !== saved.body;
  const latest = useRef(body);
  latest.current = body;
  // A tab-local recovery draft is retained across session expiry; never used as the database.
  useEffect(() => {
    if (!writeDraft(key, dirty ? { body, version: saved.version } : null))
      setMessage(
        "Could not store a recovery draft. Keep this tab open and copy your text until cloud saving succeeds.",
      );
  }, [body, dirty, key, saved.version]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  async function save() {
    if (busy || conflict || !dirty) return;
    setBusy(true);
    setMessage("Saving…");
    const submitted = body;
    try {
      const result = await saveNote(id, submitted, saved.version);
      setSaved(result);
      await onSaved?.();
      setMessage(
        latest.current === submitted
          ? "Saved to your library"
          : "More edits waiting to save",
      );
    } catch (e) {
      setMessage(friendlyError(e));
      if ((e as { code?: string }).code === "40001") {
        try {
          setConflict(await getNote(id));
        } catch {
          setMessage(
            "Could not load the conflicting note. Your draft is retained.",
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (
      !dirty ||
      busy ||
      conflict ||
      message.startsWith("Could") ||
      message.startsWith("Your") ||
      message.startsWith("Network")
    )
      return;
    const timer = setTimeout(() => {
      void save();
    }, 1000);
    return () => clearTimeout(timer);
  });
  return (
    <section className="note-editor">
      <div className="section-heading">
        <h2>Your notes</h2>
        <button onClick={() => setPreview(!preview)}>
          {preview ? "Edit Markdown" : "Preview"}
        </button>
      </div>
      <p className="muted">A private place to think. Markdown supported.</p>
      {preview ? (
        <Markdown>{body}</Markdown>
      ) : (
        <textarea
          aria-label="Private Markdown note"
          rows={13}
          maxLength={100000}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (!conflict) setMessage("Unsaved changes");
          }}
          placeholder="What would you like to remember?"
        />
      )}
      <div className="row">
        <button
          disabled={busy || !dirty || !!conflict}
          onClick={() => void save()}
        >
          Save note
        </button>
        <span role="status">
          {message ||
            (dirty ? "Recovered unsaved draft" : "Saved to your library")}
        </span>
      </div>
      {dirty && (
        <p className="hint">
          Keep this tab open until saved. A recovery draft is stored in this
          browser tab; remove it on a shared device.
        </p>
      )}
      {conflict && (
        <div className="notice" role="alert">
          <h3>A newer note exists</h3>
          <p>
            Your draft is preserved above. Copy or merge the latest text below,
            then save against its version.
          </p>
          <pre>{conflict.body}</pre>
          <button
            onClick={() => {
              setSaved(conflict);
              setConflict(null);
              setMessage("Unsaved merged draft");
            }}
          >
            Keep my text and use latest version
          </button>
          <button
            onClick={() => {
              if (confirm("Discard your draft and load the latest note?")) {
                setBody(conflict.body);
                setSaved(conflict);
                setConflict(null);
                setMessage("Latest note loaded");
              }
            }}
          >
            Use latest text
          </button>
        </div>
      )}
    </section>
  );
}
