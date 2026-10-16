import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Plus, Search, Grid2X2, List, X } from "lucide-react";
import { getItems, getTags, type Filters } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { ItemForm } from "../items/ItemForm";
import { Modal } from "../../components/Modal";
import { Sidebar } from "./Sidebar";
import { ItemCard } from "./ItemCard";
import { LibrarySettings } from "./LibrarySettings";
const initial: Filters = {
  search: "",
  status: "",
  tag: "",
  source: "",
  favorite: false,
  sort: "newest",
  page: 0,
};
export function Library() {
  const [filters, setFilters] = useState(initial);
  const [search, setSearch] = useState("");
  const [view, setView] = useState(
    localStorage.getItem("reading-view") || "grid",
  );
  const [save, setSave] = useState(false);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState("");
  const tags = useQuery({ queryKey: ["tags"], queryFn: getTags });
  const items = useQuery({
    queryKey: ["items", filters],
    queryFn: ({ signal }) => getItems(filters, signal),
  });
  useEffect(() => {
    const timeout = setTimeout(
      () => setFilters((f) => ({ ...f, search: search.trim(), page: 0 })),
      300,
    );
    return () => clearTimeout(timeout);
  }, [search]);
  function filter(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch, page: 0 }));
  }
  return (
    <div className="workspace">
      <Sidebar
        filters={filters}
        filter={filter}
        tags={tags.data}
        tagsError={tags.isError}
        onRetryTags={() => void tags.refetch()}
        onSettings={() => setSettings(true)}
        onSignOut={async () => {
          const { error } = await supabase.auth.signOut();
          if (error)
            setError("Could not sign out. Check your connection and retry.");
        }}
      />
      <main className="library">
        <header>
          <div>
            <p className="eyebrow">COLLECT IDEAS. MAKE TIME FOR THEM.</p>
            <h1>
              {filters.favorite
                ? "Favorites"
                : filters.status || "Your reading queue"}
              <span className="accent">.</span>
            </h1>
            <p className="muted">Good reads, ready when you are.</p>
          </div>
          <button className="primary" onClick={() => setSave(true)}>
            <Plus size={18} />
            Save link
          </button>
        </header>
        <div className="toolbar">
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Search library"
              placeholder="Search titles, descriptions, and notes…"
              maxLength={500}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Sort links"
            value={filters.sort}
            onChange={(e) => filter({ sort: e.target.value })}
          >
            <option value="newest">Newest saved</option>
            <option value="oldest">Oldest saved</option>
            <option value="updated">Recently updated</option>
            <option value="title">Title A–Z</option>
          </select>
          <div className="view-switch">
            {[
              ["grid", Grid2X2],
              ["list", List],
            ].map(([name, Icon]) => (
              <button
                key={name as string}
                aria-label={`${name} view`}
                aria-pressed={view === name}
                onClick={() => {
                  setView(name as string);
                  localStorage.setItem("reading-view", name as string);
                }}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        </div>
        <div className="filter-row">
          <label>
            Tag
            <select
              aria-label="Filter tag"
              value={filters.tag}
              onChange={(e) => filter({ tag: e.target.value })}
            >
              <option value="">All tags</option>
              {tags.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Source
            <input
              placeholder="Exact hostname"
              aria-label="Filter source"
              value={filters.source}
              onChange={(e) => filter({ source: e.target.value.trim() })}
            />
          </label>
          {filters.tag && (
            <button onClick={() => filter({ tag: "" })}>
              #{tags.data?.find((t) => t.id === filters.tag)?.name} ×
            </button>
          )}
          <span className="hint">
            {items.data?.length ?? 0} links on this page
          </span>
        </div>
        {error && <p role="alert">{error}</p>}
        {items.isPending ? (
          <div className="empty" role="status">
            Loading your library…
          </div>
        ) : items.isError ? (
          <div className="empty">
            <h2>Your library couldn’t load.</h2>
            <p>Check your connection or sign in again.</p>
            <button onClick={() => void items.refetch()}>Try again</button>
          </div>
        ) : items.data.length === 0 ? (
          <div className="empty">
            <BookOpen size={38} />
            <h2>
              {search ||
              filters.tag ||
              filters.status ||
              filters.favorite ||
              filters.source
                ? "No matching reads."
                : "Your next good read starts here."}
            </h2>
            <p>
              {search ||
              filters.tag ||
              filters.status ||
              filters.favorite ||
              filters.source
                ? "Try another search or clear your filters."
                : "Save an article, an essay, or anything you want to return to."}
            </p>
            <button
              onClick={() => {
                setSearch("");
                setFilters(initial);
              }}
            >
              Clear filters
            </button>
            <button className="primary" onClick={() => setSave(true)}>
              Save a link
            </button>
          </div>
        ) : (
          <div className={`items ${view}`}>
            {items.data.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onTag={(id) => filter({ tag: id })}
              />
            ))}
          </div>
        )}
        <div className="pagination">
          <button
            disabled={!filters.page || items.isFetching}
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
          >
            ← Previous
          </button>
          <span>Page {filters.page + 1}</span>
          <button
            disabled={items.data?.length !== 24 || items.isFetching}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
          >
            Next →
          </button>
        </div>
      </main>
      {save && (
        <Modal
          label="save-title"
          onClose={() => {
            if (
              confirm(
                "Close this form? Unsaved link details will be discarded.",
              )
            )
              setSave(false);
          }}
        >
          <div className="section-heading">
            <h2 id="save-title">Something worth saving.</h2>
            <button
              aria-label="Close save form"
              onClick={() => {
                if (
                  confirm(
                    "Close this form? Unsaved link details will be discarded.",
                  )
                )
                  setSave(false);
              }}
            >
              <X />
            </button>
          </div>
          <ItemForm onDone={() => setSave(false)} />
        </Modal>
      )}
      {settings && <LibrarySettings onClose={() => setSettings(false)} />}
    </div>
  );
}
