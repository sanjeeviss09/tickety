import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';

export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('*');

    if (error) throw error;

    const formattedData = data.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, any>);

    res.status(200).json({ status: 'success', data: formattedData });
  } catch (error: any) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getSystemSettingByKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore not found, just return null

    res.status(200).json({ status: 'success', data: data?.value || null });
  } catch (error: any) {
    console.error(`Error fetching setting ${req.params.key}:`, error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateSystemSetting = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!value) {
      return res.status(400).json({ status: 'error', message: 'Value is required' });
    }

    // 1. Fetch old value for audit log
    const { data: oldData } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single();

    // 2. Upsert new value
    const { data: newData, error } = await supabaseAdmin
      .from('system_settings')
      .upsert({
        key,
        value,
        updated_by: req.user?.id
      }, { onConflict: 'key' })
      .select('value')
      .single();

    if (error) throw error;

    // 3. Create Audit Log
    if (req.user?.id) {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: req.user.id,
        action: 'UPDATE_SETTING',
        entity_type: 'system_settings',
        entity_id: key,
        old_values: oldData?.value || null,
        new_values: value
      });
    }

    res.status(200).json({ status: 'success', data: newData?.value, message: 'Setting updated successfully' });
  } catch (error: any) {
    console.error(`Error updating setting ${req.params.key}:`, error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// Email Templates
export const getEmailTemplates = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .order('event_name');

    if (error) throw error;
    res.status(200).json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateEmailTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      subject_template: z.string().min(1),
      body_template: z.string().min(1),
      is_active: z.boolean().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: 'Invalid data', errors: parsed.error.errors });
    }

    // Fetch old
    const { data: oldData } = await supabaseAdmin.from('email_templates').select('*').eq('id', id).single();

    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .update({
        ...parsed.data,
        updated_by: req.user?.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Audit Log
    if (req.user?.id && oldData) {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: req.user.id,
        action: 'UPDATE_EMAIL_TEMPLATE',
        entity_type: 'email_templates',
        entity_id: id,
        old_values: oldData,
        new_values: data
      });
    }

    res.status(200).json({ status: 'success', data, message: 'Template updated successfully' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const testEmailTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { to_email, subject, html_body } = req.body;

    if (!to_email || !subject || !html_body) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields for test email' });
    }

    // We call the Supabase Edge Function to send the email securely
    // This avoids needing the Resend API key in the backend
    const { data, error } = await supabaseAdmin.functions.invoke('send-email', {
      body: {
        to: [to_email],
        subject: subject,
        html: html_body
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error('Failed to invoke edge function');
    }

    if (data?.error) {
       throw new Error(data.error.message || 'Error from email provider');
    }

    res.status(200).json({ status: 'success', message: 'Test email sent successfully' });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};
