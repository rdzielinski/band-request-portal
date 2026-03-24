// PATCH /api/tickets/:id — Update ticket status, location, add reply (auth required)
export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const ticketId = params.id;

  try {
    const ticket = await env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(ticketId).first();
    if (!ticket) {
      return new Response(JSON.stringify({ error: 'Ticket not found' }), {
        status: 404, headers: corsHeaders,
      });
    }

    const body = await request.json();
    const { status, location, reply } = body;

    const oldStatus = ticket.status;
    const newStatus = status || ticket.status;
    const newLocation = location !== undefined ? location : ticket.location;

    await env.DB.prepare(
      'UPDATE tickets SET status = ?, location = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(newStatus, newLocation, ticketId).run();

    // Add reply if provided
    if (reply && reply.trim()) {
      await env.DB.prepare(
        'INSERT INTO replies (ticket_id, text) VALUES (?, ?)'
      ).bind(ticketId, reply.trim()).run();
    }

    // Send email notification if student has an email and status changed or reply added
    if (ticket.email && (oldStatus !== newStatus || (reply && reply.trim()))) {
      await sendUpdateEmail(env, ticket, newStatus, reply);
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Update failed: ' + err.message }), {
      status: 500, headers: corsHeaders,
    });
  }
}

async function sendUpdateEmail(env, ticket, newStatus, reply) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey || !ticket.email) return;

  const statusLabels = {
    'open': '🟠 Open',
    'in-progress': '🔵 In Progress',
    'done': '🟢 Done',
    'sent-out': '📦 Sent Out',
  };

  const statusLabel = statusLabels[newStatus] || newStatus;
  const typeLabel = ticket.type === 'repair'
    ? `${ticket.instrument || 'Instrument'} Repair`
    : 'Materials Request';

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
        subject: `Update on Ticket #${ticket.id} — ${statusLabel.replace(/[🟠🔵🟢📦]\s?/, '')}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
            <div style="background: #6B1A2A; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="margin: 0; font-size: 18px;">🎶 Waterloo Band Program</h2>
              <p style="margin: 4px 0 0; opacity: 0.8; font-size: 13px;">Request Update</p>
            </div>
            <div style="padding: 24px; border: 1px solid #e5d9cc; border-top: none; border-radius: 0 0 8px 8px;">
              <p>Hi <strong>${ticket.name}</strong>,</p>
              <p>There's an update on your <strong>${typeLabel}</strong>:</p>
              <div style="background: #faf8f5; border: 1px solid #e5d9cc; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
                <div style="font-family: monospace; font-size: 13px; color: #6b5a4e; margin-bottom: 8px;">Ticket #${ticket.id}</div>
                <div style="font-size: 16px; font-weight: 600;">Status: ${statusLabel}</div>
              </div>
              ${reply ? `
              <div style="background: #f0f7f0; border: 1px solid #c3e6cb; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
                <div style="font-size: 11px; font-weight: 600; color: #6b5a4e; text-transform: uppercase; margin-bottom: 6px;">Message from Mr. Dzielinski</div>
                <div style="font-size: 14px; line-height: 1.6;">${reply}</div>
              </div>` : ''}
              <p style="color: #6b5a4e; font-size: 13px; margin-top: 24px;">— Waterloo Band Program · Room 157</p>
            </div>
          </div>
        `,
      }),
    });
  } catch (e) {
    console.error('Update email failed:', e);
  }
}
