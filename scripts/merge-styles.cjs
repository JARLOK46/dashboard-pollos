const fs = require('node:fs');
const base = require('node:child_process').execFileSync('git', ['show', 'b6de44e:src/styles.css'], { encoding: 'utf8' });
const current = fs.readFileSync('src/styles.css', 'utf8');
const marker = '/* Interactive workflow additions */';
const additions = current.includes(marker) ? current.slice(current.indexOf(marker) + marker.length) : '';
fs.writeFileSync('src/styles.css', `${base}\n${marker}${additions}`);
