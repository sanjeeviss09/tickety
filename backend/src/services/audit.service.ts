import { supabaseAdmin } from '../config/supabase';
import { Request } from 'express';

export const logAudit = async (
  req: Request,
  action: string,
  entityType: string,
  entityId: string,
  oldValues: any = null,
  newValues: any = null
) => {
  try {
    const userId = (req as any).user?.id || null;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
    const deviceInfo = req.headers['user-agent'] || null;

    const { error } = await supabaseAdmin.from('audit_logs').insert([{
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: ipAddress,
      device_info: deviceInfo
    }]);

    if (error) {
      console.error('Failed to write audit log:', error);
    }
  } catch (err) {
    console.error('Audit logging exception:', err);
  }
};
