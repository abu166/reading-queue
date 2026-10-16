# Data model and behavior

`supabase/migrations/202610150001_library.sql` is the schema source of truth.

- `reading_items`: owner, URL, metadata, generated source, status, favorite, timestamps, version, and GIN-indexed search vector. Unique `(user_id,url)` prevents duplicate canonical URLs.
- `tags`: owner and unique case-sensitive name (1–40 characters).
- `item_tags`: item/tag pair with owner included in both foreign keys. Deleting a tag removes assignments only.
- `item_notes`: one note per item, at most 100,000 characters, owner and version. Deleting an item cascades to its note and assignments.

All four tables use RLS, including direct REST access. Anonymous table and RPC access is revoked. Authenticated RPCs run as the caller. User deletion cascades to private records.

## URL identity

The client uses WHATWG URL parsing: complete HTTP(S) only, no embedded credentials, at most 4,096 characters. It lowercases scheme and hostname, serializes international hostnames and dot segments, removes default ports and fragments, and gives a bare hostname a `/` path. Paths and query parameter order/values remain intact. HTTP and HTTPS are distinct, as are trailing slashes, query order, and tracking parameters. Database constraints enforce the canonical authority and unique stored URL, with an additional IPv6 address-identity index. Imported URLs pass the same client parser. Direct database callers must supply canonical URLs; the database rejects noncanonical scheme/authority/default-port/fragment forms instead of trying to guess a destination. A duplicate save offers to open the existing detail screen for updates; unique constraints also cover races.

## Search

`websearch_to_tsquery('english', query)` matches a transactional `to_tsvector('english', title || description || note)` document. English stemming and stop words apply. Use words, quoted phrases, OR, and minus-prefixed exclusions supported by PostgreSQL web search. This is lexical full-text search, not substring, fuzzy, multilingual stemming, or URL search. Text is capped at 500 characters, and tag filtering applies in the same server query. Metadata and note triggers keep the vector synchronized in the same transaction. Searches never download the whole library. Indexes support ownership, filters, saved/updated/title ordering, tag lookups, and full-text search. Pagination uses a 24-item bounded offset with an ID tiebreaker; concurrent insertions can shift page boundaries.

## Backups

Version 1 JSON contains `version`, ISO `exported_at`, all tag names, and `items`. Each item contains `url`, `title`, `description`, nullable `cover_url`, `status`, `favorite`, ISO `created_at`, `updated_at`, nullable `finished_at`, tag-name array, and `note`. IDs and user IDs are not part of the format. Unknown keys are stripped by client validation and ignored by SQL. Ownership always comes from `auth.uid()`.

Import limits: 5 MiB UTF-8, 1,000 records, 1,000 top-level tags, 50 tags per record; title 500, description 4,000, note 100,000 characters. The full payload is validated before sending. The backend independently validates bounds and database constraints in one transaction: a single bad record rolls back everything. The UI reports an invalid file as a whole rather than estimating invalid-record counts. Successful summaries include created, updated, skipped, and invalid (zero). Repeated URLs within a backup are handled in sequence according to the chosen duplicate mode. Skip preserves the existing record. Update replaces metadata, assignments and note; confirmation is required. Update mode intentionally advances concurrency versions. Created and finished timestamps are preserved; updated timestamps are restored after transactional note indexing. Empty tags are preserved. Export is bounded at 1,000 items, 1,000 tags and 5 MiB (compact JSON); larger libraries must use a database backup instead. Keep exports private.
