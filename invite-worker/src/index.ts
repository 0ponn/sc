/**
 * Soul Code Invite System (sc.0pon.com/join)
 *
 * Endpoints:
 * - GET  /join           Serve invite landing page
 * - POST /join/redeem    Validate code + add email to Access Group
 * - POST /join/generate  Admin: create new invite code
 * - GET  /join/codes     Admin: list all codes
 * - POST /join/request   Request access (creates Linear issue)
 * - GET  /join/approve   Approve request (clicked from Linear)
 */

interface Env {
  INVITE_CODES: KVNamespace;
  ADMIN_SECRET: string;
  LINEAR_API_KEY: string;
  RESEND_API_KEY: string;
}

interface InviteCode {
  code: string;
  createdAt: string;
  usedAt?: string;
  usedBy?: string;
  maxUses: number;
  useCount: number;
}

// Generate a random invite code
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 for readability
  let code = '';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

// Validate email format
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Send email via Resend
async function sendAccessGrantedEmail(email: string, env: Env): Promise<void> {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Soul Code <noreply@0pon.com>',
        to: email,
        subject: 'Your Soul Code access is ready',
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
            <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">You're in!</h1>
            <p style="color: #666; margin-bottom: 1.5rem;">Your access to Soul Code has been approved.</p>
            <a href="https://sc.0pon.com" style="display: inline-block; background: #333; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 500;">Open Soul Code →</a>
            <p style="color: #999; font-size: 0.85rem; margin-top: 2rem;">Sign in with this email address: ${email}</p>
          </div>
        `,
      }),
    });
  } catch (e) {
    console.error('Failed to send email:', e);
  }
}

// Mark email as approved in KV
async function approveEmail(
  email: string,
  env: Env
): Promise<{ success: boolean; error?: string }> {
  try {
    await env.INVITE_CODES.put(`email:${email}`, 'approved');
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// Serve the invite landing page (matches sc.0pon.com theme)
function serveLandingPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Soul Code - Request Access</title>
  <meta name="theme-color" content="#fafafa">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #fafafa;
      --surface: #ffffff;
      --text: #1a1a1a;
      --text-muted: #666;
      --border: #e0e0e0;
      --accent: #333;
      --accent-hover: #555;
    }

    .dark {
      --bg: #0f0f0f;
      --surface: #1a1a1a;
      --text: #eaeaea;
      --text-muted: #888;
      --border: #333;
      --accent: #ccc;
      --accent-hover: #fff;
    }

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background: url("https://images.unsplash.com/photo-1660785432892-abe45fe0812b?w=1920") center/cover no-repeat;
      opacity: 0.15;
      z-index: -1;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      min-height: 100vh;
      padding: 2rem 1rem;
      color: var(--text);
      transition: background 0.3s, color 0.3s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .container {
      max-width: 400px;
      width: 100%;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .icon-btn {
      background: none;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.5rem;
      cursor: pointer;
      color: var(--text-muted);
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
    }

    .icon-btn:hover {
      border-color: var(--accent);
      color: var(--text);
    }

    .invite-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
    }

    .subtitle {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-bottom: 1.5rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    label {
      display: block;
      font-size: 0.85rem;
      color: var(--text-muted);
      font-weight: 500;
      margin-bottom: 0.5rem;
    }

    input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text);
      font-size: 1rem;
      font-family: 'SF Mono', 'Consolas', monospace;
      transition: border-color 0.2s;
    }

    input:focus {
      outline: none;
      border-color: var(--accent);
    }

    input::placeholder {
      color: var(--text-muted);
    }

    button {
      padding: 0.6rem 1.2rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text);
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    button:hover {
      border-color: var(--accent);
      background: var(--bg);
    }

    .btn-primary {
      width: 100%;
      background: var(--accent);
      color: var(--bg);
      border-color: var(--accent);
      margin-top: 0.5rem;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .tab {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text-muted);
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .tab:hover {
      border-color: var(--accent);
    }

    .tab.active {
      background: var(--accent);
      color: var(--bg);
      border-color: var(--accent);
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    .message {
      margin-top: 1rem;
      padding: 0.75rem;
      border-radius: 8px;
      font-size: 0.85rem;
      display: none;
    }

    .message.success {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #16a34a;
      display: block;
    }

    .dark .message.success {
      background: rgba(34, 197, 94, 0.2);
      color: #86efac;
    }

    .message.error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #dc2626;
      display: block;
    }

    .dark .message.error {
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
    }

    .toast {
      position: fixed;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      background: var(--accent);
      color: var(--bg);
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 0.9rem;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    }

    .toast.show {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>,,32?*3;4</h1>
      <button class="icon-btn" onclick="toggleDarkMode()" title="Toggle dark mode">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      </button>
    </header>

    <div class="invite-box">
      <div class="tabs">
        <button class="tab active" onclick="switchTab('code')">I have a code</button>
        <button class="tab" onclick="switchTab('request')">Request access</button>
      </div>

      <div id="code-tab" class="tab-content active">
        <p class="subtitle">Enter your invite code</p>
        <form id="code-form">
          <div class="form-group">
            <label for="code">Invite Code</label>
            <input type="text" id="code" name="code" placeholder="XXXXXXXX" autocomplete="off" required>
          </div>
          <div class="form-group">
            <label for="code-email">Email Address</label>
            <input type="email" id="code-email" name="email" placeholder="you@example.com" required>
          </div>
          <button type="submit" class="btn-primary">Submit</button>
        </form>
      </div>

      <div id="request-tab" class="tab-content">
        <p class="subtitle">Request an invite code</p>
        <form id="request-form">
          <div class="form-group">
            <label for="request-email">Email Address</label>
            <input type="email" id="request-email" name="email" placeholder="you@example.com" required>
          </div>
          <button type="submit" class="btn-primary">Request Access</button>
        </form>
      </div>

      <div id="message" class="message"></div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    const codeForm = document.getElementById('code-form');
    const requestForm = document.getElementById('request-form');
    const message = document.getElementById('message');
    const codeInput = document.getElementById('code');

    // Tab switching
    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelector('.tab-content#' + tab + '-tab').classList.add('active');
      event.target.classList.add('active');
      message.className = 'message';
    }

    // Auto-uppercase invite code
    codeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    // Handle code redemption
    codeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Processing...';
      message.className = 'message';

      const code = document.getElementById('code').value.trim();
      const email = document.getElementById('code-email').value.trim();

      try {
        const response = await fetch('/join/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, email })
        });

        const data = await response.json();

        if (response.ok) {
          message.className = 'message success';
          message.textContent = 'Access granted! Redirecting...';
          setTimeout(() => window.location.href = 'https://sc.0pon.com', 1500);
        } else {
          message.className = 'message error';
          message.textContent = data.error;
        }
      } catch (err) {
        message.className = 'message error';
        message.textContent = 'Network error. Please try again.';
      }

      btn.disabled = false;
      btn.textContent = 'Submit';
    });

    // Handle access request
    requestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Processing...';
      message.className = 'message';

      const email = document.getElementById('request-email').value.trim();

      try {
        const response = await fetch('/join/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
          message.className = 'message success';
          message.textContent = data.message;
          requestForm.reset();
        } else {
          message.className = 'message error';
          message.textContent = data.error;
        }
      } catch (err) {
        message.className = 'message error';
        message.textContent = 'Network error. Please try again.';
      }

      btn.disabled = false;
      btn.textContent = 'Request Access';
    });

    function toggleDarkMode() {
      document.body.classList.toggle('dark');
      localStorage.setItem('darkMode', document.body.classList.contains('dark'));
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }

    // Initialize dark mode from preference
    if (localStorage.getItem('darkMode') === 'true') {
      document.body.classList.add('dark');
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

// Handle invite code redemption
async function handleRedeem(request: Request, env: Env): Promise<Response> {
  const { code, email } = await request.json() as { code: string; email: string };

  if (!code || !email) {
    return Response.json({ error: 'Code and email are required' }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const normalizedCode = code.toUpperCase().trim();
  const inviteData = await env.INVITE_CODES.get<InviteCode>(`code:${normalizedCode}`, 'json');

  if (!inviteData) {
    return Response.json({ error: 'Invalid invite code' }, { status: 400 });
  }

  if (inviteData.useCount >= inviteData.maxUses) {
    return Response.json({ error: 'This invite code has already been used' }, { status: 400 });
  }

  // Add email to Access Group
  const result = await approveEmail(email, env);
  if (!result.success) {
    console.error('Failed to add to Access Group:', result.error);
    return Response.json({ error: 'Failed to grant access. Please try again.' }, { status: 500 });
  }

  // Update invite code usage
  inviteData.useCount += 1;
  inviteData.usedAt = new Date().toISOString();
  inviteData.usedBy = email;
  await env.INVITE_CODES.put(`code:${normalizedCode}`, JSON.stringify(inviteData));

  // Also store email → code mapping for tracking
  await env.INVITE_CODES.put(`email:${email}`, normalizedCode);

  return Response.json({
    success: true,
    message: 'Access granted! You can now visit sc.0pon.com and sign in with your email.',
  });
}

// Admin: Generate new invite code
async function handleGenerate(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { maxUses?: number };
  const maxUses = body.maxUses || 1;

  const code = generateCode();
  const inviteData: InviteCode = {
    code,
    createdAt: new Date().toISOString(),
    maxUses,
    useCount: 0,
  };

  await env.INVITE_CODES.put(`code:${code}`, JSON.stringify(inviteData));

  return Response.json({
    success: true,
    code,
    maxUses,
  });
}

// Generate signed approval token
function generateApprovalToken(email: string, secret: string): string {
  const data = `${email}:${Date.now()}`;
  const encoder = new TextEncoder();
  // Simple HMAC-like signature using the secret
  let hash = 0;
  const combined = data + secret;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash = hash & hash;
  }
  return btoa(`${data}:${Math.abs(hash).toString(36)}`).replace(/=/g, '');
}

// Verify approval token (valid for 7 days)
function verifyApprovalToken(token: string, secret: string): string | null {
  try {
    const decoded = atob(token);
    const [email, timestamp, sig] = decoded.split(':');
    const age = Date.now() - parseInt(timestamp);
    if (age > 7 * 24 * 60 * 60 * 1000) return null; // Expired

    // Verify signature
    const data = `${email}:${timestamp}`;
    let hash = 0;
    const combined = data + secret;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash) + combined.charCodeAt(i);
      hash = hash & hash;
    }
    if (Math.abs(hash).toString(36) !== sig) return null;

    return email;
  } catch {
    return null;
  }
}

// Handle access request (no code - just email)
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const { email } = await request.json() as { email: string };

  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 });
  }

  // Check if already has access
  const existingAccess = await env.INVITE_CODES.get(`email:${email}`);
  if (existingAccess) {
    return Response.json({ error: 'You already have access! Visit sc.0pon.com to sign in.' }, { status: 400 });
  }

  // Check if already requested
  const existing = await env.INVITE_CODES.get(`request:${email}`);
  if (existing) {
    return Response.json({ error: 'You have already requested access. Please wait for approval.' }, { status: 400 });
  }

  // Generate approval token
  const token = generateApprovalToken(email, env.ADMIN_SECRET);
  const approveUrl = `https://sc.0pon.com/join/approve?token=${token}`;

  // Store the request
  await env.INVITE_CODES.put(`request:${email}`, JSON.stringify({
    email,
    requestedAt: new Date().toISOString(),
    status: 'pending',
  }));

  // Create Linear issue with approve link
  try {
    await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': env.LINEAR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `mutation {
          issueCreate(input: {
            teamId: "857e0e3c-c849-48f1-8fbb-4e1b7332a6fe",
            projectId: "61b050b5-db85-428d-bdbd-8b5e8ac70760",
            title: "[sc-invite] ${email}",
            description: "**Email:** ${email}\\n\\n**Requested:** ${new Date().toISOString()}\\n\\n---\\n\\n**[→ Approve Access](${approveUrl})**"
          }) { success }
        }`,
      }),
    });
  } catch (e) {
    console.error('Failed to create Linear issue:', e);
  }

  return Response.json({
    success: true,
    message: "Access requested! You'll get access once approved.",
  });
}

// Handle approval (clicked from Linear issue)
async function handleApprove(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  const email = verifyApprovalToken(token, env.ADMIN_SECRET);
  if (!email) {
    return new Response('Invalid or expired approval link', { status: 400 });
  }

  // Check if already approved
  const existingAccess = await env.INVITE_CODES.get(`email:${email}`);
  if (existingAccess) {
    return new Response(`${email} already has access!`, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Add to Access Group
  const result = await approveEmail(email, env);
  if (!result.success) {
    return new Response(`Failed to grant access: ${result.error}`, { status: 500 });
  }

  // Mark as approved
  await env.INVITE_CODES.put(`email:${email}`, 'approved');
  await env.INVITE_CODES.delete(`request:${email}`);

  // Send email notification
  await sendAccessGrantedEmail(email, env);

  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Access Granted</title><style>body { font-family: system-ui; background: #0f0f0f; color: #eee; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; } .box { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 2rem; text-align: center; max-width: 400px; } h1 { color: #86efac; margin-bottom: 1rem; } p { color: #888; } code { background: #333; padding: 0.2rem 0.5rem; border-radius: 4px; }</style></head><body><div class="box"><h1>✓ Access Granted</h1><p><code>' + email + '</code> can now access Soul Code.</p><p style="margin-top: 1rem;">Email sent! They can sign in at <a href="https://sc.0pon.com" style="color: #ccc;">sc.0pon.com</a></p></div></body></html>';

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Check if email is approved
async function handleCheck(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return Response.json({ approved: false });
  }

  const approved = await env.INVITE_CODES.get(`email:${email}`);
  return Response.json({ approved: !!approved });
}

// Admin: List all codes
async function handleListCodes(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const list = await env.INVITE_CODES.list({ prefix: 'code:' });
  const codes: InviteCode[] = [];

  for (const key of list.keys) {
    const data = await env.INVITE_CODES.get<InviteCode>(key.name, 'json');
    if (data) {
      codes.push(data);
    }
  }

  return Response.json({ codes });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for API endpoints
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response: Response;

      switch (path) {
        case '/join':
        case '/join/':
          response = serveLandingPage();
          break;

        case '/join/redeem':
          if (request.method !== 'POST') {
            response = Response.json({ error: 'Method not allowed' }, { status: 405 });
          } else {
            response = await handleRedeem(request, env);
          }
          break;

        case '/join/generate':
          if (request.method !== 'POST') {
            response = Response.json({ error: 'Method not allowed' }, { status: 405 });
          } else {
            response = await handleGenerate(request, env);
          }
          break;

        case '/join/codes':
          if (request.method !== 'GET') {
            response = Response.json({ error: 'Method not allowed' }, { status: 405 });
          } else {
            response = await handleListCodes(request, env);
          }
          break;

        case '/join/request':
          if (request.method !== 'POST') {
            response = Response.json({ error: 'Method not allowed' }, { status: 405 });
          } else {
            response = await handleRequest(request, env);
          }
          break;

        case '/join/approve':
          response = await handleApprove(request, env);
          break;

        case '/join/check':
          response = await handleCheck(request, env);
          break;

        default:
          response = Response.json({ error: 'Not found' }, { status: 404 });
      }

      // Add CORS headers to all responses
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });

    } catch (err) {
      console.error('Worker error:', err);
      return Response.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
    }
  },
} satisfies ExportedHandler<Env>;
