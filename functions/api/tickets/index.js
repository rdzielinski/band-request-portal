// GET /api/tickets — List all tickets (auth required)
// POST /api/tickets — Submit a new ticket (public)

export async function onRequestGet(context) {
  const { env } = context;
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const tickets = await env.DB.prepare(
      'SELECT * FROM tickets ORDER BY submitted_at DESC'
    ).all();

    // Fetch replies for all tickets
    const replies = await env.DB.prepare(
      'SELECT * FROM replies ORDER BY created_at ASC'
    ).all();

    // Group replies by ticket_id
    const replyMap = {};
    for (const r of replies.results) {
      if (!replyMap[r.ticket_id]) replyMap[r.ticket_id] = [];
      replyMap[r.ticket_id].push({ text: r.text, date: r.created_at });
    }

    const result = tickets.results.map(t => ({
      ...t,
      items: JSON.parse(t.items || '[]'),
      replies: replyMap[t.id] || [],
    }));

    return new Response(JSON.stringify(result), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders,
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { type, name, grade, submitter, email } = body;

    if (!type || !name || !grade || !submitter) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Generate ticket ID
    const countResult = await env.DB.prepare('SELECT COUNT(*) as count FROM tickets').first();
    const num = (countResult.count + 1).toString().padStart(4, '0');
    const id = `WB-${num}`;

    const now = new Date().toISOString();

    let instrument = '', ownership = '', locker = '', severity = '', description = '', items = '[]';

    if (type === 'repair') {
      instrument = body.instrument || '';
      ownership = body.ownership || '';
      locker = body.locker || '';
      severity = body.severity || '';
      description = body.description || '';
      if (!instrument || !severity || !description) {
        return new Response(JSON.stringify({ error: 'Repair requests need instrument, severity, and description' }), {
          status: 400, headers: corsHeaders,
        });
      }
    } else {
      items = JSON.stringify(body.items || []);
      severity = body.severity || 'medium';
      description = body.description || '';
      if ((!body.items || body.items.length === 0) && !description) {
        return new Response(JSON.stringify({ error: 'Materials requests need at least one item or description' }), {
          status: 400, headers: corsHeaders,
        });
      }
    }

    await env.DB.prepare(
      `INSERT INTO tickets (id, type, name, grade, submitter, email, status, instrument, ownership, locker, severity, description, items, location, submitted_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, '', ?, ?)`
    ).bind(id, type, name, grade, submitter, email || '', instrument, ownership, locker, severity, description, items, now, now).run();

    // Send confirmation email if email provided
    if (email) {
      await sendConfirmationEmail(env, { id, type, name, instrument, email });
    }

    return new Response(JSON.stringify({ success: true, id, type, name }), {
      status: 201, headers: corsHeaders,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to create ticket: ' + err.message }), {
      status: 500, headers: corsHeaders,
    });
  }
}

async function sendConfirmationEmail(env, ticket) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return; // Skip if no API key configured

  const typeLabel = ticket.type === 'repair'
    ? `repair request for your ${ticket.instrument || 'instrument'}`
    : 'materials request';

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL || 'Waterloo Band <notifications@waterloo-band.com>',
        to: [ticket.email],
        subject: `Request Received — Ticket #${ticket.id}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
            <div style="background: #6B1A2A; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="margin: 0; font-size: 18px;">🎶 Waterloo Band Program</h2>
              <p style="margin: 4px 0 0; opacity: 0.8; font-size: 13px;">Request Portal Confirmation</p>
            </div>
            <div style="padding: 24px; border: 1px solid #e5d9cc; border-top: none; border-radius: 0 0 8px 8px;">
              <p>Hi <strong>${ticket.name}</strong>,</p>
              <p>Your ${typeLabel} has been received and logged as:</p>
              <div style="background: #faf8f5; border: 1px solid #e5d9cc; border-radius: 6px; padding: 12px 16px; text-align: center; margin: 16px 0;">
                <span style="font-family: monospace; font-size: 18px; font-weight: 700; color: #8B2234;">#${ticket.id}</span>
              </div>
              <p>Mr. Dzielinski will review your request and follow up when it's ready or if anything changes. You'll receive an email update when the status changes.</p>
              <p style="color: #6b5a4e; font-size: 13px; margin-top: 24px;">— Waterloo Band Program · Room 157</p>
            </div>
          </div>
        `,
      }),
    });
  } catch (e) {
    // Don't fail the ticket creation if email fails
    console.error('Email send failed:', e);
  }
}
