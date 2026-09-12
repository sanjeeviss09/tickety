const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'b:/tickety/backend/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkFKs() {
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql: "SELECT * FROM information_schema.key_column_usage WHERE referenced_table_name = 'profiles';" });
  if (error) console.log('RPC failed. Trying query instead...');
  
  // Just try to update a profile ID directly
  const { data: p } = await supabaseAdmin.from('profiles').select('id').limit(1).single();
  if (p) {
    const { error: updateErr } = await supabaseAdmin.from('profiles').update({ id: '00000000-0000-0000-0000-000000000000' }).eq('id', p.id);
    console.log('Update Error:', updateErr);
    // revert
    await supabaseAdmin.from('profiles').update({ id: p.id }).eq('id', '00000000-0000-0000-0000-000000000000');
  }
}
checkFKs();
