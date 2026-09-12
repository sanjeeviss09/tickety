const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkFKs() {
  const { data: p } = await supabaseAdmin.from('profiles').select('id').limit(1).single();
  if (p) {
    const { error: updateErr } = await supabaseAdmin.from('profiles').update({ id: '00000000-0000-0000-0000-000000000000' }).eq('id', p.id);
    console.log('Update Error:', updateErr);
  }
}
checkFKs();
