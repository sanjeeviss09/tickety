import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
    unit_id?: string;
    department_id?: string;
  };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token using Supabase admin
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid token' });
    }

    // Fetch the user profile to get roles and department information
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role_id, unit_id, department_id, roles(name)')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Profile not found' });
    }

    // roles(name) join can return object or array depending on FK direction
    const rolesData = (profile as any).roles;
    let roleName: string | undefined;
    if (Array.isArray(rolesData)) {
      roleName = rolesData[0]?.name;
    } else if (rolesData && typeof rolesData === 'object') {
      roleName = rolesData.name;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: roleName || 'Admin', // default Admin for bootstrap user with no role set
      unit_id: profile.unit_id,
      department_id: profile.department_id,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};
