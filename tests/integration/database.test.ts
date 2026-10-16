import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const alice = "00000000-0000-0000-0000-000000000001",
  bob = "00000000-0000-0000-0000-000000000002";
let item: string, tag: string;
async function user(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
async function scalar(sql: string, params: unknown[] = []) {
  return (await db.query<any>(sql, params)).rows[0]?.value;
}
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${alice}'),('${bob}');`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610150001_library.sql", "utf8"),
  );
  await user(alice);
}, 30000);
afterAll(() => db.close());
it("creates a private item and rejects duplicates atomically", async () => {
  item = await scalar(`select save_item($1::jsonb) as value`, [
    JSON.stringify({
      url: "https://example.com/article",
      title: "Ocean ecology",
      description: "Marine science",
    }),
  ]);
  expect(item).toBeTruthy();
  await expect(
    scalar(`select save_item($1::jsonb) as value`, [
      JSON.stringify({
        url: "https://example.com/article",
        title: "Duplicate",
      }),
    ]),
  ).rejects.toThrow();
  expect(
    await scalar("select count(*)::integer as value from reading_items"),
  ).toBe(1);
});
it("assigns tags, searches notes transactionally, and filters by tag", async () => {
  await db.query("select save_tag($1)", ["Science"]);
  tag = await scalar("select id as value from tags");
  await db.query("insert into item_tags(item_id,tag_id) values($1,$2)", [
    item,
    tag,
  ]);
  const note = await scalar("select save_note($1,$2,1) as value", [
    item,
    "An extraordinary bioluminescent organism",
  ]);
  expect(note.version).toBe(2);
  const found = await scalar("select list_items(q=>$1,tag_id=>$2) as value", [
    "bioluminescent",
    tag,
  ]);
  expect(found).toHaveLength(1);
  expect(await scalar("select list_items(q=>'desert') as value")).toHaveLength(
    0,
  );
});
it("rejects stale note writes and direct writes without a version advance", async () => {
  await expect(
    db.query("select save_note($1,$2,1)", [item, "stale"]),
  ).rejects.toThrow();
  await expect(
    db.query("update item_notes set body=$1 where item_id=$2", [
      "bypass",
      item,
    ]),
  ).rejects.toThrow();
});
it("isolates direct reads and writes and prevents cross-user relationships", async () => {
  await user(bob);
  expect(
    await scalar("select count(*)::integer as value from reading_items"),
  ).toBe(0);
  await db.query("update reading_items set title=$1 where id=$2", [
    "stolen",
    item,
  ]);
  const own = await scalar(`select save_item($1::jsonb) as value`, [
    JSON.stringify({ url: "https://example.com/bob", title: "Bob" }),
  ]);
  await expect(
    db.query("insert into item_tags(item_id,tag_id) values($1,$2)", [own, tag]),
  ).rejects.toThrow();
  await expect(
    db.query("insert into item_notes(item_id,body) values($1,$2)", [
      item,
      "attack",
    ]),
  ).rejects.toThrow();
  await user(alice);
  expect(
    await scalar("select title as value from reading_items where id=$1", [
      item,
    ]),
  ).toBe("Ocean ecology");
});
it("sets finished timestamps and archives explicitly", async () => {
  await db.query("update reading_items set status='Finished' where id=$1", [
    item,
  ]);
  expect(
    await scalar("select finished_at as value from reading_items where id=$1", [
      item,
    ]),
  ).toBeTruthy();
  await db.query("update reading_items set status='Archived' where id=$1", [
    item,
  ]);
  expect(
    await scalar("select finished_at as value from reading_items where id=$1", [
      item,
    ]),
  ).toBeNull();
});
it("deletes a tag without deleting its items", async () => {
  await db.query("select delete_tag($1)", [tag]);
  expect(
    await scalar("select count(*)::integer as value from reading_items"),
  ).toBe(1);
  expect(await scalar("select count(*)::integer as value from item_tags")).toBe(
    0,
  );
});
it("exports and imports with duplicate handling, rollback, and no trusted user IDs", async () => {
  const backup = await scalar("select export_library() as value");
  expect(backup.items[0].note).toContain("bioluminescent");
  expect(
    (
      await scalar("select import_library($1::jsonb) as value", [
        JSON.stringify(backup),
      ])
    ).skipped,
  ).toBe(1);
  const malformed = {
    ...backup,
    items: [
      { ...backup.items[0], url: "https://new.example/" },
      { ...backup.items[0], url: "javascript:bad" },
    ],
  };
  await expect(
    scalar("select import_library($1::jsonb) as value", [
      JSON.stringify(malformed),
    ]),
  ).rejects.toThrow();
  expect(
    await scalar("select count(*)::integer as value from reading_items"),
  ).toBe(1);
  await db.query("select delete_item($1)", [item]);
  expect(
    await scalar("select count(*)::integer as value from item_notes"),
  ).toBe(0);
  const result = await scalar("select import_library($1::jsonb) as value", [
    JSON.stringify(backup),
  ]);
  expect(result.created).toBe(1);
  expect((await scalar("select export_library() as value")).items[0].note).toBe(
    backup.items[0].note,
  );
});

it("rejects noncanonical URL authorities, fragments and dot paths through direct SQL", async () => {
  for (const url of [
    "HTTPS://example.com/",
    "https://EXAMPLE.com/",
    "https://example.com:443/",
    "https://example.com/a#x",
    "https://example.com/a/../b",
    "https://example.com/%2e%2e/b",
    "https://user:pass@example.com/",
    "javascript:bad",
  ]) {
    await expect(
      db.query("insert into reading_items(url,title) values($1,$2)", [
        url,
        "bad",
      ]),
    ).rejects.toThrow();
  }
});
it("prevents equivalent IPv6 duplicates and resolves the existing record", async () => {
  const first = await scalar("select save_item($1::jsonb) as value", [
    JSON.stringify({
      url: "https://[::1]/",
      title: "local link only, never fetched",
    }),
  ]);
  await expect(
    db.query("insert into reading_items(url,title) values($1,$2)", [
      "https://[0:0:0:0:0:0:0:1]/",
      "duplicate",
    ]),
  ).rejects.toThrow();
  expect(
    await scalar("select find_duplicate($1) as value", [
      "https://[0:0:0:0:0:0:0:1]/",
    ]),
  ).toBe(first);
});
it("rejects anonymous reads and RPC calls", async () => {
  await db.exec("reset role;set role anon;");
  await expect(db.query("select * from reading_items")).rejects.toThrow();
  await expect(db.query("select list_items()")).rejects.toThrow();
  await user(alice);
});
