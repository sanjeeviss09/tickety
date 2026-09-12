
import { supabaseAdmin } from './src/config/supabase';

async function run() {
  console.log('Creating admin user...');
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: 'axx09@deskpulse.internal',
    password: 'AXX09',
    email_confirm: true,
    user_metadata: {
      full_name: 'System Admin',
      employee_id: 'AXX09'
    }
  });

  if (authError) {
    console.error('Create error:', authError);
    return;
  }
  
  console.log('User created:', authUser.user.id);
  
  // Now ensure profile has Admin role and has_set_password = true
  const { data: roles } = await supabaseAdmin.from('roles').select('id').eq('name', 'Admin').single();
  
  if (roles) {
    const { error: profileError } = await supabaseAdmin.from('profiles').update({
      role_id: roles.id,
      has_set_password: true
    }).eq('id', authUser.user.id);
    
    console.log('Profile update:', profileError || 'Success');
  } else {
    console.log('Admin role not found, maybe migrations not run?');
  }
}
run();

