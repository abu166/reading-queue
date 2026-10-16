export function normalizeUrl(input: string): string {
  if (input.length > 4096) throw new Error("URL is too long.");
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a complete HTTP or HTTPS URL.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Use HTTP or HTTPS without embedded credentials.");
  url.hash = "";
  return url.href;
}
export function imageUrl(input: string | null): string | undefined {
  if (!input) return undefined;
  try {
    return normalizeUrl(input);
  } catch {
    return undefined;
  }
}
