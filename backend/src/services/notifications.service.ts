import { supabaseAdmin } from '../config/supabase';
import { sendEmail } from './email.service';

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  link?: string;
}) {
  const { userId, title, message, link } = params;
  const { error } = await supabaseAdmin.from('notifications').insert([{
    user_id: userId, title, message, link, is_read: false,
  }]);
  if (error) console.error('[notifications.service] createNotification error:', error);
}

export async function notifyAndEmail(params: {
  recipientProfileId: string;
  eventName: string;
  templateVars: Record<string, string>;
  link?: string;
  fallbackTitle?: string;
  fallbackMessage?: string;
  customTitle?: string;
  customMessage?: string;
}) {
  const { recipientProfileId, eventName, templateVars, link, fallbackTitle, fallbackMessage, customTitle, customMessage } = params;

  const { data: recipient } = await supabaseAdmin
    .from('profiles').select('id, full_name, email_address').eq('id', recipientProfileId).single();

  if (!recipient) {
    console.warn('[notifications.service] Recipient not found:', recipientProfileId);
    return;
  }

  const { data: template } = await supabaseAdmin
    .from('email_templates').select('subject_template, body_template, is_active')
    .eq('event_name', eventName).single();

  const notifTitle = customTitle || (template
    ? interpolate(template.subject_template, templateVars)
    : (fallbackTitle || eventName));
  const notifBody = customMessage || (template
    ? stripHtml(interpolate(template.body_template, templateVars)).slice(0, 250)
    : (fallbackMessage || ''));

  await createNotification({ userId: recipient.id, title: notifTitle, message: notifBody, link });

  if (template?.is_active && recipient.email_address) {
    const subject = customTitle || interpolate(template.subject_template, templateVars);
    const html = interpolate(template.body_template, {
      ...templateVars,
      technician_name: templateVars.technician_name || recipient.full_name || 'User',
      employee_name: templateVars.employee_name || recipient.full_name || 'User',
    });
    sendEmail({ to: recipient.email_address, subject, html }).catch(err =>
      console.error('[notifications.service] Email error for event', eventName, err)
    );
  }
}

export async function getAdminProfileIds(): Promise<string[]> {
  const { data: adminRoles } = await supabaseAdmin.from('roles').select('id').ilike('name', 'admin');
  const roleIds = (adminRoles ?? []).map((r: any) => r.id);
  if (roleIds.length === 0) return [];
  const { data: admins } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('role_id', roleIds);
  return (admins ?? []).map((a: any) => a.id as string);
}

export async function notifyEscalationRecipients(params: {
  eventName: string;
  templateVars: Record<string, string>;
  link?: string;
}) {
  const { data: slaSettings } = await supabaseAdmin
    .from('system_settings').select('value').eq('key', 'sla_config_extended').single();
  const escalationRecipients: string[] = slaSettings?.value?.escalation_recipients ?? [];
  const { data: adminRole } = await supabaseAdmin.from('roles').select('id').eq('name', 'Admin').single();
  const { data: admins } = adminRole
    ? await supabaseAdmin.from('profiles').select('id').eq('role_id', adminRole.id)
    : { data: [] };
  const allRecipients = new Set<string>([
    ...escalationRecipients,
    ...(admins ?? []).map((a: any) => a.id),
  ]);
  for (const recipientId of allRecipients) {
    await notifyAndEmail({ recipientProfileId: recipientId, ...params });
  }
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
