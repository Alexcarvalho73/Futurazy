const db = require('../db');

async function migrate() {
  try {
    await db.initialize();
    console.log("Conectado ao banco de dados Oracle.");
    
    // Atualizar dados de '2526' para '2026'
    const result = await db.execute(
      `UPDATE PROJECAO_DRE SET PD_SAFRA = '2026' WHERE PD_SAFRA = '2526'`,
      {},
      { autoCommit: true }
    );
    
    console.log(`Migração concluída com sucesso. Registros atualizados: ${result.rowsAffected}`);
  } catch (err) {
    console.error("Erro durante a migração:", err);
  } finally {
    try { await db.close(); } catch(e) {}
    process.exit(0);
  }
}

migrate();
