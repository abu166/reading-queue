import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { exportBackup, importBackup } from "../../lib/api";
import { parseBackup, friendlyError } from "../../lib/domain";
export function BackupTools() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("skip");
  const cache = useQueryClient();
  async function exportFile() {
    setBusy(true);
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup)], {
        type: "application/json",
      });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `reading-queue-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(href);
      setMessage("Backup downloaded. Keep it private; it contains your notes.");
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Import & export</h2>
      <p className="muted">
        Versioned JSON backups. Up to 1,000 items and 5 MiB per import. Invalid
        files make no changes.
      </p>
      <button disabled={busy} onClick={() => void exportFile()}>
        Export backup
      </button>
      <label>
        When a URL already exists
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="skip">Keep existing item</option>
          <option value="update">Replace metadata, tags and note</option>
        </select>
      </label>
      <label className="file">
        Import JSON
        <input
          aria-label="Import JSON"
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setMessage("Validating backup…");
            try {
              if (file.size > 5 * 1024 * 1024) throw new Error("size");
              const payload = parseBackup(await file.text());
              if (
                mode === "update" &&
                !confirm("Replace matching items and notes with this backup?")
              )
                return;
              const result = await importBackup(payload, mode);
              await cache.invalidateQueries();
              setMessage(
                `Created ${result.created} · Updated ${result.updated} · Skipped ${result.skipped} · Invalid ${result.invalid}`,
              );
            } catch {
              setMessage(
                "Import failed: invalid file, size limit, network failure, or expired session. No partial import was committed. Check your file and retry. Invalid payloads are rejected as a whole. If the connection failed, check the library before retrying: the complete transaction may have succeeded.",
              );
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      <p role="status">{message}</p>
    </section>
  );
}
