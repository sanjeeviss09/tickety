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
  warranty_start_date: z.string().optional().nullable(),
  warranty_end_date: z.string().optional().nullable(),
  amc_start_date: z.string().optional().nullable(),
  amc_end_date: z.string().optional().nullable(),
  warranty_provider: z.string().optional().nullable(),
  warranty_contact_info: z.string().optional().nullable(),
  port_number: z.string().optional(),
});

export function parseWarrantyDates(warrantyStr?: string | null, purchaseDateStr?: string | null) {
  if (!warrantyStr) return null;
  const startDate = purchaseDateStr ? new Date(purchaseDateStr) : new Date();
  if (isNaN(startDate.getTime())) return null;

  const trimmed = warrantyStr.trim().toLowerCase();
  
  // Try direct date string
  const directDate = new Date(warrantyStr);
  if (!isNaN(directDate.getTime()) && directDate.getFullYear() > 2000 && /\d{4}/.test(warrantyStr)) {
    return {
      warranty_start_date: startDate.toISOString().split('T')[0],
      warranty_end_date: directDate.toISOString().split('T')[0]
    };
  }

  // Match years (e.g. "5years", "5 years", "3 yr", "1 year")
  const matchYears = trimmed.match(/^(\d+)\s*(?:year|yr|y)s?$/);
  if (matchYears) {
    const years = parseInt(matchYears[1], 10);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + years);
    return {
      warranty_start_date: startDate.toISOString().split('T')[0],
      warranty_end_date: endDate.toISOString().split('T')[0]
    };
  }

  // Match months (e.g. "24 months", "6 mo")
  const matchMonths = trimmed.match(/^(\d+)\s*(?:month|mo|m)s?$/);
  if (matchMonths) {
    const months = parseInt(matchMonths[1], 10);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);
    return {
      warranty_start_date: startDate.toISOString().split('T')[0],
      warranty_end_date: endDate.toISOString().split('T')[0]
    };
  }

  return {
    warranty_start_date: startDate.toISOString().split('T')[0],
    warranty_end_date: null
  };
}

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
    const { 
      assigned_to, 
      warranty_start_date, 
      warranty_end_date, 
      amc_start_date, 
      amc_end_date, 
      warranty_provider, 
      warranty_contact_info, 
      ...assetData 
    } = validatedData;

    // Fetch the raising user's profile
    const { data: creatorProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, employee_id, role:roles(name), unit:units(name), department:departments(name), location')
      .eq('id', userId)
      .single();

    let finalAssignee = assigned_to || null;
    let assignmentRemarks = 'Assigned during creation';

    // 1. If assigned to an employee:
    // Location, business unit, and department will be the same as the assigned employee
    if (finalAssignee) {
      const { data: empProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, employee_id, unit:units(name), department:departments(name), location')
        .eq('id', finalAssignee)
        .single();

      if (empProfile) {
        const empUnit: any = (empProfile as any).unit;
        const empDept: any = (empProfile as any).department;
        const unitName = Array.isArray(empUnit) ? empUnit[0]?.name : empUnit?.name;
        const deptName = Array.isArray(empDept) ? empDept[0]?.name : empDept?.name;
        if (unitName) assetData.unit = unitName;
        if (deptName) assetData.department = deptName;
        if (empProfile.location) assetData.location = empProfile.location;
      }
      assetData.status = 'Assigned';
    } else {
      // 2. If status is Available or unassigned:
      // Location/business unit defaults to the creator's unit and it will be automatically assigned to the Unit Technician who is raising
      const cUnit: any = (creatorProfile as any)?.unit;
      const cDept: any = (creatorProfile as any)?.department;
      const cUnitName = Array.isArray(cUnit) ? cUnit[0]?.name : cUnit?.name;
      const cDeptName = Array.isArray(cDept) ? cDept[0]?.name : cDept?.name;

      if (!assetData.unit && cUnitName) {
        assetData.unit = cUnitName;
      }
      if (!assetData.department && cDeptName) {
        assetData.department = cDeptName;
      }
      if (!assetData.location && creatorProfile?.location) {
        assetData.location = creatorProfile.location;
      }

      const creatorRole: any = (creatorProfile as any)?.role;
      const creatorRoleName = Array.isArray(creatorRole) ? creatorRole[0]?.name : creatorRole?.name;
      if (creatorRoleName === 'Technician' && creatorProfile) {
        finalAssignee = creatorProfile.id;
        assignmentRemarks = 'Auto-assigned to Unit Technician who raised the asset (Available)';
      } else {
        // If creator is Admin, check if there's a technician in this unit
        if (assetData.unit) {
          const { data: unitTech } = await supabaseAdmin
            .from('profiles')
            .select('id, role:roles!inner(name), unit:units!inner(name)')
            .eq('roles.name', 'Technician')
            .ilike('units.name', assetData.unit)
            .limit(1)
            .maybeSingle();
            
          if (unitTech) {
            finalAssignee = unitTech.id;
            assignmentRemarks = 'Auto-assigned to Unit Technician (Available)';
          }
        }
        if (!finalAssignee) {
          finalAssignee = creatorProfile?.id || userId;
          assignmentRemarks = 'Auto-assigned to creator (Available)';
        }
      }

      if (!assetData.status) {
        assetData.status = 'Available';
      }
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

    // Create assignment if finalAssignee is present
    if (finalAssignee) {
      await supabaseAdmin.from('asset_assignments').insert([{
        asset_id: asset.id,
        assigned_to: finalAssignee,
        assigned_by: userId,
        status: 'Active',
        remarks: assignmentRemarks
      }]);
    }

    // Warranty & AMC Tracking
    let finalWarrantyStart = warranty_start_date || assetData.purchase_date || null;
    let finalWarrantyEnd = warranty_end_date || null;

    if (!finalWarrantyEnd && assetData.warranty) {
      const parsed = parseWarrantyDates(assetData.warranty, finalWarrantyStart);
      if (parsed?.warranty_end_date) {
        finalWarrantyEnd = parsed.warranty_end_date;
      }
      if (!finalWarrantyStart && parsed?.warranty_start_date) {
        finalWarrantyStart = parsed.warranty_start_date;
      }
    }

    const finalProvider = warranty_provider || assetData.vendor || null;
    const finalContact = warranty_contact_info || null;

    if (finalWarrantyStart || finalWarrantyEnd || amc_start_date || amc_end_date || finalProvider || finalContact) {
      await supabaseAdmin.from('asset_warranty').upsert({
        asset_id: asset.id,
        warranty_start_date: finalWarrantyStart,
        warranty_end_date: finalWarrantyEnd,
        amc_start_date: amc_start_date || null,
        amc_end_date: amc_end_date || null,
        provider: finalProvider,
        contact_info: finalContact
      }, { onConflict: 'asset_id' });
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
        category:asset_categories (id, name),
        asset_categories (id, name),
        warranty_details:asset_warranty (*),
        assignments:asset_assignments (
          id, assigned_to, is_default, status, assigned_at, remarks,
          assigned_user:profiles!asset_assignments_assigned_to_fkey(id, full_name, employee_id, role:roles(name))
        )
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
    
    // For Employee or when assigned_to filter is used, filter out simulated empty joins
    let filteredData = Array.isArray(data) ? data : [];
    if (role === 'Employee') {
      filteredData = filteredData.filter((a: any) => a.assignments && a.assignments.some((ass: any) => ass.assigned_to === userId && ass.status === 'Active'));
    } else if (req.query.assigned_to) {
      filteredData = filteredData.filter((a: any) => a.assignments && a.assignments.some((ass: any) => ass.assigned_to === req.query.assigned_to && ass.status === 'Active'));
    }

    // Map properties for UI convenience
    filteredData.forEach((a: any) => {
      const activeAssignment = a.assignments?.find((ass: any) => ass.status === 'Active') || a.assignments?.[0];
      a.assigned_employee = activeAssignment?.assigned_user || null;
      a.category = a.category || a.asset_categories;
      const wObj = Array.isArray(a.warranty_details) ? a.warranty_details[0] : (a.warranty_details || null);
      if (wObj) {
        a.warranty = wObj;
      }
    });

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
        warranty_details:asset_warranty (*),
        maintenance:asset_maintenance (*),
        assignments:asset_assignments (*, assigned_user:profiles!asset_assignments_assigned_to_fkey(id, full_name, employee_id, role:roles(name)), assigned_by_user:profiles!asset_assignments_assigned_by_fkey(full_name)),
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

    // Normalize warranty object
    const wRecord = Array.isArray(data.warranty_details) ? data.warranty_details[0] : (data.warranty_details || null);
    data.warranty = wRecord || null;

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

    let updatePayload: any = { status: 'Assigned' };

    // Fetch the assigned employee profile to synchronize unit, department, location
    if (assigned_to) {
      const { data: empProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, unit:units(name), department:departments(name), location')
        .eq('id', assigned_to)
        .single();

      if (empProfile) {
        const empUnit: any = (empProfile as any).unit;
        const empDept: any = (empProfile as any).department;
        const unitName = Array.isArray(empUnit) ? empUnit[0]?.name : empUnit?.name;
        const deptName = Array.isArray(empDept) ? empDept[0]?.name : empDept?.name;
        if (unitName) updatePayload.unit = unitName;
        if (deptName) updatePayload.department = deptName;
        if (empProfile.location) updatePayload.location = empProfile.location;
      }
    }

    // Create new assignment
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('asset_assignments')
      .insert([{
        asset_id: id,
        assigned_to,
        assigned_by: userId,
        remarks: remarks || 'Asset assigned to employee',
        status: 'Active'
      }])
      .select()
      .single();

    if (assignmentError) throw assignmentError;

    // Update asset status and sync location/business unit
    await supabaseAdmin
      .from('assets')
      .update(updatePayload)
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

export const updateAssetWarranty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;

    if (role === 'Employee') return res.status(403).json({ status: 'error', message: 'Forbidden' });

    const { 
      warranty_start_date, 
      warranty_end_date, 
      amc_start_date, 
      amc_end_date, 
      provider, 
      contact_info 
    } = req.body;

    const { data: warranty, error } = await supabaseAdmin
      .from('asset_warranty')
      .upsert({
        asset_id: id,
        warranty_start_date: warranty_start_date || null,
        warranty_end_date: warranty_end_date || null,
        amc_start_date: amc_start_date || null,
        amc_end_date: amc_end_date || null,
        provider: provider || null,
        contact_info: contact_info || null
      }, { onConflict: 'asset_id' })
      .select()
      .single();

    if (error) throw error;

    // Record history
    await supabaseAdmin.from('asset_history').insert([{
      asset_id: id,
      action: 'Updated',
      performed_by: userId,
      remarks: 'Warranty & AMC information updated'
    }]);

    res.json({ status: 'success', data: warranty });
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

        // Create assignment record
        if (insertedAsset) {
          if (matchedEmp) {
            await supabaseAdmin.from('asset_assignments').insert([{
              asset_id: insertedAsset.id,
              assigned_to: matchedEmp.id,
              assigned_by: (req as any).user?.id,
              status: 'Active',
              remarks: 'Assigned during bulk import'
            }]);
          } else if (finalStatus === 'Available') {
            await supabaseAdmin.from('asset_assignments').insert([{
              asset_id: insertedAsset.id,
              assigned_to: (req as any).user?.id,
              assigned_by: (req as any).user?.id,
              status: 'Active',
              remarks: 'Auto-assigned to Unit Technician (Available)'
            }]);
          }

          // Track warranty if provided in record
          const wText = record.warranty || record.warranty_expiry_date || record.warranty_end_date;
          if (wText || record.warranty_start_date) {
            let wStart = record.warranty_start_date || record.purchase_date || null;
            let wEnd = record.warranty_end_date || record.warranty_expiry_date || null;
            if (!wEnd && wText) {
              const parsed = parseWarrantyDates(String(wText), wStart);
              if (parsed?.warranty_end_date) wEnd = parsed.warranty_end_date;
              if (!wStart && parsed?.warranty_start_date) wStart = parsed.warranty_start_date;
            }
            if (wStart || wEnd) {
              await supabaseAdmin.from('asset_warranty').upsert({
                asset_id: insertedAsset.id,
                warranty_start_date: wStart,
                warranty_end_date: wEnd,
                provider: record.vendor || record.warranty_provider || null,
                contact_info: record.warranty_contact_info || null
              }, { onConflict: 'asset_id' });
            }
          }
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
