const db = require('./db');

async function run() {
  await db.initialize();
  try {
    const q1 = `ALTER TABLE FECHAMENTO_RECEITA ADD FR_INTERCOMPANY NUMBER`;
    await db.execute(q1);
    console.log("Coluna FR_INTERCOMPANY criada com sucesso!");
  } catch (e) {
    if (e.message.includes('ORA-01430') || e.message.includes('column being added already exists')) {
      console.log("A coluna FR_INTERCOMPANY já existe na tabela.");
    } else {
      console.error("Erro ao tentar criar coluna:", e.message);
    }
  } finally {
    await db.close();
  }
}

run();
