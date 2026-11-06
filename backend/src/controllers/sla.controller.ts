import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';

export const getSlaPolicies = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sla_policies')
      .select('*, business_hours_profiles(*), sla_escalation_rules(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createSlaPolicy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { escalation_rules, ...policyData } = req.body;
    
    // Check for exact conflict
    const { data: existing } = await supabaseAdmin
      .from('sla_policies')
      .select('id')
      .eq('is_active', true)
      .is('unit_id', policyData.unit_id || null)
      .is('category_id', policyData.category_id || null)
      .is('priority', policyData.priority || null)
      .limit(1);
      
    if (existing && existing.length > 0 && policyData.is_active) {
      return res.status(400).json({ status: 'error', message: 'An active SLA policy with this exact Unit, Category, and Priority already exists. Please modify the existing policy to avoid conflicts.' });
    }

    const { data: policy, error } = await supabaseAdmin
      .from('sla_policies')
      .insert([{
        ...policyData,
        created_by: req.user?.id,
        updated_by: req.user?.id
      }])
      .select()
      .single();

    if (error) throw error;

    if (escalation_rules && escalation_rules.length > 0) {
      const rulesToInsert = escalation_rules.map((r: any) => ({
        policy_id: policy.id,
        threshold_percent: r.threshold_percent,
        recipient_type: r.recipient_type,
        recipient_id: r.recipient_id,
        action: r.action
      }));
      await supabaseAdmin.from('sla_escalation_rules').insert(rulesToInsert);
    }

    res.status(201).json({ status: 'success', data: policy });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateSlaPolicy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { escalation_rules, ...policyData } = req.body;

    const { data: policy, error } = await supabaseAdmin
      .from('sla_policies')
      .update({
        ...policyData,
        updated_by: req.user?.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (escalation_rules) {
      await supabaseAdmin.from('sla_escalation_rules').delete().eq('policy_id', id);
      if (escalation_rules.length > 0) {
        const rulesToInsert = escalation_rules.map((r: any) => ({
          policy_id: policy.id,
          threshold_percent: r.threshold_percent,
          recipient_type: r.recipient_type,
          recipient_id: r.recipient_id || null,
          action: r.action
        }));
        await supabaseAdmin.from('sla_escalation_rules').insert(rulesToInsert);
      }
    }

    res.json({ status: 'success', data: policy });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const deleteSlaPolicy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('sla_policies').delete().eq('id', id);
    if (error) throw error;
    res.json({ status: 'success', message: 'Policy deleted' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getBusinessHours = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin.from('business_hours_profiles').select('*');
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
