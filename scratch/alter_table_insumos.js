/**
 * Script: verifica e ajusta a tabela FECHAMENTO_INSUMOS
 * - Verifica colunas existentes
 * - Adiciona FI_PTAX se não existir
 * - Remove FI_CUSTO_USD se existir
 */
const oracledb = require('oracledb');
try { oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_24' }); } catch(e) {}

const cfg = {
  user: 'SYS_READ',
  password: 'Hctm9pvy9#jpcta80y4',
  connectString: '192.168.180.30:1521/protheus'
};

async function run() {
  let conn;
  try {
    conn = await oracledb.getConnection(cfg);
    console.log('Conectado ao Oracle.\n');

    // 1. Verificar colunas existentes
    const colsResult = await conn.execute(
      `SELECT column_name FROM user_tab_columns WHERE table_name = 'FECHAMENTO_INSUMOS' ORDER BY column_id`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const colNames = colsResult.rows.map(r => r.COLUMN_NAME);
    console.log('Colunas existentes:', colNames.join(', '), '\n');

    // 2. Adicionar FI_PTAX se não existir
    if (!colNames.includes('FI_PTAX')) {
      await conn.execute(`ALTER TABLE FECHAMENTO_INSUMOS ADD FI_PTAX NUMBER(10,4) DEFAULT 0`);
      await conn.execute(`COMMENT ON COLUMN FECHAMENTO_INSUMOS.FI_PTAX IS 'PTAX medio ponderado do periodo'`);
      console.log('✔ Coluna FI_PTAX adicionada.');
    } else {
      console.log('⚠ FI_PTAX já existe — ignorado.');
    }

    // 3. Remover FI_CUSTO_USD se existir
    if (colNames.includes('FI_CUSTO_USD')) {
      await conn.execute(`ALTER TABLE FECHAMENTO_INSUMOS DROP COLUMN FI_CUSTO_USD`);
      console.log('✔ Coluna FI_CUSTO_USD removida.');
    } else {
      console.log('⚠ FI_CUSTO_USD não existe — nada a remover.');
    }

    // 4. Confirmar estrutura final
    const finalResult = await conn.execute(
      `SELECT column_name, data_type FROM user_tab_columns WHERE table_name = 'FECHAMENTO_INSUMOS' ORDER BY column_id`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log('\nEstrutura final da tabela FECHAMENTO_INSUMOS:');
    finalResult.rows.forEach(r => console.log(' ', r.COLUMN_NAME, '-', r.DATA_TYPE));

    await conn.commit();
    console.log('\n✅ Tabela ajustada com sucesso!');

  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.close();
    console.log('Conexão encerrada.');
  }
}

run();
