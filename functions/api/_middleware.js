// Auth middleware — protects director-only routes
// Public routes: POST /api/tickets (submit), POST /api/login, POST /api/setup
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const method = request.method;

  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Public routes — no auth needed
  const path = url.pathname;
  if (path === '/api/login' && method === 'POST') return next();
  if (path === '/api/setup' && method === 'POST') return next();
  if (path === '/api/tickets' && method === 'POST') return next();
  if (path === '/api/tickets/count' && method === 'GET') return next();

  // Everything else requires auth
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const token = authHeader.slice(7);
  const session = await env.DB.prepare(
    'SELECT s.*, d.email FROM sessions s JOIN director d ON s.director_id = d.id WHERE s.token = ? AND s.expires_at > datetime(\'now\')'
  ).bind(token).first();

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  context.data.director = session;
  const response = await next();

  // Add CORS headers to response
  const newResponse = new Response(response.body, response);
  Object.entries(corsHeaders).forEach(([k, v]) => newResponse.headers.set(k, v));
  return newResponse;
}
