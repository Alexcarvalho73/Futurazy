/**
 * scripts/seed_fluxo_pl.js
 * Popula a tabela DF_FLUXO_PL com os dados do arquivo scratch/Depara.csv.
 * Execute: node scripts/seed_fluxo_pl.js
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('../db');

// Caminho do CSV
const CSV_PATH = path.join(__dirname, '..', 'scratch', 'Depara.csv');

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const rows = [];

  // Pular cabeçalho (linha 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(';');
    const tpGer   = (parts[0] || '').trim();
    const desc    = (parts[1] || '').trim();
    const contaPL = (parts[2] || '').trim();
    const nivel   = (parts[3] || '').trim();

    // Pular linhas sem dados válidos
    if (!tpGer || !contaPL || !nivel) continue;

    rows.push({ tpGer, desc, contaPL, nivel });
  }

  return rows;
}

async function run() {
  try {
    await db.initialize();
    console.log('Conectado ao Oracle.');

    const rows = parseCSV(CSV_PATH);
    console.log(`📋 ${rows.length} registros encontrados no CSV.`);

    // Limpar tabela antes de inserir
    await db.execute(`DELETE FROM DF_FLUXO_PL`, [], { autoCommit: true });
    console.log('🗑️  Tabela DF_FLUXO_PL limpa.');

    // Inserir cada registro
    let inserted = 0;
    for (const row of rows) {
      try {
        await db.execute(
          `INSERT INTO DF_FLUXO_PL (FP_TP_GER, FP_DESC, FP_CONTA_PL, FP_NIVEL, FP_ATIVO)
           VALUES (:tpGer, :descr, :contaPL, :nivel, 'S')`,
          { tpGer: row.tpGer, descr: row.desc, contaPL: row.contaPL, nivel: row.nivel },
          { autoCommit: true }
        );
        inserted++;
        console.log(`  ✅ [${row.nivel}] ${row.tpGer.padEnd(6)} → ${row.contaPL}`);
      } catch (e) {
        console.error(`  ❌ Erro ao inserir ${row.tpGer}: ${e.message}`);
      }
    }

    console.log(`\n🎉 Seed concluído: ${inserted}/${rows.length} registros inseridos.`);

    // Verificar resultado
    const result = await db.execute(
      `SELECT FP_NIVEL, FP_CONTA_PL, COUNT(*) AS QTD
       FROM DF_FLUXO_PL GROUP BY FP_NIVEL, FP_CONTA_PL ORDER BY FP_NIVEL`
    );
    console.log('\n📊 Resumo por Conta P&L:');
    result.forEach(r => console.log(`   [${r.FP_NIVEL}] ${r.FP_CONTA_PL}: ${r.QTD} tipos`));

  } catch (err) {
    console.error('❌ Erro fatal:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

run();
