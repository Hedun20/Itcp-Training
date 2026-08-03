import net from 'node:net';
import os from 'node:os';
import tls from 'node:tls';
import { getEnv } from '../config/env';

interface PasswordResetEmail {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

interface EmailVerificationEmail {
  to: string;
  name: string;
  verificationUrl: string;
  expiresInMinutes: number;
}

interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

type SmtpSocket = net.Socket | tls.TLSSocket;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function dotStuff(value: string): string {
  return value.replace(/(^|\r\n)\./g, '$1..');
}

function waitForConnection(socket: SmtpSocket, event: 'connect' | 'secureConnect'): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off(event, onReady);
      socket.off('error', onError);
      socket.off('timeout', onTimeout);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error('SMTP connection timed out'));
    };
    socket.once(event, onReady);
    socket.once('error', onError);
    socket.once('timeout', onTimeout);
  });
}

class SmtpReader {
  private buffer = '';

  constructor(private socket: SmtpSocket) {
    this.socket.setEncoding('utf8');
  }

  replaceSocket(socket: SmtpSocket): void {
    this.socket = socket;
    this.buffer = '';
    this.socket.setEncoding('utf8');
  }

  private waitForData(): Promise<string> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.socket.off('data', onData);
        this.socket.off('error', onError);
        this.socket.off('close', onClose);
      };
      const onData = (chunk: string | Buffer) => {
        cleanup();
        resolve(chunk.toString());
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onClose = () => {
        cleanup();
        reject(new Error('SMTP connection closed unexpectedly'));
      };
      this.socket.once('data', onData);
      this.socket.once('error', onError);
      this.socket.once('close', onClose);
    });
  }

  private async readLine(): Promise<string> {
    while (true) {
      const boundary = this.buffer.indexOf('\r\n');
      if (boundary >= 0) {
        const line = this.buffer.slice(0, boundary);
        this.buffer = this.buffer.slice(boundary + 2);
        return line;
      }
      this.buffer += await this.waitForData();
    }
  }

  async response(expectedCodes: number[]): Promise<string[]> {
    const lines: string[] = [];
    let code = 0;
    while (true) {
      const line = await this.readLine();
      const match = /^(\d{3})([ -])(.*)$/.exec(line);
      if (!match) throw new Error(`Invalid SMTP response: ${line}`);
      const lineCode = Number(match[1]);
      if (!code) code = lineCode;
      if (lineCode !== code) throw new Error(`Mixed SMTP response codes: ${lines.join(' | ')} | ${line}`);
      lines.push(line);
      if (match[2] === ' ') break;
    }
    if (!expectedCodes.includes(code)) {
      throw new Error(`SMTP command failed (${code}): ${lines.join(' | ')}`);
    }
    return lines;
  }
}

async function command(
  socket: SmtpSocket,
  reader: SmtpReader,
  value: string,
  expectedCodes: number[],
): Promise<string[]> {
  socket.write(`${value}\r\n`);
  return reader.response(expectedCodes);
}

function createMimeMessage(message: MailMessage): string {
  const env = getEnv();
  const emailFrom = env.EMAIL_FROM!;
  const boundary = `itcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const fromName = safeHeader(env.EMAIL_FROM_NAME);
  const to = safeHeader(message.to);
  const subject = safeHeader(message.subject);
  const messageIdHost = emailFrom.split('@')[1] || 'itcpservices.nl';
  return [
    `From: "${fromName.replaceAll('"', '')}" <${emailFrom}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@${messageIdHost}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.html,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

async function sendMail(message: MailMessage): Promise<void> {
  const env = getEnv();
  if (!env.smtpEnabled) throw new Error('SMTP email delivery is not configured');

  const smtpHost = env.SMTP_HOST!;
  const smtpUser = env.SMTP_USER!;
  const smtpPass = env.SMTP_PASS!;
  const emailFrom = env.EMAIL_FROM!;
  const implicitTls = env.SMTP_SECURE ?? (env.SMTP_PORT === 465);
  let socket: SmtpSocket = implicitTls
    ? tls.connect({ host: smtpHost, port: env.SMTP_PORT, servername: smtpHost })
    : net.createConnection({ host: smtpHost, port: env.SMTP_PORT });
  socket.setTimeout(env.SMTP_TIMEOUT_MS);
  await waitForConnection(socket, implicitTls ? 'secureConnect' : 'connect');

  const reader = new SmtpReader(socket);
  try {
    await reader.response([220]);
    const hostname = os.hostname().replace(/[^a-zA-Z0-9.-]/g, '') || 'itcp-training';
    let capabilities = await command(socket, reader, `EHLO ${hostname}`, [250]);

    if (!implicitTls && capabilities.some((line) => /STARTTLS/i.test(line))) {
      await command(socket, reader, 'STARTTLS', [220]);
      const secureSocket = tls.connect({ socket, servername: smtpHost });
      secureSocket.setTimeout(env.SMTP_TIMEOUT_MS);
      await waitForConnection(secureSocket, 'secureConnect');
      socket = secureSocket;
      reader.replaceSocket(secureSocket);
      capabilities = await command(socket, reader, `EHLO ${hostname}`, [250]);
    } else if (!implicitTls && env.NODE_ENV === 'production') {
      throw new Error('SMTP server does not offer STARTTLS in production');
    }

    const authLine = capabilities.find((line) => /AUTH/i.test(line)) || '';
    if (/\bPLAIN\b/i.test(authLine)) {
      const auth = Buffer.from(`\0${smtpUser}\0${smtpPass}`, 'utf8').toString('base64');
      await command(socket, reader, `AUTH PLAIN ${auth}`, [235]);
    } else {
      await command(socket, reader, 'AUTH LOGIN', [334]);
      await command(socket, reader, Buffer.from(smtpUser, 'utf8').toString('base64'), [334]);
      await command(socket, reader, Buffer.from(smtpPass, 'utf8').toString('base64'), [235]);
    }

    await command(socket, reader, `MAIL FROM:<${emailFrom}>`, [250]);
    await command(socket, reader, `RCPT TO:<${message.to}>`, [250, 251]);
    await command(socket, reader, 'DATA', [354]);
    socket.write(`${dotStuff(createMimeMessage(message))}.\r\n`);
    await reader.response([250]);
    await command(socket, reader, 'QUIT', [221]);
  } finally {
    socket.end();
    socket.destroy();
  }
}

function emailShell(title: string, greeting: string, body: string, buttonLabel: string, url: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#162033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dce4ef;border-radius:20px;overflow:hidden"><tr><td style="padding:30px 34px;background:#0d2b45;color:#ffffff"><div style="font-size:12px;letter-spacing:1.6px;text-transform:uppercase;opacity:.72">ITCP Europe</div><h1 style="margin:10px 0 0;font-size:26px">${title}</h1></td></tr><tr><td style="padding:34px"><p style="margin:0 0 16px;font-size:17px">${greeting}</p><p style="margin:0 0 22px;line-height:1.65;color:#506174">${body}</p><p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#e85d2a;color:#ffffff;text-decoration:none;font-weight:700">${buttonLabel}</a></p><p style="margin:0 0 8px;font-size:13px;color:#708094">If the button does not work, copy this link:</p><p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;color:#294e70">${url}</p><p style="margin:0;font-size:13px;line-height:1.6;color:#708094">${footer}</p></td></tr></table></td></tr></table></body></html>`;
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmail): Promise<void> {
  const safeName = escapeHtml(name || 'there');
  const safeUrl = escapeHtml(resetUrl);
  await sendMail({
    to,
    subject: 'Reset your ITCP Training password',
    text: [
      `Hello ${name || 'there'},`,
      '',
      'We received a request to reset your ITCP Training password.',
      `Open this secure link within ${expiresInMinutes} minutes:`,
      resetUrl,
      '',
      'If you did not request this, ignore this email. Your password remains unchanged.',
    ].join('\r\n'),
    html: emailShell(
      'Password reset',
      `Hello ${safeName},`,
      `We received a request to reset your ITCP Training password. This single-use link expires in ${expiresInMinutes} minutes.`,
      'Reset password',
      safeUrl,
      'If you did not request this, ignore this email. Your current password remains valid.',
    ),
  });
}

export async function sendEmailVerificationEmail({
  to,
  name,
  verificationUrl,
  expiresInMinutes,
}: EmailVerificationEmail): Promise<void> {
  const safeName = escapeHtml(name || 'there');
  const safeUrl = escapeHtml(verificationUrl);
  await sendMail({
    to,
    subject: 'Verify your ITCP Training email',
    text: [
      `Hello ${name || 'there'},`,
      '',
      'Confirm your email address to activate your ITCP Training account.',
      `Open this secure link within ${expiresInMinutes} minutes:`,
      verificationUrl,
      '',
      'If you did not create this account, ignore this email.',
    ].join('\r\n'),
    html: emailShell(
      'Verify your email',
      `Hello ${safeName},`,
      `Confirm your email address to activate your ITCP Training account. This single-use link expires in ${expiresInMinutes} minutes.`,
      'Verify email',
      safeUrl,
      'If you did not create this account, ignore this email and no account access will be granted.',
    ),
  });
}
