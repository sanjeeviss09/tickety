const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'b:/tickety/backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('employee_id', 'TECH-244');
  console.log('Profile:', data, 'Error:', error);
}

test();
