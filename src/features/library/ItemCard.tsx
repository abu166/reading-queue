import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import type { Item } from "../../lib/domain";
import { imageUrl } from "../../lib/url";
export function ItemCard({
  item,
  onTag,
}: {
  item: Item;
  onTag: (id: string) => void;
}) {
  return (
    <article className="item-card">
      {item.cover_url && (
        <img
          className="cover"
          src={imageUrl(item.cover_url)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <div className="card-body">
        <div className="card-source">
          <span className="source">{item.source}</span>
          {item.favorite && <Star size={15} fill="currentColor" />}
        </div>
        <h2>
          <Link to={`/items/${item.id}`}>{item.title}</Link>
        </h2>
        <p className="card-description">
          {item.description || "Saved for a quieter moment."}
        </p>
        <div className="chips">
          {item.tags.map((t) => (
            <button key={t.id} onClick={() => onTag(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
        <footer>
          <span className={`badge ${item.status.toLowerCase()}`}>
            {item.status}
          </span>
          <time>
            {new Date(item.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
        </footer>
      </div>
    </article>
  );
}
