const preRegistered = require('./src/lib/preRegistered.json');
const passSerial = "924";
const entryType = "duo";
const name1 = "YUVRAJ SINGH KUSHWAHA";
const name2 = "PURNIMA MEENA";

try {
  const dupLocal = preRegistered.find(p => 
    !(String(p.pass_serial) === passSerial && String(p.entry_type) === entryType) && 
    (String(p.name_1).toLowerCase() === name1.trim().toLowerCase() || 
     (p.name_2 && String(p.name_2).toLowerCase() === name1.trim().toLowerCase()) ||
     (name2 && String(p.name_1).toLowerCase() === name2.trim().toLowerCase()) ||
     (name2 && p.name_2 && String(p.name_2).toLowerCase() === name2.trim().toLowerCase())
    )
  );
  console.log("dupLocal:", dupLocal);
} catch(e) {
  console.error(e);
}
