// POST /api/login — Authenticate director
export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400, headers: corsHeaders,
      });
    }

    const director = await env.DB.prepare(
      'SELECT * FROM director WHERE email = ?'
    ).bind(email.toLowerCase().trim()).first();

    if (!director) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401, headers: corsHeaders,
      });
    }

    // Verify password using Web Crypto PBKDF2
    const valid = await verifyPassword(password, director.password_hash);
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401, headers: corsHeaders,
      });
    }

    // Create session token (valid for 7 days)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Clean up old sessions for this director
    await env.DB.prepare('DELETE FROM sessions WHERE director_id = ?').bind(director.id).run();

    await env.DB.prepare(
      'INSERT INTO sessions (token, director_id, expires_at) VALUES (?, ?, ?)'
    ).bind(token, director.id, expiresAt).run();

    return new Response(JSON.stringify({
      token,
      email: director.email,
      expires_at: expiresAt,
    }), { headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Login failed' }), {
      status: 500, headers: corsHeaders,
    });
  }
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, storedHash) {
  // storedHash format: salt:hash (both hex)
  const [saltHex, hashHex] = storedHash.split(':');
  const salt = hexToBytes(saltHex);
  const expectedHash = hexToBytes(hashHex);

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

  const derivedBytes = new Uint8Array(derived);
  if (derivedBytes.length !== expectedHash.length) return false;
  return derivedBytes.every((b, i) => b === expectedHash[i]);
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
