const fs = require('fs');
let content = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

content = content.replace(/\(cell\) => \{/g, "(cell: any) => {");

fs.writeFileSync('src/app/admin/page.tsx', content);
console.log('Fixed cell types');
