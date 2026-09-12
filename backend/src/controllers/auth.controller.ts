import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { z } from 'zod';

const firstLoginSchema = z.object({
  employee_id: z.string().min(1),
  password: z.string().min(5),
});

export const firstLogin = async (req: Request, res: Response) => {
  try {
    const { employee_id, password } = firstLoginSchema.parse(req.body);
    const empIdUpper = employee_id.toUpperCase();
    const internalEmail = `${empIdUpper.toLowerCase()}@deskpulse.internal`;

    // 1. Find profile by employee_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('employee_id', empIdUpper)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Employee ID not found in system directory.' 
      });
    }

    // 2. Search auth users list
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const allUsers = listData?.users || [];
    
    let matchingAuthUser = allUsers.find(
      (u) => u.id === profile.id ||
             u.email?.toLowerCase() === internalEmail.toLowerCase() ||
             (profile.email_address && u.email?.toLowerCase() === profile.email_address.toLowerCase())
    );

    // 3. If auth user exists, update password
    if (matchingAuthUser) {
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        matchingAuthUser.id,
        { password: password, email_confirm: true }
      );

      if (updateErr) {
        const msg = updateErr?.message ? String(updateErr.message) : String(updateErr);
        return res.status(500).json({ status: 'error', message: msg, rawError: Object.getOwnPropertyNames(updateErr).reduce((acc: any, key) => { acc[key] = (updateErr as any)[key]; return acc; }, {}) });
      }

      // Sync profile data
      await supabaseAdmin
        .from('profiles')
        .update({ 
          id: matchingAuthUser.id, 
          email_address: matchingAuthUser.email || internalEmail 
        })
        .eq('employee_id', empIdUpper);

      return res.json({
        status: 'success',
        message: 'Password set successfully.',
        email: matchingAuthUser.email || internalEmail
      });
    }

    // 4. Create auth user with internal system email domain
    // Workaround: Bulk imported profiles have no auth_user_id and trigger crashes on employee_id unique constraint.
    const isUnlinkedProfile = !profile.auth_user_id && profile.id;
    let tempEmpId = '';
    let tempEmail = '';
    
    if (isUnlinkedProfile) {
      tempEmpId = `${empIdUpper}_TMP_${Date.now()}`;
      tempEmail = `${profile.email_address}_TMP_${Date.now()}`;
      await supabaseAdmin.from('profiles').update({ 
        employee_id: tempEmpId, 
        email_address: tempEmail 
      }).eq('id', profile.id);
    }

    const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: profile.full_name, employee_id: profile.employee_id }
    });

    if (createErr || !createData?.user) {
      if (isUnlinkedProfile) {
        // Rollback rename
        await supabaseAdmin.from('profiles').update({ 
          employee_id: profile.employee_id, 
          email_address: profile.email_address 
        }).eq('id', profile.id);
      }
      const msg = createErr?.message ? String(createErr.message) : String(createErr);
      const rawError = createErr ? Object.getOwnPropertyNames(createErr).reduce((acc: any, key) => { acc[key] = (createErr as any)[key]; return acc; }, {}) : null;
      console.error('createUser error:', createErr);
      return res.status(500).json({ status: 'error', message: msg, rawError });
    }

    const newAuthUserId = createData.user.id;

    if (isUnlinkedProfile) {
      // Sync all data from old profile to new profile created by trigger
      await supabaseAdmin.from('profiles').update({
        mobile_number: profile.mobile_number,
        role_id: profile.role_id,
        unit_id: profile.unit_id,
        department_id: profile.department_id,
        profile_picture_url: profile.profile_picture_url,
        employment_status: profile.employment_status,
        designation: profile.designation,
        location: profile.location,
        joining_date: profile.joining_date,
        reporting_manager_id: profile.reporting_manager_id,
        is_active: profile.is_active,
        created_by: profile.created_by,
        email_address: profile.email_address, // restore real email
        has_set_password: true
      }).eq('id', newAuthUserId);

      // Delete old unlinked profile
      await supabaseAdmin.from('profiles').delete().eq('id', profile.id);
    } else {
      // 5. Normal Sync profile row to point to newAuthUserId
      await supabaseAdmin
        .from('profiles')
        .update({ 
          auth_user_id: newAuthUserId, 
          email_address: internalEmail,
          has_set_password: true
        })
        .eq('employee_id', empIdUpper);
    }

    return res.json({
      status: 'success',
      message: 'Account setup complete.',
      email: internalEmail
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', errors: error.issues });
    }
    const msg = error?.message || 'Server error';
    console.error('First login error:', error);
    res.status(500).json({ status: 'error', message: msg });
  }
};
