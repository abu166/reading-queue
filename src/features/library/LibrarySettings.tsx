import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getTags, saveTag, deleteTag } from "../../lib/api";
import { friendlyError } from "../../lib/domain";
import { Modal } from "../../components/Modal";
import { BackupTools } from "../import-export/BackupTools";
export function LibrarySettings({ onClose }: { onClose: () => void }) {
  const [tagName, setTagName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  const tags = useQuery({ queryKey: ["tags"], queryFn: getTags });
  async function tagAction(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await cache.invalidateQueries();
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal label="settings-title" onClose={() => onClose()}>
      <div className="section-heading">
        <h2 id="settings-title">Settings & backup</h2>
        <button aria-label="Close settings" onClick={() => onClose()}>
          <X />
        </button>
      </div>
      <h3>Manage tags</h3>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          void tagAction(async () => {
            await saveTag(tagName);
            setTagName("");
          });
        }}
      >
        <input
          aria-label="New tag name"
          required
          maxLength={40}
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          placeholder="New tag name"
        />
        <button disabled={busy}>Add tag</button>
      </form>
      {tags.data?.map((t) => (
        <div className="tag-edit" key={t.id}>
          <span>#{t.name}</span>
          <button
            onClick={() => {
              const name = prompt("Rename tag", t.name);
              if (name) void tagAction(() => saveTag(name, t.id));
            }}
          >
            Rename
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete “${t.name}”? Saved links will remain.`))
                void tagAction(() => deleteTag(t.id));
            }}
          >
            Delete
          </button>
        </div>
      ))}
      <p role="alert">{error}</p>
      <hr />
      <BackupTools />
    </Modal>
  );
}
