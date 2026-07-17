import { getEnv } from '../config/env';

interface PasswordResetEmail {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '');
}

async function googleAccessToken(): Promise<string> {
  const env = getEnv();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      refresh_token: env.GOOGLE_GMAIL_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google OAuth token exchange failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error('Google OAuth token exchange returned no access token');
  return payload.access_token;
}

function passwordResetMessage({ to, name, resetUrl, expiresInMinutes }: PasswordResetEmail): string {
  const env = getEnv();
  const safeName = escapeHtml(name || 'there');
  const safeUrl = escapeHtml(resetUrl);
  const senderName = env.GOOGLE_GMAIL_SENDER_NAME.replace(/[\r\n"]/g, '').trim() || 'ITCP Training';
  const subject = 'Reset your ITCP Training password';
  const text = [
    `Hello ${name || 'there'},`,
    '',
    'We received a request to reset your ITCP Training password.',
    `Open this secure link within ${expiresInMinutes} minutes:`,
    resetUrl,
    '',
    'If you did not request this, you can ignore this email. Your password will remain unchanged.',
  ].join('\r\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#162033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dce4ef;border-radius:20px;overflow:hidden"><tr><td style="padding:30px 34px;background:#0d2b45;color:#ffffff"><div style="font-size:12px;letter-spacing:1.6px;text-transform:uppercase;opacity:.72">ITCP Europe</div><h1 style="margin:10px 0 0;font-size:26px">Password reset</h1></td></tr><tr><td style="padding:34px"><p style="margin:0 0 16px;font-size:17px">Hello ${safeName},</p><p style="margin:0 0 22px;line-height:1.65;color:#506174">We received a request to reset your ITCP Training password. This link is single-use and expires in ${expiresInMinutes} minutes.</p><p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#e85d2a;color:#ffffff;text-decoration:none;font-weight:700">Reset password</a></p><p style="margin:0 0 8px;font-size:13px;color:#708094">If the button does not work, copy this link:</p><p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;color:#294e70">${safeUrl}</p><p style="margin:0;font-size:13px;line-height:1.6;color:#708094">If you did not request this, ignore this email. Your current password remains valid.</p></td></tr></table></td></tr></table></body></html>`;
  const boundary = `itcp-${Date.now().toString(36)}`;

  return [
    `From: "${senderName}" <${env.GOOGLE_GMAIL_SENDER}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
  ].join('\r\n');
}

export async function sendPasswordResetEmail(input: PasswordResetEmail): Promise<void> {
  const env = getEnv();
  if (!env.passwordResetEmailEnabled) throw new Error('Password reset email is not configured');
  const accessToken = await googleAccessToken();
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64Url(passwordResetMessage(input)) }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gmail API delivery failed (${response.status}): ${body.slice(0, 500)}`);
  }
}
