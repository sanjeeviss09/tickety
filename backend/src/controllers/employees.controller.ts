import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

// Get all employees (Master Data)
export const getEmployees = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*, unit:units(id, name), department:departments(id, name), role:roles(id, name), manager:profiles!reporting_manager_id(id, full_name)')
      .order('full_name', { ascending: true });

    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// Get single employee by ID
export const getEmployeeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*, unit:units(id, name), department:departments(id, name), role:roles(id, name), manager:profiles!reporting_manager_id(id, full_name)')
      .or(`id.eq.${id},auth_user_id.eq.${id},employee_id.eq.${id}`)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ status: 'error', message: 'Employee profile not found' });
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// Create a new employee master record
export const createEmployee = async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const userId = (req as any).user?.id;

    // Server-side validation
    if (!payload.employee_id || !payload.email_address || !payload.full_name) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields: employee_id, email_address, full_name' });
    }

    // Step 1: Create the Supabase Auth user first so we get a valid linked UUID.
    // The employee will set their own real password on first login.
    const tempPassword = `Tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email_address,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: payload.full_name, employee_id: payload.employee_id },
    });

    if (authError) {
      let errMsg = authError.message;
      if (!errMsg || (typeof errMsg === 'object' && Object.keys(errMsg).length === 0)) {
        errMsg = 'Network error or rate limit exceeded while contacting auth provider.';
      } else if (typeof errMsg === 'object') {
        errMsg = JSON.stringify(errMsg);
      }

      if (typeof errMsg === 'string' && (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('registered'))) {
        return res.status(409).json({ status: 'error', message: `An account with email "${payload.email_address}" already exists.` });
      }
      return res.status(500).json({ status: 'error', message: `Failed to create auth account: ${errMsg}` });
    }

    const authUserId = authData.user!.id;

    // Step 2: Insert profile using the auth user UUID as primary key
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: authUserId,
        employee_id: payload.employee_id,
        full_name: payload.full_name,
        email_address: payload.email_address,
        mobile_number: payload.mobile_number,
        designation: payload.designation,
        unit_id: payload.unit_id,
        department_id: payload.department_id,
        location: payload.location,
        joining_date: payload.joining_date,
        employment_status: payload.employment_status || 'Active',
        reporting_manager_id: payload.reporting_manager_id,
        profile_picture_url: payload.profile_picture_url,
        role_id: payload.role_id,
        is_active: true,
        created_by: userId
      }])
      .select()
      .single();

    if (error) {
      // Rollback: delete the auth user if profile insert fails
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
      throw error;
    }

    try {
      await supabaseAdmin.from('audit_logs').insert([{
        user_id: userId,
        action: 'CREATE_EMPLOYEE',
        entity_type: 'PROFILE',
        entity_id: data.id,
        new_values: data
      }]);
    } catch (e) {
      console.error('Audit log error:', e);
    }

    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// Update an employee
export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const userId = (req as any).user?.id;

    // Whitelist only safe, flat columns — prevents nested objects from crashing PostgREST
    const allowed: Record<string, boolean> = {
      full_name: true, email_address: true, mobile_number: true,
      designation: true, unit_id: true, department_id: true,
      location: true, joining_date: true, employment_status: true,
      reporting_manager_id: true, profile_picture_url: true,
      role_id: true, is_active: true,
    };
    const safePayload: Record<string, any> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (allowed[k]) safePayload[k] = v;
    }

    // Derive is_active from employment_status if provided
    if ('employment_status' in safePayload) {
      safePayload.is_active = safePayload.employment_status === 'Active';
    }

    if (userId) safePayload.updated_by = userId;

    console.log(`[updateEmployee] id=${id} payload=`, JSON.stringify(safePayload));

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(safePayload)
      .eq('id', id)
      .select('*, unit:units(id, name), department:departments(id, name), role:roles(id, name)')
      .single();

    if (error) {
      console.error('[updateEmployee] DB error:', error);
      throw error;
    }

    try {
      await supabaseAdmin.from('audit_logs').insert([{
        user_id: userId,
        action: 'UPDATE_EMPLOYEE',
        entity_type: 'PROFILE',
        entity_id: data.id,
        new_values: data
      }]);
    } catch (e) {
      console.error('Audit log error:', e);
    }

    res.json({ status: 'success', data });
  } catch (error: any) {
    console.error('[updateEmployee] Error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Auth user needs to be deleted or disabled. Since profiles cascade from auth.users (if configured that way)
    // we can delete the auth user or the profile. Here, we'll try to delete from profiles, and also delete the auth user if possible.
    const { error } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[deleteEmployee] DB error:', error);
      throw error;
    }
    
    // Attempt to delete from Auth as well
    await supabaseAdmin.auth.admin.deleteUser(id as string).catch(() => {});

    try {
      await supabaseAdmin.from('audit_logs').insert([{
        user_id: (req as any).user?.id,
        action: 'DELETE_EMPLOYEE',
        entity_type: 'PROFILE',
        entity_id: id,
        new_values: null
      }]);
    } catch (e) {
      console.error('Audit log error:', e);
    }

    res.json({ status: 'success', message: 'Employee deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// Bulk Import Employees
export const bulkImportEmployees = async (req: Request, res: Response) => {
  try {
    const { file_name, records } = req.body;
    const userId = (req as any).user?.id;
    
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ status: 'error', message: 'Invalid records array' });
    }

    // 1. Create batch record
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('employee_import_batches')
      .insert([{
        file_name,
        uploaded_by: userId,
        total_records: records.length,
        status: 'Processing'
      }])
      .select()
      .single();

    if (batchError) throw batchError;

    let successful = 0;
    let failed = 0;
    const errors = [];

    // 2. Process records
    for (const [index, record] of records.entries()) {
      try {
        const { error: insertError } = await supabaseAdmin
          .from('profiles')
          .insert([{
            employee_id: record.employee_id,
            full_name: record.full_name,
            email_address: record.email,
            mobile_number: record.mobile,
            designation: record.designation,
            unit_id: record.unit_id,
            department_id: record.department_id,
            location: record.location,
            joining_date: record.joining_date,
            employment_status: record.employment_status || 'Active',
            reporting_manager_id: record.reporting_manager_id,
            role_id: record.role_id,
            is_active: true,
            created_by: userId
          }]);

        if (insertError) {
          throw insertError;
        }
        successful++;
      } catch (err: any) {
        failed++;
        errors.push({
          batch_id: batch.id,
          row_number: index + 2, // Excel row offset
          field_name: 'row',
          supplied_value: JSON.stringify(record),
          error_message: err.message || 'Validation failed'
        });
      }
    }

    // 3. Log errors if any
    if (errors.length > 0) {
      await supabaseAdmin.from('employee_import_errors').insert(errors);
    }

    // 4. Update batch status
    await supabaseAdmin
      .from('employee_import_batches')
      .update({
        successful_records: successful,
        failed_records: failed,
        status: failed === 0 ? 'Completed' : 'Completed with Errors'
      })
      .eq('id', batch.id);

    // 5. Audit Log
    try {
      await supabaseAdmin.from('audit_logs').insert([{
        user_id: userId,
        action: 'BULK_IMPORT_EMPLOYEES',
        entity_type: 'IMPORT_BATCH',
        entity_id: batch.id,
        new_values: { successful, failed }
      }]);
    } catch (e) {
      console.error('Audit log error:', e);
    }

    res.json({ 
      status: 'success', 
      data: { batch_id: batch.id, successful, failed, errors } 
    });

  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
