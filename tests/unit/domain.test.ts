import { describe, it, expect } from "vitest";
import { normalizeUrl } from "../../src/lib/url";
import { parseBackup, statuses } from "../../src/lib/domain";
const item = {
  url: "HTTPS://EXAMPLE.COM:443/a?q=1#read",
  title: "Essay",
  description: "Ideas",
  cover_url: null,
  status: "Unread",
  favorite: false,
  created_at: "2026-10-15T00:00:00Z",
  updated_at: "2026-10-15T00:00:00Z",
  finished_at: null,
  tags: ["Ideas"],
  note: "Private **thoughts**",
};
describe("URL identity", () => {
  it("normalizes scheme, hostname, default port and fragment", () =>
    expect(normalizeUrl(item.url)).toBe("https://example.com/a?q=1"));
  it("preserves significant path, query, and nondefault port", () =>
    expect(normalizeUrl("https://Example.com:8443/A?b=2&a=1")).toBe(
      "https://example.com:8443/A?b=2&a=1",
    ));
  it.each([
    "javascript:alert(1)",
    "ftp://example.com",
    "https://user:pass@example.com",
    "not a url",
  ])("rejects %s", (url) => expect(() => normalizeUrl(url)).toThrow());
  it("normalizes unicode hostnames and dot segments", () =>
    expect(normalizeUrl("https://bücher.de/a/../b")).toBe(
      "https://xn--bcher-kva.de/b",
    ));
});
describe("backups", () => {
  it("validates and round trips all data without trusting ownership", () => {
    const b = parseBackup(
      JSON.stringify({
        version: 1,
        exported_at: item.created_at,
        tags: ["Ideas"],
        items: [{ ...item, user_id: "someone-else" }],
      }),
    );
    expect(b.items[0].url).toBe("https://example.com/a?q=1");
    expect(b.items[0]).not.toHaveProperty("user_id");
    expect(parseBackup(JSON.stringify(b))).toEqual(b);
  });
  it.each([2, 0])("rejects unsupported version %s", (version) =>
    expect(() =>
      parseBackup(JSON.stringify({ version, tags: [], items: [] })),
    ).toThrow(),
  );
  it("rejects the entire payload when one record is invalid", () =>
    expect(() =>
      parseBackup(
        JSON.stringify({
          version: 1,
          exported_at: item.created_at,
          tags: [],
          items: [item, { ...item, status: "Scrolling" }],
        }),
      ),
    ).toThrow());
  it("bounds input size", () =>
    expect(() => parseBackup(" ".repeat(5242881))).toThrow());
  it("supports only explicit reading states", () =>
    expect(statuses).toEqual(["Unread", "Reading", "Finished", "Archived"]));
});
