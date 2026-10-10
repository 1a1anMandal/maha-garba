const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function test() {
  const name1 = "YUVRAJ SINGH KUSHWAHA";
  const name2 = "PURNIMA MEENA";
  const orQuery = `name_1.ilike."${name1.trim()}",name_2.ilike."${name1.trim()}"` + (name2 ? `,name_1.ilike."${name2.trim()}",name_2.ilike."${name2.trim()}"` : "");
  console.log("Query:", orQuery);
  const { data, error } = await supabase.from('entries').select('pass_serial, entry_type').or(orQuery).limit(10);
  console.log("Data:", data);
  console.log("Error:", error);
}
test();
