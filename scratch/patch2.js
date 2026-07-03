const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /const M = map\[key\];\s*const brl\s*=\s*Number\(r\.CUSTO_BRL \|\| 0\);\s*const ptax = Number\(r\.PTAX \|\| 0\);\s*M\.totalBrl \+= brl;\s*\/\/\s*Média ponderada.*?M\.porTipo\[tipo\]\.custoBrl \+= brl;/s,
  `const M = map[key];
  
      const brl  = Number(r.CUSTO_BRL || 0);
      const usd  = Number(r.CUSTO_USD || 0);
      const ptax = Number(r.PTAX || 0);
  
      M.totalBrl += brl;
      M.totalUsd = (M.totalUsd || 0) + usd;
      // Média ponderada de PTAX pelo custo BRL
      if (ptax > 0 && brl > 0) {
        M.ptaxSumPeso += brl;       // soma dos pesos
        M.ptaxPeso    += brl * ptax; // soma ponderada
      }
  
      if (!M.porTipo[tipo])  M.porTipo[tipo]  = { custoBrl: 0, custoUsd: 0 };
      M.porTipo[tipo].custoBrl += brl;
      M.porTipo[tipo].custoUsd += usd;`
);

code = code.replace(
  /map\[key\] = \{\s*empresa: emp, ano, mes,\s*totalBrl: 0, ptaxSumPeso: 0, ptaxPeso: 0, \/\/ para média ponderada/s,
  `map[key] = {
          empresa: emp, ano, mes,
          totalBrl: 0, totalUsd: 0, ptaxSumPeso: 0, ptaxPeso: 0, // para média ponderada`
);

fs.writeFileSync('server.js', code, 'utf8');
console.log('Patched agregarInsumosPorMes');
