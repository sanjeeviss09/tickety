import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

// Get public configuration (e.g., app name, logos)
router.get('/config', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'general_config')
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const config = data?.value || {};
    
    res.status(200).json({ 
      status: 'success', 
      data: { 
        app_name: config.app_name || 'DeskPulse' 
      } 
    });
  } catch (error: any) {
    console.error('Error fetching public config:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;
