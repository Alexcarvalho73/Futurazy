const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../public/app_financeiro.js');
let content = fs.readFileSync(filePath, 'utf8');

const newRenderCube = `function renderCube(data) {
  const body = document.getElementById('cube-body');
  if (!body) return;

  // Hierarquia: CC_GRUPO -> CC_SUBGRUPO -> TIPO_GERENCIAL -> Detalhes
  const tree = {}; 

  let grandBrl = 0, grandUsd = 0;

  for (const r of data) {
    const grupo = r.CC_GRUPO || '(sem grupo)';
    const subgrp = r.CC_SUBGRUPO || '(sem subgrupo)';
    const tpGer = r.TIPO_GERENCIAL || 'Sem Classificação';

    if (!tree[grupo]) tree[grupo] = { _brl: 0, _usd: 0, subgrupos: {} };
    const G = tree[grupo];

    if (!G.subgrupos[subgrp]) G.subgrupos[subgrp] = { _brl: 0, _usd: 0, tpGers: {} };
    const SG = G.subgrupos[subgrp];
    
    if (!SG.tpGers[tpGer]) SG.tpGers[tpGer] = { _brl: 0, _usd: 0, rows: [] };
    const TG = SG.tpGers[tpGer];

    const brl  = Number(r.VLR_BRL || 0);
    const usd  = Number(r.VLR_USD || 0);

    G._brl += brl; G._usd += usd;
    SG._brl += brl; SG._usd += usd;
    TG._brl += brl; TG._usd += usd;
    TG.rows.push(r);
    grandBrl += brl; grandUsd += usd;
  }

  const rowsHtml = [];
  let uid = 0;

  const gruposOrdem = Object.keys(tree).sort((a, b) => a.localeCompare(b));

  for (const grupo of gruposOrdem) {
    const G = tree[grupo];
    const gId = \`g_\${uid++}\`;
    
    rowsHtml.push(\`
      <tr class="lvl-0" data-id="\${gId}">
        <td>
          <span class="toggle-btn" onclick="toggleRows('\${gId}')">▶</span>
          <strong>\${escHtml(grupo)}</strong>
        </td>
        <td>—</td>
        <td>—</td>
        <td class="text-right">\${fmtMoedaUsd(G._usd)}</td>
        <td class="text-right">\${fmtMoedaBrl(G._brl)}</td>
        <td class="text-right">—</td>
        <td class="text-right">—</td>
      </tr>
    \`);

    const subgruposOrdem = Object.keys(G.subgrupos).sort((a, b) => a.localeCompare(b));
    let sgUid = 0;
    
    for (const subgrp of subgruposOrdem) {
      const SG = G.subgrupos[subgrp];
      const sgId = \`sg_\${gId}_\${sgUid++}\`;

      rowsHtml.push(\`
        <tr class="lvl-1 row-hidden" data-parent="\${gId}" data-id="\${sgId}">
          <td><span class="toggle-btn" onclick="toggleRows('\${sgId}')">▶</span>\${escHtml(subgrp)}</td>
          <td>—</td>
          <td>—</td>
          <td class="text-right">\${fmtMoedaUsd(SG._usd)}</td>
          <td class="text-right">\${fmtMoedaBrl(SG._brl)}</td>
          <td class="text-right">—</td>
          <td class="text-right">—</td>
        </tr>
      \`);

      const tgsOrdem = Object.keys(SG.tpGers).sort((a, b) => a.localeCompare(b));
      let tgUid = 0;
      for (const tpGer of tgsOrdem) {
        const TG = SG.tpGers[tpGer];
        const tgId = \`tg_\${sgId}_\${tgUid++}\`;

        rowsHtml.push(\`
          <tr class="lvl-2 row-hidden" data-parent="\${sgId}" data-id="\${tgId}">
            <td><span class="toggle-btn" onclick="toggleRows('\${tgId}')">▶</span>\${escHtml(tpGer)}</td>
            <td>—</td>
            <td>—</td>
            <td class="text-right">\${fmtMoedaUsd(TG._usd)}</td>
            <td class="text-right">\${fmtMoedaBrl(TG._brl)}</td>
            <td class="text-right">—</td>
            <td class="text-right">—</td>
          </tr>
        \`);
        
        for (const detail of TG.rows) {
          const d = detail.DATA_PAGAMENTO ? new Date(detail.DATA_PAGAMENTO).toLocaleDateString('pt-BR') : '—';
          const titulo = \`\${detail.PREFIXO || ''} \${detail.NUMERO || ''} \${detail.PARCELA || ''}\`.trim();
          rowsHtml.push(\`
            <tr class="lvl-3 row-hidden" data-parent="\${tgId}">
              <td>\${escHtml(titulo || 'Sem Título')} - \${escHtml(detail.NATUREZA)} - \${escHtml(detail.HISTORICO_BAIXA)}</td>
              <td>\${d}</td>
              <td>\${escHtml(detail.BENEF || detail.CLI_FOR)}</td>
              <td class="text-right">\${fmtMoedaUsd(detail.VLR_USD)}</td>
              <td class="text-right">\${fmtMoedaBrl(detail.VLR_BRL)}</td>
              <td class="text-right">\${escHtml(detail.NEGOCIO)}</td>
              <td class="text-right"><span class="badge" style="background:#eee;color:#333;font-size:10px;">\${detail.FILIAL}</span></td>
            </tr>
          \`);
        }
      }
    }
  }

  body.innerHTML = rowsHtml.join('');

  const tfoot = document.querySelector('#cube-table tfoot');
  if (tfoot) {
    tfoot.innerHTML = \`
      <tr>
        <th colspan="3">Total Geral</th>
        <th class="text-right">\${fmtMoedaUsd(grandUsd)}</th>
        <th class="text-right">\${fmtMoedaBrl(grandBrl)}</th>
        <th colspan="2"></th>
      </tr>
    \`;
  }
}`;

const idxStart = content.indexOf('function renderCube(data) {');
if (idxStart !== -1) {
  content = content.substring(0, idxStart) + newRenderCube;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('renderCube atualizado com sucesso.');
} else {
  console.log('Não foi possível encontrar a função renderCube.');
}
