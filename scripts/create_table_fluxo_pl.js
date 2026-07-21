/**
 * scripts/create_table_fluxo_pl.js
 * Cria a tabela DF_FLUXO_PL no Oracle para o mapeamento ProfitLoss do Fluxo de Caixa.
 * Execute: node scripts/create_table_fluxo_pl.js
 */
require('dotenv').config();
const db = require('../db');

async function run() {
  try {
    await db.initialize();
    console.log('Conectado ao Oracle. Criando tabela DF_FLUXO_PL...');

    // Criar tabela principal
    try {
      await db.execute(`
        CREATE TABLE DF_FLUXO_PL (
          FP_ID       NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          FP_TP_GER   VARCHAR2(10)  NOT NULL,
          FP_DESC     VARCHAR2(150),
          FP_CONTA_PL VARCHAR2(100) NOT NULL,
          FP_NIVEL    VARCHAR2(10)  NOT NULL,
          FP_ATIVO    CHAR(1) DEFAULT 'S' NOT NULL
        )
      `, [], { autoCommit: true });
      console.log('✅ Tabela DF_FLUXO_PL criada.');
    } catch (e) {
      if (e.message && e.message.includes('ORA-00955')) {
        console.log('ℹ️  Tabela DF_FLUXO_PL já existe. Pulando criação.');
      } else {
        throw e;
      }
    }

    // Criar índice único no TP_GER (trim)
    try {
      await db.execute(`
        CREATE UNIQUE INDEX UQ_DF_FLUXO_PL_TPGER ON DF_FLUXO_PL (TRIM(FP_TP_GER))
      `, [], { autoCommit: true });
      console.log('✅ Índice UQ_DF_FLUXO_PL_TPGER criado.');
    } catch (e) {
      if (e.message && (e.message.includes('ORA-00955') || e.message.includes('ORA-01408'))) {
        console.log('ℹ️  Índice já existe. Pulando.');
      } else {
        throw e;
      }
    }

    console.log('\n🎉 Estrutura do banco criada com sucesso!');
    console.log('   Próximo passo: node scripts/seed_fluxo_pl.js');
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

run();
