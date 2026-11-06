import { Request, Response } from 'express';
import * as attendanceService from '../services/attendance.service';
import { supabaseAdmin } from '../config/supabase';

export const checkIn = async (req: Request, res: Response) => {
  try {
    const { shift_date, technician_id } = req.body;
    const authUserId = (req as any).user?.id;
    if (!authUserId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized', error: 'Unauthorized' });
    }

    let targetId = technician_id;
    if (!targetId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .or(`id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
        .single();
      targetId = profile?.id;
    }

    if (!targetId) {
       return res.status(400).json({ status: 'error', message: 'technician_id is required', error: 'technician_id is required' });
    }

    const date = shift_date || new Date().toISOString().split('T')[0];
    const result = await attendanceService.checkIn(targetId, date);
    res.status(200).json({ status: 'success', ...result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message, error: error.message });
  }
};

export const checkOut = async (req: Request, res: Response) => {
  try {
    const { shift_date, technician_id } = req.body;
    const authUserId = (req as any).user?.id;
    if (!authUserId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized', error: 'Unauthorized' });
    }

    let targetId = technician_id;
    if (!targetId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .or(`id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
        .single();
      targetId = profile?.id;
    }

    if (!targetId) {
       return res.status(400).json({ status: 'error', message: 'technician_id is required', error: 'technician_id is required' });
    }

    const date = shift_date || new Date().toISOString().split('T')[0];
    const result = await attendanceService.checkOut(targetId, date);
    res.status(200).json({ status: 'success', ...result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message, error: error.message });
  }
};
