const API_BASE = "https://rebrickable.com/api/v3/lego";

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };
}

Deno.serve(async (request) => {
  const corsHeaders = buildCorsHeaders(request.headers.get("origin"));

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("REBRICKABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing REBRICKABLE_API_KEY" }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "";

  if (!path.startsWith("/")) {
    return new Response(JSON.stringify({ error: "Invalid path" }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }

  const upstream = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `key ${apiKey}`
    }
  });

  const body = await upstream.text();

  return new Response(body, {
    status: upstream.status,
    headers: {
      ...corsHeaders,
      "Content-Type": upstream.headers.get("Content-Type") || "application/json"
    }
  });
});
