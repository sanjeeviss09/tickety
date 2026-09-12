import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  const connectionString = 'postgresql://postgres:this%20the%20pass@db.rgfydfcznmdnylwothct.supabase.co:5432/postgres';
  console.log('Connecting to database...');
  
  const sql = postgres(connectionString, { ssl: 'require' });
  
  try {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260811180207_unit_based_routing.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await sql.unsafe(migrationSql);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sql.end();
  }
}

runMigration();
