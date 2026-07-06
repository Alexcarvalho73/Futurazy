const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// 1. In isTodasClosed block
code = code.replace(
  'pec.vlrFacs = tTot.vlrFacs * ratioPec;',
  'pec.vlrFacs = tTot.vlrFacs * ratioPec;\n              pec.intercompany = tTot.intercompany * ratioPec;\n              pec.intercompanyUsd = tTot.intercompanyUsd * ratioPec;'
);
code = code.replace(
  'agr.vlrFacs = tTot.vlrFacs * ratioAgr;',
  'agr.vlrFacs = tTot.vlrFacs * ratioAgr;\n              agr.intercompany = tTot.intercompany * ratioAgr;\n              agr.intercompanyUsd = tTot.intercompanyUsd * ratioAgr;'
);
code = code.replace(
  'out.vlrFacs = tTot.vlrFacs * ratioOut;',
  'out.vlrFacs = tTot.vlrFacs * ratioOut;\n              out.intercompany = tTot.intercompany * ratioOut;\n              out.intercompanyUsd = tTot.intercompanyUsd * ratioOut;'
);

// 2. In hasFilial1 && hasFilial2 block
code = code.replace(
  'st.receita = s1.receita + s2.receita;',
  'st.receita = s1.receita + s2.receita;\n          st.intercompany = (s1.intercompany || 0) + (s2.intercompany || 0);'
);
code = code.replace(
  'st.receitaUsd = s1.receitaUsd + s2.receitaUsd;',
  'st.receitaUsd = s1.receitaUsd + s2.receitaUsd;\n          st.intercompanyUsd = (s1.intercompanyUsd || 0) + (s2.intercompanyUsd || 0);'
);

// 3. In else block for dynamic aggregation
code = code.replace(
  'st.receita = s1.receita + s2.receita;', // This matches twice because it's identical, so replace both or target carefully
  'st.receita = s1.receita + s2.receita;\n          st.intercompany = (s1.intercompany || 0) + (s2.intercompany || 0);'
);
// However replace only does first occurrence. So I will use replaceAll for both.
code = code.replace(
  /st\.receita = s1\.receita \+ s2\.receita;/g,
  'st.receita = s1.receita + s2.receita;\n          st.intercompany = (s1.intercompany || 0) + (s2.intercompany || 0);'
);
code = code.replace(
  /st\.receitaUsd = s1\.receitaUsd \+ s2\.receitaUsd;/g,
  'st.receitaUsd = s1.receitaUsd + s2.receitaUsd;\n          st.intercompanyUsd = (s1.intercompanyUsd || 0) + (s2.intercompanyUsd || 0);'
);

fs.writeFileSync('server.js', code);
console.log('Done!');
