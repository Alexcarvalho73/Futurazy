const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /const t = initPorEmpresa\(\);\s*for \(const emp of \['028501', '028503'\]\) \{\s*const e = porEmpresa\[emp\];\s*t\.totalBrl \+= e\.totalBrl;\s*if \(e\.ptaxMedio > 0 && e\.totalBrl > 0\)/s,
  `const t = initPorEmpresa();
      for (const emp of ['028501', '028503']) {
        const e = porEmpresa[emp];
        t.totalBrl += e.totalBrl;
        t.totalUsd = (t.totalUsd || 0) + (e.totalUsd || 0);
        if (e.ptaxMedio > 0 && e.totalBrl > 0)`
);

fs.writeFileSync('server.js', code, 'utf8');
console.log('Patched TOTAL logic');
