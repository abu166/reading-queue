// Deliberately no outbound fetch: hosted fetch cannot pin a validated DNS address.
import { createClient } from "npm:@supabase/supabase-js@2";
Deno.serve(async (request: Request) => {
  const origins = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",");
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Content-Type": "application/json",
    Vary: "Origin",
    "Access-Control-Allow-Origin": origins.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (!origins.includes(origin))
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers,
    });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers });
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token)
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers,
    });
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user)
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers,
    });
  return new Response(
    JSON.stringify({
      available: false,
      reason:
        "Automatic metadata extraction is disabled because this runtime has no verified DNS-pinned fetch. Save the link and edit metadata manually.",
    }),
    { status: 200, headers },
  );
});
