const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'b:/tickety/backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  console.log('Auth Users:', data.users.map(u => ({ id: u.id, email: u.email })));
}

test();
