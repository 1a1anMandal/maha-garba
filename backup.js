const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function backup() {
  const { data, error } = await supabase.from('entries').select('*');
  if (error) {
    console.error("Error fetching data:", error);
    return;
  }
  fs.writeFileSync('entries_backup.json', JSON.stringify(data, null, 2));
  console.log(`Backed up ${data.length} records to entries_backup.json`);
}
backup();
