import { Link } from "react-router-dom";
import { BookOpen, Plus, Star, Settings, LogOut } from "lucide-react";
import type { Filters } from "../../lib/api";
import { statuses, type Tag } from "../../lib/domain";
export function Sidebar({
  filters,
  filter,
  tags,
  tagsError,
  onRetryTags,
  onSettings,
  onSignOut,
}: {
  filters: Filters;
  filter: (patch: Partial<Filters>) => void;
  tags: Tag[] | undefined;
  tagsError: boolean;
  onRetryTags: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}) {
  return (
    <aside className="sidebar">
      <Link to="/" className="brand">
        <BookOpen size={24} /> Reading Queue
      </Link>
      <p className="eyebrow">YOUR LIBRARY</p>
      <nav>
        <button
          className={!filters.status && !filters.favorite ? "active" : ""}
          onClick={() => filter({ status: "", favorite: false, tag: "" })}
        >
          <BookOpen size={18} />
          All links
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            className={filters.status === s ? "active" : ""}
            onClick={() => filter({ status: s, favorite: false })}
          >
            <span className={`dot ${s.toLowerCase()}`} />
            {s}
          </button>
        ))}
        <button
          className={filters.favorite ? "active" : ""}
          onClick={() => filter({ favorite: !filters.favorite, status: "" })}
        >
          <Star size={18} />
          Favorites
        </button>
      </nav>
      <div className="section-heading">
        <p className="eyebrow">TAGS</p>
        <button aria-label="Manage tags" onClick={() => onSettings()}>
          <Plus size={16} />
        </button>
      </div>
      <nav>
        {tags?.map((t) => (
          <button
            key={t.id}
            className={filters.tag === t.id ? "active" : ""}
            onClick={() => filter({ tag: filters.tag === t.id ? "" : t.id })}
          >
            <span className="muted">#</span>
            {t.name}
          </button>
        ))}
        {tagsError && (
          <p role="alert">
            Tags unavailable.{" "}
            <button onClick={() => onRetryTags()}>Retry</button>
          </p>
        )}
        {tags?.length === 0 && (
          <p className="hint">
            Give your ideas a little order. Create a tag in settings.
          </p>
        )}
      </nav>
      <div className="sidebar-bottom">
        <button onClick={() => onSettings()}>
          <Settings size={18} />
          Settings & backup
        </button>
        <button onClick={onSignOut}>
          <LogOut size={18} />
          Sign out
        </button>
        <p className="hint">
          A little less scrolling.
          <br />A little more reading.
        </p>
      </div>
    </aside>
  );
}
