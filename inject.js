const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

const entriesToInsert = JSON.parse(fs.readFileSync('parsed_entries.json', 'utf8'));

async function wipeAndInsert() {
  console.log("Wiping existing entries...");
  const { error: delError } = await supabase.from('entries').delete().neq('pass_serial', 'dummy');
  if (delError) {
    console.error("Error deleting:", delError);
    return;
  }
  
  console.log("Deleted existing entries. Inserting new records...");
  
  // Insert in chunks of 100
  const chunkSize = 100;
  for (let i = 0; i < entriesToInsert.length; i += chunkSize) {
    const chunk = entriesToInsert.slice(i, i + chunkSize);
    const { error: insError } = await supabase.from('entries').insert(chunk);
    if (insError) {
      console.error(`Error inserting chunk ${i}:`, insError);
      return;
    }
  }
  
  console.log("Successfully inserted all records.");
}

wipeAndInsert();
