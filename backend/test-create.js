async function test() {
  const { createClient } = require('@supabase/supabase-js');
  require('dotenv').config();
  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  const res = await supabaseAdmin.auth.admin.createUser({
    email: 'test_brand_new_12345@deskpulse.internal',
    password: 'password123',
    email_confirm: true,
  });
  console.log('Error:', res.error);
  if (res.data) console.log('User:', res.data.user?.id);
}
test();
