const fs = require('fs');
let code = fs.readFileSync('public/app_receita.js', 'utf8');

// 1. sumRows
code = code.replace(
  "acc.totalUsd   += Number(r.TOTAL_USD    || 0);\n    acc.sacas      += Number(r.SACAS        || 0);",
  "acc.totalUsd   += Number(r.TOTAL_USD    || 0);\n    if (r.TIPOFECHA === 'Intercompany') {\n      const val = state.moeda === 'USD' ? Number(r.TOTAL_USD || 0) : Number(r.TOTAL || 0);\n      acc.intercompany += Math.abs(val);\n    }\n    acc.sacas      += Number(r.SACAS        || 0);"
);
code = code.replace(
  "facs:0, fethab:0, funrural:0 });",
  "facs:0, fethab:0, funrural:0, intercompany:0 });"
);

// 2. buildRow
code = code.replace(
  '<td class="text-right" style="font-weight:${level<=1?\'600\':\'400\'}">${fmtMoeda(sums.total)}</td>\n      <td class="text-right" style="color:#f59e0b;font-weight:600;">${dolarText}</td>',
  '<td class="text-right" style="font-weight:${level<=1?\'600\':\'400\'}">${fmtMoeda(sums.total)}</td>\n      <td class="text-right" style="font-weight:${level<=1?\'600\':\'400\'}">${fmtMoeda(sums.intercompany)}</td>\n      <td class="text-right" style="color:#f59e0b;font-weight:600;">${dolarText}</td>'
);

// 3. atualizarLabelsMoeda
code = code.replace(
  "if (thFun)   thFun.textContent   = `FUNRURAL (${prefix})`;",
  "if (thFun)   thFun.textContent   = `FUNRURAL (${prefix})`;\n  const thInt = document.getElementById('th-intercompany-cubo');\n  if (thInt) thInt.textContent = `Intercompany (${prefix})`;"
);

// 4. renderTotalizerRow
code = code.replace(
  "let rec, fac, fet, fun, gta;\n        if (state.moeda === 'USD') {\n          rec = getValorUsd(m, seg, 'receitaUsd') || 0;\n          fac = getValorUsd(m, seg, 'vlrFacsUsd') || 0;\n          fet = getValorUsd(m, seg, 'fethabUsd') || 0;\n          fun = getValorUsd(m, seg, 'funruralUsd') || 0;\n          gta = getValorUsd(m, seg, 'gtaUsd') || 0;\n        } else {\n          rec = getValor(m, seg, 'receita') || 0;\n          fac = getValor(m, seg, 'vlrFacs') || 0;\n          fet = getValor(m, seg, 'fethab') || 0;\n          fun = getValor(m, seg, 'funrural') || 0;\n          gta = getValor(m, seg, 'gta') || 0;\n        }\n\n        const net = rec - fac - fet - fun - gta;",
  "let rec, fac, fet, fun, gta, inc;\n        if (state.moeda === 'USD') {\n          rec = getValorUsd(m, seg, 'receitaUsd') || 0;\n          fac = getValorUsd(m, seg, 'vlrFacsUsd') || 0;\n          fet = getValorUsd(m, seg, 'fethabUsd') || 0;\n          fun = getValorUsd(m, seg, 'funruralUsd') || 0;\n          gta = getValorUsd(m, seg, 'gtaUsd') || 0;\n          inc = getValorUsd(m, seg, 'intercompanyUsd') || 0;\n        } else {\n          rec = getValor(m, seg, 'receita') || 0;\n          fac = getValor(m, seg, 'vlrFacs') || 0;\n          fet = getValor(m, seg, 'fethab') || 0;\n          fun = getValor(m, seg, 'funrural') || 0;\n          gta = getValor(m, seg, 'gta') || 0;\n          inc = getValor(m, seg, 'intercompany') || 0;\n        }\n\n        const net = rec + inc - fac - fet - fun - gta;"
);

// 5. row assembly
code = code.replace(
  "rows += renderMetricaRow('💰 Receita de Vendas', 'receita', 'receitaUsd', fmtMoeda);\n  rows += renderMetricaRow('(-) FACS', 'vlrFacs', 'vlrFacsUsd', fmtMoeda, true);",
  "rows += renderMetricaRow('💰 Receita de Vendas', 'receita', 'receitaUsd', fmtMoeda);\n  rows += renderMetricaRow('(+) Intercompany', 'intercompany', 'intercompanyUsd', fmtMoeda);\n  rows += renderMetricaRow('(-) FACS', 'vlrFacs', 'vlrFacsUsd', fmtMoeda, true);"
);

// 6. openEditForm
code = code.replace(
  "document.getElementById('edit-fr-gta').value = item.FR_GTA || 0;\n  document.getElementById('edit-fr-fethab').value = item.FR_FETHAB || 0;",
  "document.getElementById('edit-fr-gta').value = item.FR_GTA || 0;\n  document.getElementById('edit-fr-intercompany').value = item.FR_INTERCOMPANY || 0;\n  document.getElementById('edit-fr-fethab').value = item.FR_FETHAB || 0;"
);

// 7. saveFechamentoForm
code = code.replace(
  "gta: Number(document.getElementById('edit-fr-gta').value || 0),\n    fethab: Number(document.getElementById('edit-fr-fethab').value || 0),",
  "gta: Number(document.getElementById('edit-fr-gta').value || 0),\n    intercompany: Number(document.getElementById('edit-fr-intercompany').value || 0),\n    fethab: Number(document.getElementById('edit-fr-fethab').value || 0),"
);

fs.writeFileSync('public/app_receita.js', code);
console.log('Done!');
