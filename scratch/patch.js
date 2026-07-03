const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// 1. Patch fechadosMap loop (around line 1735)
code = code.replace(
  /const brl = Number\(f\.FI_CUSTO_TOTAL \|\| 0\);\s*const ptax = Number\(f\.FI_PTAX\s*\|\| 0\);\s*const tipo = \(f\.FI_TIPO_INSUMO \|\| 'TOTAL'\)\.toUpperCase\(\);\s*if \(tipo !== 'TOTAL'\) \{\s*M\.totalBrl \+= brl;\s*if \(\!M\.porTipo\[tipo\]\) M\.porTipo\[tipo\] = \{ custoBrl: 0 \};\s*M\.porTipo\[tipo\]\.custoBrl \+= brl;\s*\/\/ PTAX.*?TOTAL\.\s*if \(\!M\.subgrupos\[tipo\]\) M\.subgrupos\[tipo\] = \{\};\s*\} else \{\s*\/\/ Registro consolidado\s*M\.totalBrl = brl;\s*M\.ptaxMedio = ptax;\s*\}/s,
  `const brl = Number(f.FI_CUSTO_TOTAL || 0);
      const ptax = Number(f.FI_PTAX   || 0);
      const usd = ptax > 0 ? (brl / ptax) : 0;
      const tipo = (f.FI_TIPO_INSUMO || 'TOTAL').toUpperCase();

      if (tipo !== 'TOTAL') {
        M.totalBrl += brl;
        M.totalUsd = (M.totalUsd || 0) + usd;
        if (!M.porTipo[tipo]) M.porTipo[tipo] = { custoBrl: 0, custoUsd: 0 };
        M.porTipo[tipo].custoBrl += brl;
        M.porTipo[tipo].custoUsd += usd;
        if (!M.subgrupos[tipo]) M.subgrupos[tipo] = {};
      } else {
        M.totalBrl = brl;
        M.totalUsd = usd;
        M.ptaxMedio = ptax;
      }`
);

// 2. Patch agregarInsumosPorMes (around line 1640)
code = code.replace(
  /const brl\s*=\s*Number\(r\.CUSTO_BRL \|\| 0\);\s*const ptax = Number\(r\.PTAX \|\| 0\);\s*M\.totalBrl \+= brl;\s*if \(\!M\.porTipo\[tipo\]\) M\.porTipo\[tipo\] = \{ custoBrl: 0 \};\s*M\.porTipo\[tipo\]\.custoBrl \+= brl;\s*if \(ptax > 0 && brl > 0\) \{\s*M\.ptaxSumPeso \+= brl;\s*M\.ptaxPeso\s*\+= brl \* ptax;\s*\}/s,
  `const brl  = Number(r.CUSTO_BRL || 0);
      const usd  = Number(r.CUSTO_USD || 0);
      const ptax = Number(r.PTAX || 0);

      M.totalBrl += brl;
      M.totalUsd = (M.totalUsd || 0) + usd;
      if (!M.porTipo[tipo]) M.porTipo[tipo] = { custoBrl: 0, custoUsd: 0 };
      M.porTipo[tipo].custoBrl += brl;
      M.porTipo[tipo].custoUsd += usd;

      if (ptax > 0 && brl > 0) {
        M.ptaxSumPeso += brl;
        M.ptaxPeso    += brl * ptax;
      }`
);

// 3. Patch porEmpresa merge (around line 1807)
code = code.replace(
  /porEmpresa\[emp\] = \{\s*totalBrl: f\.totalBrl,\s*ptaxMedio: f\.ptaxMedio,\s*porTipo:\s*\{ \.\.\.f\.porTipo \},\s*subgrupos: \{ \.\.\.f\.subgrupos \},\s*status: 'fechado',\s*dtFechamento: f\.dtFechamento\s*\};/s,
  `porEmpresa[emp] = {
            totalBrl: f.totalBrl,
            totalUsd: f.totalUsd || 0,
            ptaxMedio: f.ptaxMedio,
            porTipo:  { ...f.porTipo },
            subgrupos: { ...f.subgrupos },
            status: 'fechado',
            dtFechamento: f.dtFechamento
          };`
);

// 4. Patch Merge porTipo loop (around line 1843)
code = code.replace(
  /\/\/ Merge porTipo\s*for \(const \[tipo, v\] of Object\.entries\(e\.porTipo \|\| \{\}\)\) \{\s*if \(\!t\.porTipo\[tipo\]\) t\.porTipo\[tipo\] = \{ custoBrl: 0 \};\s*t\.porTipo\[tipo\]\.custoBrl \+= v\.custoBrl \|\| 0;\s*\}/s,
  `// Merge porTipo
        for (const [tipo, v] of Object.entries(e.porTipo || {})) {
          if (!t.porTipo[tipo]) t.porTipo[tipo] = { custoBrl: 0, custoUsd: 0 };
          t.porTipo[tipo].custoBrl += v.custoBrl || 0;
          t.porTipo[tipo].custoUsd += v.custoUsd || 0;
        }`
);

fs.writeFileSync('server.js', code, 'utf8');
console.log('Patched server.js with regexes');
