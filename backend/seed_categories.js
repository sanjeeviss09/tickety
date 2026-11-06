require('dotenv').config();

const url = process.env.SUPABASE_URL + '/rest/v1/asset_categories';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const categories = [
  { name: 'Laptops & Computers', description: 'Desktops, laptops, and workstations' },
  { name: 'Mobile Devices', description: 'Smartphones and tablets' },
  { name: 'Peripherals', description: 'Keyboards, mice, monitors, etc.' },
  { name: 'Networking Equipment', description: 'Routers, switches, access points' },
  { name: 'Software Licenses', description: 'Software subscriptions and keys' },
  { name: 'Printers & Scanners', description: 'Office printing equipment' },
  { name: 'Servers', description: 'Datacenter equipment' }
];

async function seed() {
  for (const cat of categories) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(cat)
    });
    if (!res.ok) {
      console.error('Error seeding category:', cat.name, await res.text());
    } else {
      console.log('Seeded:', cat.name);
    }
  }
  console.log('Done.');
}
seed();
