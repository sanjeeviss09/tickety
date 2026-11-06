import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { z } from 'zod';

const createAssetSchema = z.object({
  asset_code: z.string().min(1),
  name: z.string().min(1),
  category_id: z.string().uuid().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  purchase_date: z.string().optional(),
  purchase_cost: z.number().optional(),
  vendor: z.string().optional(),
  status: z.enum(['Available', 'Assigned', 'In Repair', 'Under Maintenance', 'Retired', 'Lost', 'Damaged', 'Disposed', 'Reserved']).default('Available'),
  condition: z.enum(['Excellent', 'Good', 'Fair', 'Poor', 'Critical']).default('Good'),
  unit: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  warranty: z.string().optional(),
  port_number: z.string().optional(),
});

export const getCategories = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin.from('asset_categories').select('*').order('name');
    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createAsset = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;
    
    // Only Admin or Technician can create assets
    if (role !== 'Admin' && role !== 'Technician') {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }

    const validatedData = createAssetSchema.parse(req.body);
    const { assigned_to, ...assetData } = validatedData;

    let finalAssignee = assigned_to;

    // If not assigned to an employee but it has a unit, automatically assign to a unit technician
    if (!finalAssignee && assetData.unit) {
      // Find a technician in this unit
      // First, try to see if the creator is a technician in this unit
      const { data: creatorProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, unit:units!inner(name), role:roles!inner(name)')
        .eq('id', userId)
        .single();
      
      const roleObj: any = creatorProfile?.role;
      const unitObj: any = creatorProfile?.unit;
      if (creatorProfile && roleObj?.name === 'Technician' && unitObj?.name === assetData.unit) {
        finalAssignee = userId;
      } else {
        // Find first available technician in this unit
        const { data: techs } = await supabaseAdmin
          .from('profiles')
          .select('id, role:roles!inner(name), unit:units!inner(name)')
          .eq('roles.name', 'Technician')
          .eq('units.name', assetData.unit)
          .limit(1);
          
        if (techs && techs.length > 0) {
          finalAssignee = techs[0].id;
        }
      }
    }

    if (finalAssignee) {
      assetData.status = 'Assigned';
    }

    const { data: asset, error } = await supabaseAdmin
      .from('assets')
      .insert([{
        ...assetData,
        created_by: userId,
      }])
      .select()
      .single();

    if (error) throw error;

    if (finalAssignee) {
      await supabaseAdmin.from('asset_assignments').insert([{
        asset_id: asset.id,
        assigned_to: finalAssignee,
        assigned_by: userId,
        status: 'Active',
        remarks: assigned_to ? 'Assigned during creation' : 'Auto-assigned to unit technician'
      }]);
    }

    // Log history
    await supabaseAdmin.from('asset_history').insert([{
      asset_id: asset.id,
      action: 'Created',
      performed_by: userId,
      remarks: 'Asset created'
    }]);

    res.status(201).json({ status: 'success', data: asset });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ status: 'error', errors: error.issues });
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getAssets = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;
    
    let query = supabaseAdmin
      .from('assets')
      .select(`
        *,
        asset_categories (name),
        assignments:asset_assignments (assigned_to, is_default, assigned_user:profiles!asset_assignments_assigned_to_fkey(full_name))
      `);
      
    // Apply role restrictions
    if (role === 'Employee') {
      // Employees only see assets currently assigned to them
      query = query.eq('assignments.assigned_to', userId).eq('assignments.status', 'Active');
    }

    // Filters
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.category_id) query = query.eq('category_id', req.query.category_id);
    if (req.query.assigned_to) {
      query = query.eq('assignments.assigned_to', req.query.assigned_to).eq('assignments.status', 'Active');
    }
    
    // Sort
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    
    // For Employee or when assigned_to filter is used, we need to filter out assets that were returned by inner join simulation since supabase deep filtering might return the parent row with empty assignments.
    let filteredData = Array.isArray(data) ? data : [];
    if (role === 'Employee') {
      filteredData = filteredData.filter((a: any) => a.assignments && a.assignments.some((ass: any) => ass.assigned_to === userId));
    } else if (req.query.assigned_to) {
      filteredData = filteredData.filter((a: any) => a.assignments && a.assignments.some((ass: any) => ass.assigned_to === req.query.assigned_to));
    }

    res.json({ status: 'success', data: filteredData });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getAssetById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = (req as any).user?.role;
    const userId = (req as any).user?.id;

    const { data, error } = await supabaseAdmin
      .from('assets')
      .select(`
        *,
        category:asset_categories (name),
        warranty:asset_warranty (*),
        maintenance:asset_maintenance (*),
        assignments:asset_assignments (*, assigned_user:profiles!asset_assignments_assigned_to_fkey(full_name), assigned_by_user:profiles!asset_assignments_assigned_by_fkey(full_name)),
        documents:asset_documents (*, uploader:profiles(full_name)),
        history:asset_history (*, user:profiles!asset_history_performed_by_fkey(full_name), prev:profiles!asset_history_previous_owner_fkey(full_name), next:profiles!asset_history_new_owner_fkey(full_name))
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    
    // Role check
    if (role === 'Employee') {
      const isAssigned = data.assignments?.some((ass: any) => ass.assigned_to === userId && ass.status === 'Active');
      if (!isAssigned) {
        return res.status(403).json({ status: 'error', message: 'Forbidden' });
      }
    }

    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const updateAsset = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = (req as any).user?.role;
    const userId = (req as any).user?.id;

    if (role === 'Employee') return res.status(403).json({ status: 'error', message: 'Forbidden' });

    const { data: oldAsset } = await supabaseAdmin.from('assets').select('*').eq('id', id).single();
    if (!oldAsset) return res.status(404).json({ status: 'error', message: 'Not found' });

    const { data: asset, error } = await supabaseAdmin
      .from('assets')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from('asset_history').insert([{
      asset_id: asset.id,
      action: 'Updated',
      performed_by: userId,
      remarks: 'Asset details updated'
    }]);

    res.json({ status: 'success', data: asset });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const assignAsset = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { assigned_to, remarks } = req.body;
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;

    if (role === 'Employee') return res.status(403).json({ status: 'error', message: 'Forbidden' });

    // Mark previous assignments as inactive
    await supabaseAdmin
      .from('asset_assignments')
      .update({ status: 'Returned', returned_at: new Date().toISOString() })
      .eq('asset_id', id)
      .eq('status', 'Active');

    // Create new assignment
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('asset_assignments')
      .insert([{
        asset_id: id,
        assigned_to,
        assigned_by: userId,
        remarks,
        status: 'Active'
      }])
      .select()
      .single();

    if (assignmentError) throw assignmentError;

    // Update asset status
    await supabaseAdmin
      .from('assets')
      .update({ status: 'Assigned' })
      .eq('id', id);

    // Record history
    await supabaseAdmin.from('asset_history').insert([{
      asset_id: id,
      action: 'Assigned',
      performed_by: userId,
      new_owner: assigned_to,
      remarks: remarks || 'Asset assigned to employee'
    }]);

    res.json({ status: 'success', data: assignment });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const bulkImportAssets = async (req: Request, res: Response) => {
  try {
    const { file_name, records } = req.body;
    
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ status: 'error', message: 'Invalid records array' });
    }

    // 1. Create batch record
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('asset_import_batches')
      .insert([{
        file_name,
        uploaded_by: (req as any).user?.id,
        total_records: records.length,
        status: 'Processing'
      }])
      .select()
      .single();

    if (batchError) throw batchError;

    let successful = 0;
    let failed = 0;
    const errors = [];

    // Pre-fetch profiles for resolving assigned employee
    const { data: allProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, employee_id, full_name, email_address, unit:units(name), department:departments(name)');

    // 2. Process records
    for (const [index, record] of records.entries()) {
      try {
        let matchedEmp: any = null;
        const empIdentifier = String(record.assigned_employee_id || record.employee_id || record.assigned_to || '').trim().toLowerCase();
        if (empIdentifier && allProfiles) {
          matchedEmp = allProfiles.find((p: any) => 
            (p.employee_id && p.employee_id.toLowerCase() === empIdentifier) ||
            (p.id && p.id.toLowerCase() === empIdentifier) ||
            (p.email_address && p.email_address.toLowerCase() === empIdentifier)
          );
        }

        // If employee is matched, auto-fill unit and department if not already set
        const finalUnit = record.unit || (matchedEmp?.unit?.name ?? null);
        const finalDepartment = record.department || (matchedEmp?.department?.name ?? null);
        let finalStatus = record.status || (matchedEmp ? 'Assigned' : 'Available');
        if (matchedEmp && (!record.status || record.status === 'Available')) {
          finalStatus = 'Assigned';
        }

        const { data: insertedAsset, error: insertError } = await supabaseAdmin
          .from('assets')
          .insert([{
            asset_code: record.asset_code,
            name: record.name,
            category_id: record.category_id || null,
            brand: record.brand,
            model: record.model,
            serial_number: record.serial_number,
            purchase_date: record.purchase_date || null,
            purchase_cost: record.purchase_cost || null,
            vendor: record.vendor,
            status: finalStatus,
            condition: record.condition || 'Good',
            unit: finalUnit,
            department: finalDepartment,
            location: record.location,
            created_by: (req as any).user?.id
          }])
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        // Create assignment record if assigned employee was provided
        if (matchedEmp && insertedAsset) {
          await supabaseAdmin.from('asset_assignments').insert([{
            asset_id: insertedAsset.id,
            assigned_to: matchedEmp.id,
            assigned_by: (req as any).user?.id,
            status: 'Active',
            remarks: 'Assigned during bulk import'
          }]);
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
      await supabaseAdmin.from('asset_import_errors').insert(errors);
    }

    // 4. Update batch status
    await supabaseAdmin
      .from('asset_import_batches')
      .update({
        successful_records: successful,
        failed_records: failed,
        status: failed === 0 ? 'Completed' : 'Completed with Errors'
      })
      .eq('id', batch.id);

    // 5. Audit Log (Removed asset_history insert as batch.id is not a valid asset UUID)
    // We would log to audit_logs if available

    res.json({ 
      status: 'success', 
      data: { batch_id: batch.id, successful, failed, errors } 
    });

  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
