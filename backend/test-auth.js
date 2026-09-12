const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { port: 9999 } // disable or whatever, wait, actually we can just pass custom fetch or ignore realtime.
});

async function test() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  console.log('Error:', error);
  console.log('Auth Users:', data?.users?.map(u => ({ id: u.id, email: u.email })));
}

test();
