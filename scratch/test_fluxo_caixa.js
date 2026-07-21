/**
 * scratch/test_fluxo_caixa.js
 * Testa as rotas do Fluxo de Caixa localmente.
 */
require('dotenv').config();
const db = require('../db');

async function run() {
  try {
    await db.initialize();
    console.log('✅ Conectado ao Oracle.\n');

    // 1. Verificar tabela DF_FLUXO_PL
    console.log('=== 1. Tabela DF_FLUXO_PL ===');
    const plRows = await db.execute(
      `SELECT FP_NIVEL, FP_CONTA_PL, COUNT(*) AS QTD FROM DF_FLUXO_PL GROUP BY FP_NIVEL, FP_CONTA_PL ORDER BY FP_NIVEL`
    );
    plRows.forEach(r => console.log(`  [${r.FP_NIVEL}] ${r.FP_CONTA_PL}: ${r.QTD} tipos`));

    // 2. Testar view AV_FLUXODECAIXAFTZ (amostra)
    console.log('\n=== 2. View AV_FLUXODECAIXAFTZ (10 registros) ===');
    try {
      const viewRows = await db.execute(
        `SELECT * FROM PROTHEUS11.AV_FLUXODECAIXAFTZ WHERE ROWNUM <= 5`
      );
      if (viewRows.length === 0) {
        console.log('  ⚠️  Nenhum registro encontrado na view. Verificar se a view existe e tem dados.');
      } else {
        console.log(`  ✅ View retornou ${viewRows.length} registros.`);
        console.log('  Colunas:', Object.keys(viewRows[0]).join(', '));
        viewRows.slice(0,2).forEach((r,i) => console.log(`  Registro ${i+1}:`, JSON.stringify(r)));
      }
    } catch(e) {
      console.error('  ❌ Erro ao consultar view:', e.message);
    }

    // 3. Testar SE5020 (rendimentos M1)
    console.log('\n=== 3. SE5020 — Rendimentos Aplicação (M1) ===');
    try {
      const se5Rows = await db.execute(
        `SELECT COUNT(*) AS QTD FROM PROTHEUS11.SE5020
         WHERE E5_MOEDA = 'M1' AND E5_SITUACA <> 'C' AND D_E_L_E_T_ = ' '
           AND substr(E5_DTDISPO,1,6) BETWEEN '202601' AND '202612'`
      );
      console.log(`  ✅ ${se5Rows[0].QTD} registros SE5020 M1 em 2026.`);
    } catch(e) {
      console.error('  ❌ Erro SE5020:', e.message);
    }

    // 4. Testar SE8020 (saldo inicial) — E8_DTSALAT é VARCHAR YYYYMMDD
    console.log('\n=== 4. SE8020 — Saldo Inicial ===');
    try {
      const se8Rows = await db.execute(
        `SELECT NVL(SUM(SE8.E8_SALATUA), 0) AS SALDO
         FROM PROTHEUS11.SE8020 SE8
         WHERE SE8.E8_DTSALAT = (
           SELECT MAX(E8I.E8_DTSALAT) FROM PROTHEUS11.SE8020 E8I
           WHERE E8I.E8_DTSALAT < '20260901'
             AND E8I.E8_DTSALAT <> '        '
             AND E8I.D_E_L_E_T_ = ' '
         )
         AND SE8.D_E_L_E_T_ = ' '`
      );
      console.log(`  ✅ Saldo antes de set/26: R$ ${Number(se8Rows[0].SALDO || 0).toFixed(2)}`);
    } catch(e) {
      console.error('  ❌ Erro SE8020:', e.message);
    }

    // 5. Testar JOIN view + DF_FLUXO_PL usando colunas reais
    console.log('\n=== 5. JOIN view + DF_FLUXO_PL ===');
    try {
      const joinRows = await db.execute(
        `SELECT fv.TPGER,
                TO_CHAR(fv.VENCIMENTO,'YYYYMM') AS ANO_MES,
                pl.FP_CONTA_PL, pl.FP_NIVEL,
                COUNT(*) AS QTD
         FROM PROTHEUS11.AV_FLUXODECAIXAFTZ fv
         LEFT JOIN DF_FLUXO_PL pl ON TRIM(pl.FP_TP_GER) = TRIM(fv.TPGER)
         WHERE TO_CHAR(fv.VENCIMENTO,'YYYYMM') BETWEEN '202609' AND '202612'
           AND NVL(TRIM(fv.TPGER), 'X') <> 'NFC'
         GROUP BY fv.TPGER, TO_CHAR(fv.VENCIMENTO,'YYYYMM'), pl.FP_CONTA_PL, pl.FP_NIVEL
         ORDER BY pl.FP_NIVEL, TO_CHAR(fv.VENCIMENTO,'YYYYMM')
         FETCH FIRST 15 ROWS ONLY`
      );
      if (joinRows.length === 0) {
        console.log('  ⚠️  JOIN retornou 0 registros. Verificar período e dados da view.');
      } else {
        console.log(`  ✅ ${joinRows.length} combinações encontradas.`);
        joinRows.forEach(r => console.log(`    [${r.FP_NIVEL || '??'}] ${r.FP_CONTA_PL || 'SEM PL'} / ${r.TPGER} / ${r.ANO_MES}: ${r.QTD} registros`));
      }
    } catch(e) {
      console.error('  ❌ Erro JOIN:', e.message);
    }

    console.log('\n✅ Teste concluído!');
  } catch(err) {
    console.error('❌ Erro fatal:', err.message);
  } finally {
    await db.close();
  }
}

run();
