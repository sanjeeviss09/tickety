global.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabaseAdmin.from('ticket_work_sessions').select('*').limit(1);
  if (error && error.message.includes('Could not find the table')) {
    console.log('TABLE DOES NOT EXIST OR NOT CACHED');
    
    // Check if the table actually exists in the database by querying pg_tables
    const { data: check, error: checkErr } = await supabaseAdmin.rpc('exec_sql', { sql: 'SELECT tablename FROM pg_tables WHERE tablename = \'ticket_work_sessions\'' });
    console.log('PG_TABLES check:', check, checkErr);
    
    // Try forcing cache reload
    const { data: d2, error: e2 } = await supabaseAdmin.rpc('exec_sql', { sql: 'NOTIFY pgrst, "reload schema";' });
    console.log('RELOAD CACHE:', d2, e2);
  } else {
    console.log('DATA:', data, 'ERROR:', error);
  }
}
test();
