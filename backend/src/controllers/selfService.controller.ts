import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { z } from 'zod';

const createEventSchema = z.object({
  category_id: z.string().uuid(),
  guidance_shown: z.any().optional(), // Store what they saw
});

export const createSelfServiceEvent = async (req: Request, res: Response) => {
  try {
    const authUserId = req.user?.id;
    if (!authUserId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();

    if (!profile) return res.status(400).json({ status: 'error', message: 'User profile not found' });

    const validatedData = createEventSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('ticket_self_service_events')
      .insert([{
        employee_id: profile.id,
        category_id: validatedData.category_id,
        guidance_shown: validatedData.guidance_shown,
        outcome: 'abandoned', // Initial status
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.issues.map(i => i.message).join(', ') });
    }
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const updateEventSchema = z.object({
  outcome: z.enum(['solved', 'escalated', 'skipped', 'abandoned']),
  skip_reason: z.string().optional().nullable(),
});

export const updateSelfServiceEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authUserId = req.user?.id;
    if (!authUserId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const validatedData = updateEventSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('ticket_self_service_events')
      .update({
        outcome: validatedData.outcome,
        skip_reason: validatedData.skip_reason,
        completed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: error.issues.map(i => i.message).join(', ') });
    }
    res.status(500).json({ status: 'error', message: error.message });
  }
};
