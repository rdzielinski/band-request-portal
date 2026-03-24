// GET /api/tickets/count — Public endpoint for queue count (wait banner)
export async function onRequestGet(context) {
  const { env } = context;
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const result = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM tickets WHERE status IN ('open', 'in-progress')"
    ).first();

    return new Response(JSON.stringify({ count: result.count }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ count: 0 }), { headers: corsHeaders });
  }
}
