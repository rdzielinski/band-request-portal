// POST /api/setup — One-time director account creation
export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Check if a director already exists
    const existing = await env.DB.prepare('SELECT COUNT(*) as count FROM director').first();
    if (existing.count > 0) {
      return new Response(JSON.stringify({ error: 'Director account already exists. Use /api/login instead.' }), {
        status: 409, headers: corsHeaders,
      });
    }

    const { email, password } = await request.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400, headers: corsHeaders,
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Hash password with PBKDF2
    const passwordHash = await hashPassword(password);

    await env.DB.prepare(
      'INSERT INTO director (email, password_hash) VALUES (?, ?)'
    ).bind(email.toLowerCase().trim(), passwordHash).run();

    return new Response(JSON.stringify({ success: true, message: 'Director account created! You can now log in.' }), {
      headers: corsHeaders,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Setup failed: ' + err.message }), {
      status: 500, headers: corsHeaders,
    });
  }
}

async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );

  const saltHex = Array.from(salt, b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derived), b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}
