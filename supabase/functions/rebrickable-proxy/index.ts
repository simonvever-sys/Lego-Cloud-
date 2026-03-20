const API_BASE = "https://rebrickable.com/api/v3/lego";

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };
}

function normalizeSetNumber(raw: string) {
  const compact = String(raw || "").trim().replace(/\s+/g, "");
  if (!compact) {
    return "";
  }
  return compact.includes("-") ? compact : `${compact}-1`;
}

function jsonResponse(payload: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

Deno.serve(async (request) => {
  const corsHeaders = buildCorsHeaders(request.headers.get("origin"));

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("REBRICKABLE_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Missing REBRICKABLE_API_KEY" }, 500, corsHeaders);
  }

  const url = new URL(request.url);
  const pathParam = url.searchParams.get("path") || "";
  const setNumberParam = url.searchParams.get("setNumber") || "";
  const endpoint = (url.searchParams.get("endpoint") || "set").toLowerCase();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("page_size")) || 50);

  let path = pathParam;

  // New shorthand mode:
  // /functions/v1/rebrickable-proxy?setNumber=42009
  // /functions/v1/rebrickable-proxy?setNumber=42009&endpoint=parts&page=1&page_size=50
  if (!path && setNumberParam) {
    const normalized = normalizeSetNumber(setNumberParam);
    if (!normalized) {
      return jsonResponse({ error: "Invalid setNumber" }, 400, corsHeaders);
    }

    if (endpoint === "parts") {
      path = `/sets/${encodeURIComponent(normalized)}/parts/?page=${page}&page_size=${pageSize}`;
    } else {
      path = `/sets/${encodeURIComponent(normalized)}/`;
    }
  }

  if (!path.startsWith("/")) {
    return jsonResponse(
      { error: "Invalid request. Use either ?path=/sets/... or ?setNumber=1234" },
      400,
      corsHeaders
    );
  }

  try {
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
  } catch (error) {
    return jsonResponse(
      { error: "Proxy request failed", details: String(error?.message || error || "") },
      502,
      corsHeaders
    );
  }
});
