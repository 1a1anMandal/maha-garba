const fs = require('fs');

const duoLines = fs.readFileSync('duo_raw.tsv', 'utf-8').split('\n').map(l => l.trim()).filter(l => l);
const stagLines = fs.readFileSync('stag_raw.csv', 'utf-8').split('\n').map(l => l.trim()).filter(l => l);

const dateHeaders = ["29-Sep", "30-Sep", "01-Oct", "03-Oct", "05-Oct", "06-Oct", "07-Oct", "08-Oct", "09-Oct", "10-Oct"];
const dateMap = {
  "29-Sep": "2026-09-29",
  "30-Sep": "2026-09-30",
  "01-Oct": "2026-10-01",
  "03-Oct": "2026-10-03",
  "05-Oct": "2026-10-05",
  "06-Oct": "2026-10-06",
  "07-Oct": "2026-10-07",
  "08-Oct": "2026-10-08",
  "09-Oct": "2026-10-09",
  "10-Oct": "2026-10-10"
};

const entriesToInsert = [];
const preRegistered = [];

function parseDuo() {
  const headers = duoLines[0].split('\t');
  for (let i = 1; i < duoLines.length; i++) {
    const cols = duoLines[i].split('\t');
    let passNumber = cols[0]?.trim();
    if (!passNumber) continue;
    passNumber = passNumber.padStart(3, '0');
    
    let name1 = cols[1]?.trim() || "";
    let name2 = cols[2]?.trim() || "";
    
    if (name1 === "----" || name1 === "-----") name1 = "";
    if (name2 === "----" || name2 === "-----") name2 = "";

    preRegistered.push({
      pass_serial: passNumber,
      name_1: name1,
      name_2: name2 || null,
      entry_type: 'duo'
    });

    for (let j = 0; j < dateHeaders.length; j++) {
      const colIndex = 3 + j;
      if (cols[colIndex] && cols[colIndex].trim().toLowerCase() === 'present') {
        const dateStr = dateMap[dateHeaders[j]];
        
        // Random time between 15:00:00 and 16:00:00 (3 PM - 4 PM)
        const randomSeconds = Math.floor(Math.random() * 3600);
        const hours = 15;
        const minutes = Math.floor(randomSeconds / 60);
        const seconds = randomSeconds % 60;
        
        const timestamp = `${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}+05:30`;

        entriesToInsert.push({
          pass_serial: `${passNumber}_duo_${dateStr}`,
          name_1: name1,
          name_2: name2 || null,
          entry_type: 'duo',
          entry_date: dateStr,
          created_at: timestamp
        });
      }
    }
  }
}

function parseStag() {
  const headers = stagLines[0].split(',');
  for (let i = 1; i < stagLines.length; i++) {
    const cols = stagLines[i].split(',');
    let passNumber = cols[0]?.trim();
    if (!passNumber) continue;
    passNumber = passNumber.padStart(3, '0');
    
    let name1 = cols[1]?.trim() || "";
    if (name1 === "----" || name1 === "-----") name1 = "";

    preRegistered.push({
      pass_serial: passNumber,
      name_1: name1,
      name_2: null,
      entry_type: 'stag'
    });

    for (let j = 0; j < dateHeaders.length; j++) {
      const colIndex = 2 + j;
      if (cols[colIndex] && cols[colIndex].trim().toLowerCase() === 'present') {
        const dateStr = dateMap[dateHeaders[j]];
        
        const randomSeconds = Math.floor(Math.random() * 3600);
        const hours = 15;
        const minutes = Math.floor(randomSeconds / 60);
        const seconds = randomSeconds % 60;
        
        const timestamp = `${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}+05:30`;

        entriesToInsert.push({
          pass_serial: `${passNumber}_stag_${dateStr}`,
          name_1: name1,
          name_2: null,
          entry_type: 'stag',
          entry_date: dateStr,
          created_at: timestamp
        });
      }
    }
  }
}

parseDuo();
parseStag();

fs.writeFileSync('parsed_entries.json', JSON.stringify(entriesToInsert, null, 2));
fs.writeFileSync('src/lib/preRegistered.json', JSON.stringify(preRegistered, null, 2));

console.log(`Parsed ${entriesToInsert.length} attendance records.`);
console.log(`Updated preRegistered.json with ${preRegistered.length} passes.`);
