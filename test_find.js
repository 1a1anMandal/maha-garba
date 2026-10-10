const preRegistered = require('./src/lib/preRegistered.json');

const passSerial = "924";
const entryType = "duo";
const name1 = "YUVRAJ SINGH KUSHWAHA";
const name2 = "PURNIMA MEENA";

try {
  const dupLocal = preRegistered.find(p => {
    if (!p.name_1) console.log("Missing name_1 for pass", p.pass_serial);
    return !(p.pass_serial === passSerial && p.entry_type === entryType) && 
    (p.name_1.toLowerCase() === name1.trim().toLowerCase() || 
     (p.name_2 && p.name_2.toLowerCase() === name1.trim().toLowerCase()) ||
     (name2 && p.name_1.toLowerCase() === name2.trim().toLowerCase()) ||
     (name2 && p.name_2 && p.name_2.toLowerCase() === name2.trim().toLowerCase())
    )
  });
  console.log("dupLocal:", dupLocal);
} catch (e) {
  console.error("Error:", e);
}
