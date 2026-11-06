// Run assigner_role migration via backend REST API
// The backend is running at localhost:5000 and has admin DB access
// We'll add a temporary migration endpoint to the running backend

const fs = require('fs');
const path = require('path');

const sqlContent = fs.readFileSync(
  path.join(__dirname, 'supabase', 'migrations', '20261004000000_assigner_role.sql'),
  'utf8'
);

const dotenv = require(path.join(__dirname, 'backend', 'node_modules', 'dotenv'));
const config = dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('Key length:', SERVICE_KEY?.length);

// Try Supabase's pg endpoint directly (available for self-hosted, not cloud)
// For cloud, use the backend's /pg endpoint
async function main() {
  // Try a direct approach: POST to Supabase's internal pg endpoint
  // This works if there's a pg gateway available
  
  // Split and run individual statements
  const statements = sqlContent
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .map(s => s + ';');
  
  console.log(`\nSQL file has approximately ${statements.length} statements`);
  console.log('\nTo apply this migration:');
  console.log('1. Go to Supabase dashboard: https://supabase.com/dashboard/project/rgfydfcznmdnylwothct/sql/new');
  console.log('2. Paste the migration SQL and run it');
  console.log(`\nMigration file location: ${path.join(__dirname, 'supabase', 'migrations', '20261004000000_assigner_role.sql')}`);
  console.log('\nFirst 5 statements:');
  statements.slice(0, 5).forEach((s, i) => console.log(`${i+1}: ${s.slice(0, 80)}...`));
}

main().catch(console.error);
