const { Resend } = require('resend');
const nodemailer = require('nodemailer');

// ── Helpers ───────────────────────────────────────────────────────────────────

const appUrl = () => process.env.APP_URL || 'http://localhost:3000';

const emailWrapper = (title, color, content) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: ${color}; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0; font-size: 18px;">${title}</h2>
    </div>
    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
      ${content}
    </div>
  </div>
`;

const buttonHtml = (url, label) => `
  <div style="text-align: center; margin: 24px 0;">
    <a href="${url}" style="display: inline-block; padding: 12px 32px; background: #6c47ff; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">${label}</a>
  </div>
`;

// ── System Resend client (env-based, shared singleton) ────────────────────────

let _resend = null;
const getSystemResend = () => {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
};

const systemFromEmail = () => process.env.RESEND_FROM_EMAIL || 'alerts@loghive.dev';

// ── Org email config resolver ─────────────────────────────────────────────────
// Returns a normalized config object for sending via Resend or SMTP.
// Falls back to env vars when the org has no custom settings.

const resolveEmailConfig = async (orgId) => {
  const { OrgEmailSettings } = require('../models');
  const settings = await OrgEmailSettings.findOne({ where: { organization_id: orgId } });

  if (!settings || settings.provider === 'resend') {
    return {
      provider: 'resend',
      apiKey:    settings?.resend_api_key    || process.env.RESEND_API_KEY,
      fromEmail: settings?.resend_from_email || systemFromEmail(),
    };
  }

  return {
    provider:  'smtp',
    smtpHost:  settings.smtp_host,
    smtpPort:  settings.smtp_port || 587,
    smtpUser:  settings.smtp_user,
    smtpPass:  settings.smtp_pass,
    smtpFrom:  settings.smtp_from || settings.smtp_user,
  };
};

// ── Generic send via resolved config ─────────────────────────────────────────

const sendWithConfig = async ({ config, to, subject, html }) => {
  if (config.provider === 'smtp') {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
    });
    await transporter.sendMail({
      from: config.smtpFrom,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
    });
  } else {
    if (!config.apiKey) throw new Error('Resend API key not configured');
    const resend = new Resend(config.apiKey);
    await resend.emails.send({
      from: `LogHive <${config.fromEmail}>`,
      to,
      subject,
      html,
    });
  }
};

// ── Pre-auth emails (use env Resend only, no org config needed) ───────────────

const sendVerificationEmail = async ({ to, token, organizationName }) => {
  const client = getSystemResend();
  if (!client) return;

  const verifyUrl = `${appUrl()}/verify-email?token=${token}`;
  try {
    await client.emails.send({
      from: `LogHive <${systemFromEmail()}>`,
      to,
      subject: 'Verify your email — LogHive',
      html: emailWrapper('Verify Your Email', '#6c47ff', `
        <p style="font-size: 14px; color: #374151;">Thanks for signing up${organizationName ? ` with <strong>${organizationName}</strong>` : ''}! Please verify your email address to get started.</p>
        ${buttonHtml(verifyUrl, 'Verify Email')}
        <p style="font-size: 12px; color: #9ca3af;">This link expires in 24 hours.</p>
        <p style="font-size: 12px; color: #9ca3af;">If you didn't create this account, please ignore this email.</p>
      `),
    });
    console.log(`[Email] Verification email sent to ${to}`);
  } catch (err) {
    console.error('[Email] Failed to send verification email:', err.message);
  }
};

const sendPasswordResetEmail = async ({ to, token }) => {
  const client = getSystemResend();
  if (!client) return;

  const resetUrl = `${appUrl()}/reset-password?token=${token}`;
  try {
    await client.emails.send({
      from: `LogHive <${systemFromEmail()}>`,
      to,
      subject: 'Reset your LogHive password',
      html: emailWrapper('Password Reset', '#6c47ff', `
        <p style="font-size: 14px; color: #374151;">We received a request to reset your password. Click the button below to choose a new one.</p>
        ${buttonHtml(resetUrl, 'Reset Password')}
        <p style="font-size: 12px; color: #9ca3af;">This link expires in 1 hour.</p>
        <p style="font-size: 12px; color: #9ca3af;">If you didn't request a password reset, you can safely ignore this email.</p>
      `),
    });
    console.log(`[Email] Password reset email sent to ${to}`);
  } catch (err) {
    console.error('[Email] Failed to send password reset email:', err.message);
  }
};

const sendWelcomeEmail = async ({ to, organizationName }) => {
  const client = getSystemResend();
  if (!client) return;

  try {
    await client.emails.send({
      from: `LogHive <${systemFromEmail()}>`,
      to,
      subject: 'Welcome to LogHive — Your account is ready',
      html: emailWrapper('Welcome to LogHive', '#6c47ff', `
        <p style="font-size: 14px; color: #374151;">Your account has been created and your organization <strong>${organizationName}</strong> is ready to go.</p>
        <p style="font-size: 14px; color: #374151;">You can now create applications, generate API keys, and start monitoring your logs.</p>
        ${buttonHtml(`${appUrl()}/dashboard`, 'Go to Dashboard')}
        <p style="font-size: 12px; color: #9ca3af;">If you didn't create this account, please ignore this email.</p>
      `),
    });
    console.log(`[Email] Welcome email sent to ${to}`);
  } catch (err) {
    console.error('[Email] Failed to send welcome email:', err.message);
  }
};

const sendInvitationEmail = async ({ to, organizationName, inviterEmail, token }) => {
  const client = getSystemResend();
  if (!client) return;

  const acceptUrl = `${appUrl()}/accept-invite?token=${token}`;
  try {
    await client.emails.send({
      from: `LogHive <${systemFromEmail()}>`,
      to,
      subject: `You've been invited to join ${organizationName} on LogHive`,
      html: emailWrapper("You're Invited", '#6c47ff', `
        <p style="font-size: 14px; color: #374151;"><strong>${inviterEmail}</strong> has invited you to join <strong>${organizationName}</strong> on LogHive.</p>
        ${buttonHtml(acceptUrl, 'Accept Invitation')}
        <p style="font-size: 12px; color: #9ca3af;">This invitation link expires in 48 hours.</p>
        <p style="font-size: 12px; color: #9ca3af;">If you don't recognize this invitation, you can safely ignore this email.</p>
      `),
    });
    console.log(`[Email] Invitation email sent to ${to}`);
  } catch (err) {
    console.error('[Email] Failed to send invitation email:', err.message);
  }
};

// ── Org emails (use resolved config + rate limit handled by caller) ────────────

const sendFatalAlert = async ({ to, appName, appUuid, message, timestamp, organization, emailConfig }) => {
  try {
    const config = emailConfig || {
      provider: 'resend',
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: systemFromEmail(),
    };

    const subject = `[FATAL] ${appName || appUuid} — ${message.substring(0, 80)}`;
    const html = emailWrapper('FATAL Error Detected', '#dc2626', `
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 120px;">Organization</td>
          <td style="padding: 8px 0; font-weight: 600;">${organization}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Application</td>
          <td style="padding: 8px 0; font-weight: 600;">${appName || appUuid}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Time</td>
          <td style="padding: 8px 0;">${new Date(timestamp).toUTCString()}</td>
        </tr>
      </table>
      <div style="margin-top: 16px; padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;">
        <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 13px; color: #991b1b;">${message}</pre>
      </div>
      <p style="margin-top: 16px; font-size: 12px; color: #9ca3af;">
        This is the first occurrence today. Subsequent FATAL errors with the same message will not trigger another email.
      </p>
    `);

    await sendWithConfig({ config, to, subject, html });
    console.log(`[Email] Fatal alert sent to ${Array.isArray(to) ? to.length : 1} recipient(s)`);
  } catch (err) {
    console.error('[Email] Failed to send fatal alert:', err.message);
  }
};

// ── Notification digest ───────────────────────────────────────────────────────

const LEVEL_BADGE = {
  DEBUG: { bg: '#f1f5f9', color: '#64748b' },
  INFO:  { bg: '#dcfce7', color: '#166534' },
  WARN:  { bg: '#fef9c3', color: '#854d0e' },
  ERROR: { bg: '#fee2e2', color: '#991b1b' },
  FATAL: { bg: '#fce7f3', color: '#9d174d' },
};

const levelBadge = (level) => {
  const s = LEVEL_BADGE[level] || LEVEL_BADGE.DEBUG;
  return `<span style="display:inline-block;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:700;background:${s.bg};color:${s.color};letter-spacing:0.3px">${level}</span>`;
};

// ── Shared helpers ────────────────────────────────────────────────────────────
const escHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Renders the group _id as a plain string or a link if group_link_url is set
const groupValueHtml = (value, rule, linkStyle = '') => {
  const text = escHtml(String(value ?? '—'));
  if (!rule.group_link_url || value == null) return text;
  const href = escHtml(rule.group_link_url.replace('{grouping_value}', encodeURIComponent(String(value))));
  return `<a href="${href}"${linkStyle ? ` style="${linkStyle}"` : ''}>${text}</a>`;
};

const LEVEL_PALETTE = {
  DEBUG: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
  INFO:  { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  WARN:  { bg: '#fefce8', text: '#ca8a04', border: '#fde047' },
  ERROR: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  FATAL: { bg: '#fdf4ff', text: '#9333ea', border: '#e9d5ff' },
};

// ── Column definitions ────────────────────────────────────────────────────────
const GROUPED_COL_DEFS = [
  { key: 'group',     label: 'Group',     required: true },
  { key: 'level',     label: 'Level',     required: true },
  { key: 'count',     label: 'Count',     required: true },
  { key: 'app',       label: 'App',       required: false, defaultShow: true },
  { key: 'last_seen', label: 'Last Seen', required: false, defaultShow: true },
  { key: 'sample',    label: 'Sample',    required: false, defaultShow: true },
];
const FLAT_COL_DEFS = [
  { key: 'time',    label: 'Time (UTC)', required: true },
  { key: 'level',   label: 'Level',      required: true },
  { key: 'message', label: 'Message',    required: true },
  { key: 'app',     label: 'App',        required: false, defaultShow: true },
  { key: 'tags',    label: 'Tags',       required: false, defaultShow: false },
];

const resolveColumns = (rule, mode) => {
  const defs = mode === 'grouped' ? GROUPED_COL_DEFS : FLAT_COL_DEFS;
  const saved = rule.email_columns?.[mode] || {};
  return defs
    .filter((col) => col.required || (saved[col.key]?.show ?? col.defaultShow))
    .map((col) => ({ key: col.key, label: saved[col.key]?.label?.trim() || col.label }));
};

// Returns a single <td> for the given column key, item, and template context
const renderDefaultCell = (key, item, isGrouped, rule, appNameMap, fmtDate, tdStyle) => {
  switch (key) {
    case 'group':
      return `<td style="${tdStyle};font-weight:600">${groupValueHtml(item._id, rule, 'color:#6c47ff;font-weight:600')}</td>`;
    case 'level':
      return `<td style="${tdStyle}">${levelBadge(isGrouped ? item.sample_level : item.level)}</td>`;
    case 'count':
      return `<td style="${tdStyle};font-weight:700;color:#6c47ff">${(item.count || 0).toLocaleString()}</td>`;
    case 'app': {
      const name = isGrouped
        ? (appNameMap[item.sample_app] || item.sample_app || '—')
        : (appNameMap[item.app_uuid]   || item.app_uuid   || '—');
      return `<td style="${tdStyle}">${escHtml(name)}</td>`;
    }
    case 'last_seen':
      return `<td style="${tdStyle};color:#9ca3af;font-size:11px">${item.latest ? fmtDate(item.latest) : '—'}</td>`;
    case 'sample':
      return `<td style="${tdStyle};max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml((item.sample_message || '').substring(0, 120))}</td>`;
    case 'time':
      return `<td style="${tdStyle};white-space:nowrap;color:#9ca3af;font-size:11px">${item.timestamp ? fmtDate(item.timestamp) : '—'}</td>`;
    case 'message':
      return `<td style="${tdStyle};max-width:320px">${escHtml((item.message || '').substring(0, 200))}</td>`;
    case 'tags':
      return `<td style="${tdStyle}">${escHtml((item.tags || []).join(', ') || '—')}</td>`;
    default:
      return `<td style="${tdStyle}">—</td>`;
  }
};

const renderTeamsCell = (key, item, isGrouped, rule, appNameMap, fmtDate, td) => {
  switch (key) {
    case 'group':
      return `<td style="${td}"><b>${groupValueHtml(item._id, rule)}</b></td>`;
    case 'level': {
      const lvl = escHtml((isGrouped ? item.sample_level : item.level) || '—');
      return `<td style="${td}"><b>${lvl}</b></td>`;
    }
    case 'count':
      return `<td style="${td}">${(item.count || 0).toLocaleString()}</td>`;
    case 'app': {
      const name = isGrouped
        ? (appNameMap[item.sample_app] || item.sample_app || '—')
        : (appNameMap[item.app_uuid]   || item.app_uuid   || '—');
      return `<td style="${td}">${escHtml(name)}</td>`;
    }
    case 'last_seen':
      return `<td style="${td}">${item.latest ? fmtDate(item.latest) : '—'}</td>`;
    case 'sample':
      return `<td style="${td}">${escHtml((item.sample_message || '').substring(0, 120))}</td>`;
    case 'time':
      return `<td style="${td};white-space:nowrap">${item.timestamp ? fmtDate(item.timestamp) : '—'}</td>`;
    case 'message':
      return `<td style="${td}">${escHtml((item.message || '').substring(0, 200))}</td>`;
    case 'tags':
      return `<td style="${td}">${escHtml((item.tags || []).join(', ') || '—')}</td>`;
    default:
      return `<td style="${td}">—</td>`;
  }
};

// ── Teams-compatible template (plain HTML, no decorative styles) ──────────────
const buildTeamsHtml = ({ rule, items, isGrouped, chunkIndex, totalChunks, totalItems, fromDate, toDate, appNameMap }) => {
  const fmtDate = (d) => new Date(d).toUTCString().replace(' GMT', ' UTC');
  const rangeLabel = rule.time_range_type === 'last_24h' ? 'last 24 hours' : `last ${rule.time_range_hours} hour(s)`;
  const chunkNote = totalChunks > 1 ? ` (email ${chunkIndex}/${totalChunks})` : '';

  const cols = resolveColumns(rule, isGrouped ? 'grouped' : 'flat');
  const th = 'padding:6px 8px;border:1px solid #ccc;text-align:left';
  const td = 'padding:6px 8px;border:1px solid #ccc';

  const thead = `<tr style="background:#f0f0f0">${cols.map((c) => `<th style="${th}">${escHtml(c.label)}</th>`).join('')}</tr>`;
  const rows = items.map((item) => {
    const cells = cols.map((c) => renderTeamsCell(c.key, item, isGrouped, rule, appNameMap, fmtDate, td)).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const table = `<table style="border-collapse:collapse;width:100%;font-size:13px">
    <thead>${thead}</thead><tbody>${rows}</tbody>
  </table>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<h2>${escHtml(rule.name)}${chunkNote}</h2>
<p>
  <b>Period:</b> ${rangeLabel} &mdash; ${fmtDate(fromDate)} &rarr; ${fmtDate(toDate)}<br>
  <b>Levels:</b> ${escHtml((rule.log_levels || []).join(', ') || 'All')}<br>
  <b>Total:</b> ${totalItems.toLocaleString()} ${isGrouped ? 'group(s)' : 'log(s)'}
</p>
<hr>
${table}
<hr>
<p style="font-size:12px;color:#666">Sent by LogHive &middot; ${fmtDate(toDate)}</p>
</body></html>`;
};

// ── Custom HTML template ──────────────────────────────────────────────────────
// Injects subject variables + {log_table} = the default inner table HTML
const buildCustomHtml = ({ rule, items, isGrouped, chunkIndex, totalChunks, totalItems, fromDate, toDate, appNameMap }) => {
  if (!rule.email_template_custom) return buildDigestHtml({ rule, items, isGrouped, chunkIndex, totalChunks, totalItems, fromDate, toDate, appNameMap });

  const fmtDate = (d) => new Date(d).toUTCString().replace(' GMT', ' UTC');
  const pad = (n) => String(n).padStart(2, '0');
  const now = toDate;
  const appNames = Object.values(appNameMap).filter(Boolean).join(', ') || 'All apps';

  const cols = resolveColumns(rule, isGrouped ? 'grouped' : 'flat');
  const thStyle = 'padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb';
  const tdStyle = 'padding:9px 12px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;vertical-align:top';

  const thead = `<tr style="background:#f8fafc">${cols.map((c) => `<th style="${thStyle}">${escHtml(c.label)}</th>`).join('')}</tr>`;
  const rows = items.map((item, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#fafafa';
    const cells = cols.map((c) => renderDefaultCell(c.key, item, isGrouped, rule, appNameMap, fmtDate, tdStyle)).join('');
    return `<tr style="background:${bg}">${cells}</tr>`;
  }).join('');
  const logTable = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden"><thead>${thead}</thead><tbody>${rows}</tbody></table></div>`;

  const vars = {
    rule_name:  rule.name,
    date:       `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`,
    time:       `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`,
    app_names:  appNames,
    log_count:  String(totalItems),
    levels:     (rule.log_levels || []).join(', ') || 'All',
    range:      rule.time_range_type === 'last_24h' ? 'last 24h' : `last ${rule.time_range_hours || 24}h`,
    log_table:  logTable,
  };

  return rule.email_template_custom.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
};

const buildDigestHtml = ({ rule, items, isGrouped, chunkIndex, totalChunks, totalItems, fromDate, toDate, appNameMap }) => {
  const fmtDate = (d) => new Date(d).toUTCString().replace(' GMT', ' UTC');
  const rangeLabel = rule.time_range_type === 'last_24h'
    ? 'last 24 hours'
    : `last ${rule.time_range_hours} hour(s)`;

  const cols = resolveColumns(rule, isGrouped ? 'grouped' : 'flat');
  const thStyle = 'padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb';
  const tdStyle = 'padding:9px 12px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;vertical-align:top';

  const thead = `<tr style="background:#f8fafc">${cols.map((c) => `<th style="${thStyle}">${escHtml(c.label)}</th>`).join('')}</tr>`;

  const rows = items.map((item, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#fafafa';
    const cells = cols.map((c) => renderDefaultCell(c.key, item, isGrouped, rule, appNameMap, fmtDate, tdStyle)).join('');
    return `<tr style="background:${bg}">${cells}</tr>`;
  }).join('');

  const chunkNote = totalChunks > 1
    ? `<p style="font-size:12px;color:#6b7280;margin:0 0 16px">Email ${chunkIndex} of ${totalChunks} — showing ${items.length} of ${totalItems} ${isGrouped ? 'groups' : 'logs'}</p>`
    : `<p style="font-size:12px;color:#6b7280;margin:0 0 16px">${totalItems} ${isGrouped ? 'group(s)' : 'log(s)'} found</p>`;

  return emailWrapper(`Log Digest: ${rule.name}`, '#6c47ff', `
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
      <tr>
        <td style="padding:4px 0;color:#6b7280;width:110px">Rule</td>
        <td style="padding:4px 0;font-weight:600">${escHtml(rule.name)}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#6b7280">Period</td>
        <td style="padding:4px 0">${rangeLabel} — ${fmtDate(fromDate)} → ${fmtDate(toDate)}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#6b7280">Levels</td>
        <td style="padding:4px 0">${escHtml((rule.log_levels || []).join(', ') || 'All')}</td>
      </tr>
    </table>
    ${chunkNote}
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <thead>${thead}</thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p style="font-size:11px;color:#9ca3af;margin-top:16px">Sent by LogHive · ${fmtDate(new Date())}</p>
  `);
};

// ── Subject template renderer ─────────────────────────────────────────────────
// Supported variables: {rule_name} {date} {time} {app_names} {log_count} {levels} {range}
const renderSubject = (template, vars) => {
  const pad = (n) => String(n).padStart(2, '0');
  const now = vars.toDate || new Date();
  const defaults = {
    rule_name:  vars.rule?.name || '',
    date:       `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`,
    time:       `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`,
    app_names:  vars.appNames || 'All apps',
    log_count:  String(vars.logCount ?? 0),
    levels:     (vars.rule?.log_levels || []).join(', ') || 'All',
    range:      vars.rule?.time_range_type === 'last_24h'
                  ? 'last 24h'
                  : `last ${vars.rule?.time_range_hours || 24}h`,
  };

  const tpl = template || '[LogHive] {rule_name} — {log_count} log(s)';
  return tpl.replace(/\{(\w+)\}/g, (_, key) => defaults[key] ?? `{${key}}`);
};

const buildAllClearHtml = ({ rule, fromDate, toDate }) => {
  const fmtDate = (d) => new Date(d).toUTCString().replace(' GMT', ' UTC');
  const rangeLabel = rule.time_range_type === 'last_24h'
    ? 'last 24 hours'
    : `last ${rule.time_range_hours} hour(s)`;

  return emailWrapper(`Log Digest: ${rule.name}`, '#16a34a', `
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
      <tr>
        <td style="padding:4px 0;color:#6b7280;width:110px">Rule</td>
        <td style="padding:4px 0;font-weight:600">${rule.name}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#6b7280">Period</td>
        <td style="padding:4px 0">${rangeLabel} — ${fmtDate(fromDate)} → ${fmtDate(toDate)}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#6b7280">Levels</td>
        <td style="padding:4px 0">${(rule.log_levels || []).join(', ') || 'All'}</td>
      </tr>
    </table>
    <div style="text-align:center;padding:32px 0">
      <div style="width:64px;height:64px;border-radius:50%;background:#f0fdf4;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <p style="font-size:18px;font-weight:700;color:#15803d;margin:0 0 8px">All clear!</p>
      <p style="font-size:14px;color:#6b7280;margin:0">No logs matched your filter criteria in this period.</p>
    </div>
    <p style="font-size:11px;color:#9ca3af;margin-top:16px;text-align:center">Sent by LogHive · ${fmtDate(new Date())}</p>
  `);
};

const buildTeamsAllClearHtml = ({ rule, fromDate, toDate }) => {
  const fmtDate = (d) => new Date(d).toUTCString().replace(' GMT', ' UTC');
  const rangeLabel = rule.time_range_type === 'last_24h' ? 'last 24 hours' : `last ${rule.time_range_hours} hour(s)`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<h2>&#10003; All clear &mdash; ${escHtml(rule.name)}</h2>
<p>
  <b>Period:</b> ${rangeLabel} &mdash; ${fmtDate(fromDate)} &rarr; ${fmtDate(toDate)}<br>
  <b>Levels:</b> ${escHtml((rule.log_levels || []).join(', ') || 'All')}
</p>
<p>No logs matched your filter criteria during this period.</p>
<hr>
<p style="font-size:12px;color:#666">Sent by LogHive &middot; ${fmtDate(toDate)}</p>
</body></html>`;
};

const sendAllClearEmail = async ({ rule, recipients, fromDate, toDate, appNameMap = {}, emailConfig }) => {
  const appNames = Object.values(appNameMap).filter(Boolean).join(', ') || 'All apps';
  const subject = rule.subject_template
    ? renderSubject(rule.subject_template, { rule, toDate, appNames, logCount: 0 })
    : `[LogHive] ${rule.name} — All clear`;

  const tplType = rule.email_template_type || 'default';
  const html = tplType === 'teams'
    ? buildTeamsAllClearHtml({ rule, fromDate, toDate })
    : buildAllClearHtml({ rule, fromDate, toDate });

  try {
    await sendWithConfig({ config: emailConfig, to: recipients, subject, html });
    console.log(`[Email] All-clear digest "${rule.name}" sent to ${recipients.length} recipient(s)`);
  } catch (err) {
    console.error(`[Email] Failed to send all-clear for rule "${rule.name}":`, err.message);
    throw err;
  }
};

const sendNotificationDigest = async ({ rule, recipients, items, isGrouped, chunkIndex, totalChunks, totalItems, fromDate, toDate, appNameMap, emailConfig }) => {
  const appNames = Object.values(appNameMap).filter(Boolean).join(', ') || 'All apps';
  let subject;
  if (rule.subject_template) {
    const rendered = renderSubject(rule.subject_template, { rule, toDate, appNames, logCount: totalItems });
    subject = totalChunks > 1 ? `${rendered} (${chunkIndex}/${totalChunks})` : rendered;
  } else {
    subject = totalChunks > 1
      ? `[LogHive] ${rule.name} — email ${chunkIndex}/${totalChunks} (${totalItems} ${isGrouped ? 'groups' : 'logs'})`
      : `[LogHive] ${rule.name} — ${totalItems} ${isGrouped ? 'group(s)' : 'log(s)'}`;
  }

  const tplType = rule.email_template_type || 'default';
  const html = tplType === 'teams'
    ? buildTeamsHtml({ rule, items, isGrouped, chunkIndex, totalChunks, totalItems, fromDate, toDate, appNameMap })
    : tplType === 'custom'
      ? buildCustomHtml({ rule, items, isGrouped, chunkIndex, totalChunks, totalItems, fromDate, toDate, appNameMap })
      : buildDigestHtml({ rule, items, isGrouped, chunkIndex, totalChunks, totalItems, fromDate, toDate, appNameMap });

  try {
    await sendWithConfig({ config: emailConfig, to: recipients, subject, html });
    console.log(`[Email] Digest "${rule.name}" chunk ${chunkIndex}/${totalChunks} sent to ${recipients.length} recipient(s)`);
  } catch (err) {
    console.error(`[Email] Failed to send digest for rule "${rule.name}":`, err.message);
    throw err;
  }
};

// ── Alert email builder ──────────────────────────────────────────────────────
const buildAlertEmail = (rule, result, appNameMap) => {
  const fmtDate = (d) => d ? new Date(d).toUTCString().replace(' GMT', ' UTC') : '—';
  const nameFor = (uuid) => appNameMap[uuid] || uuid || '—';

  let subject, body;

  if (result.type === 'error_spike') {
    subject = `[LogHive Alert] ${rule.name} — ${result.total} errors in last ${result.window_minutes}min`;
    const rows = (result.breakdown || []).map((r) =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${escHtml(nameFor(r._id))}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:700;color:#dc2626">${r.count.toLocaleString()}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#9ca3af">${fmtDate(r.latest)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml((r.sample || '').substring(0, 120))}</td>
      </tr>`
    ).join('');

    body = `
      <p style="font-size:14px;color:#374151;margin-bottom:16px">
        <strong>${result.total.toLocaleString()}</strong> ${escHtml(result.levels.join('/'))} logs detected in the last
        <strong>${result.window_minutes} minutes</strong> (threshold: ${result.threshold}).
      </p>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <thead><tr style="background:#fef2f2">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#991b1b;border-bottom:1px solid #fecaca">App</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#991b1b;border-bottom:1px solid #fecaca">Count</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#991b1b;border-bottom:1px solid #fecaca">Latest</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#991b1b;border-bottom:1px solid #fecaca">Sample</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } else if (result.type === 'low_volume') {
    subject = `[LogHive Alert] ${rule.name} — only ${result.actual_percentage}% of expected logs`;
    body = `
      <div style="text-align:center;padding:24px 0">
        <div style="font-size:48px;font-weight:800;color:#dc2626;margin-bottom:4px">${result.actual_percentage}%</div>
        <div style="font-size:14px;color:#6b7280">of expected log volume</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
        <tr><td style="padding:6px 0;color:#6b7280;width:140px">Today's count</td><td style="padding:6px 0;font-weight:600">${result.today_count.toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">${result.baseline_days}-day average</td><td style="padding:6px 0;font-weight:600">${result.avg_count.toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Threshold</td><td style="padding:6px 0;font-weight:600">Below ${result.threshold_percentage}%</td></tr>
      </table>
      <p style="font-size:13px;color:#9ca3af">This may indicate an outage, deployment issue, or misconfigured logging.</p>
    `;
  } else if (result.type === 'no_logs') {
    subject = `[LogHive Alert] ${rule.name} — ${result.silent_apps.length} app(s) silent for ${result.silence_hours}h+`;
    const rows = result.silent_apps.map((a) =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:600">${escHtml(nameFor(a.app_uuid))}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#9ca3af;font-size:12px">${a.last_log ? fmtDate(a.last_log) : 'Never'}</td>
      </tr>`
    ).join('');

    body = `
      <p style="font-size:14px;color:#374151;margin-bottom:16px">
        <strong>${result.silent_apps.length}</strong> app(s) have not sent any logs in the last
        <strong>${result.silence_hours} hour(s)</strong>.
      </p>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <thead><tr style="background:#fef9c3">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#854d0e;border-bottom:1px solid #fde68a">App</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#854d0e;border-bottom:1px solid #fde68a">Last Log</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  const colors = { error_spike: '#dc2626', low_volume: '#d97706', no_logs: '#7c3aed' };
  const labels = { error_spike: 'Error Spike', low_volume: 'Low Volume', no_logs: 'Silent App' };
  const html = emailWrapper(`Alert: ${labels[result.type]}`, colors[result.type] || '#dc2626', `
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
      <tr><td style="padding:4px 0;color:#6b7280;width:110px">Rule</td><td style="padding:4px 0;font-weight:600">${escHtml(rule.name)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Type</td><td style="padding:4px 0">${labels[result.type]}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Checked at</td><td style="padding:4px 0">${fmtDate(new Date())}</td></tr>
    </table>
    ${body}
    <p style="font-size:11px;color:#9ca3af;margin-top:20px;text-align:center">Sent by LogHive · ${fmtDate(new Date())}</p>
  `);

  return { subject, html };
};

module.exports = {
  sendWelcomeEmail,
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendFatalAlert,
  sendVerificationEmail,
  sendNotificationDigest,
  sendAllClearEmail,
  resolveEmailConfig,
  sendWithConfig,
  buildAlertEmail,
};
