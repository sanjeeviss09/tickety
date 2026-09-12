import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import WebSocket from 'ws';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket }
});

async function check() {
  const { data: users } = await supabase.auth.admin.listUsers();
  if (users?.users.length) {
    const userId = users.users[0].id;
    const { error } = await supabase.from('profiles').update({ employee_id: 'AXX09' }).eq('id', userId);
    console.log(error ? 'Error:' + error.message : 'Successfully set employee_id for user ' + userId);
  }
}
check();
