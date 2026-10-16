import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
// Deterministic Auth transport stub plus actual PostgreSQL migration/RPCs.
// This verifies browser behavior and SQL together, not hosted Supabase Auth.
export async function fixtureBackend(page: Page) {
  const id = "00000000-0000-0000-0000-000000000001";
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select '${id}'::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${id}');`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610150001_library.sql", "utf8"),
  );
  await db.exec("set role authenticated");
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "reader@example.test",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token = [
    { alg: "HS256", typ: "JWT" },
    {
      sub: id,
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    "fixture",
  ]
    .map((v) =>
      Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString(
        "base64url",
      ),
    )
    .join(".");
  const functions: Record<string, Record<string, string>> = {
    list_tags: {},
    find_duplicate: { target_url: "text" },
    list_items: {
      q: "text",
      state: "text",
      tag_id: "uuid",
      host: "text",
      starred: "boolean",
      ordering: "text",
      page: "integer",
    },
    get_item: { target: "uuid" },
    get_note: { target: "uuid" },
    save_note: { target: "uuid", content: "text", expected: "integer" },
    save_item: { payload: "jsonb", tag_ids: "uuid[]", expected: "integer" },
    delete_item: { target: "uuid" },
    save_tag: { label: "text", target: "uuid" },
    delete_tag: { target: "uuid" },
    export_library: {},
    import_library: { payload: "jsonb", mode: "text" },
  };
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "content-type": "application/json",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    try {
      let result: unknown;
      if (url.pathname.includes("/auth/v1/token"))
        result = {
          access_token: token,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "fixture-refresh",
          user,
        };
      else if (url.pathname.includes("/auth/v1/logout")) result = {};
      else if (url.pathname.includes("/auth/v1/user")) result = user;
      else if (url.pathname.includes("/rest/v1/rpc/")) {
        const name = url.pathname.split("/").at(-1)!;
        const definition = functions[name];
        if (!definition) throw new Error("Unexpected RPC");
        const body = request.postDataJSON() || {};
        const keys = Object.keys(body);
        const params = keys.map((k) =>
          definition[k] === "jsonb"
            ? JSON.stringify(body[k])
            : definition[k] === "uuid[]"
              ? `{${body[k].join(",")}}`
              : body[k],
        );
        const args = keys.map((k, index) => {
          if (!definition[k]) throw new Error("Unexpected argument");
          return `${k}=>$${index + 1}::${definition[k]}`;
        });
        result = (
          await db.query<{ value: unknown }>(
            `select ${name}(${args.join(",")}) as value`,
            params,
          )
        ).rows[0].value;
      } else if (url.pathname.endsWith("/reading_items")) {
        const raw = url.searchParams.get("url")?.slice(3);
        result =
          (await db.query("select id from reading_items where url=$1", [raw]))
            .rows[0] ?? null;
      } else throw new Error("Unexpected fixture request");
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify(result),
      });
    } catch (error) {
      await route.fulfill({
        status: 400,
        headers,
        body: JSON.stringify({
          code: (error as { code?: string }).code || "fixture",
          message: "Fixture database operation failed",
        }),
      });
    }
  });
  return db;
}
