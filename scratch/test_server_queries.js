const fs = require('fs');
const path = require('path');
const db = require('../db');

async function testServerQueries() {
  console.log('Lendo server.js...');
  const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

  // Extrair baseQuery
  const baseQueryMatch = serverCode.match(/const baseQuery = `([\s\S]+?)`;/);
  if (!baseQueryMatch) {
    throw new Error('Não foi possível encontrar baseQuery no server.js');
  }
  const baseQuery = baseQueryMatch[1];
  console.log('baseQuery extraída com sucesso.');

  // Simular binds e whereClause
  let whereClause = ' WHERE 1 = 1';
  const binds = {
    maxRow: 5,
    minRow: 0
  };

  // Extrair querySql
  const querySqlMatch = serverCode.match(/const querySql = `([\s\S]+?)`;/);
  if (!querySqlMatch) {
    throw new Error('Não foi possível encontrar querySql no server.js');
  }
  let querySql = querySqlMatch[1];
  console.log('querySql extraída com sucesso.');

  // Substituir as variáveis do template JavaScript
  querySql = querySql.replace(/\${baseQuery}/g, baseQuery);
  querySql = querySql.replace(/\${whereClause}/g, whereClause);

  console.log('Inicializando pool de conexões...');
  await db.initialize();

  try {
    console.log('Executando querySql extraída do server.js...');
    const rows = await db.execute(querySql, binds);
    console.log(`Sucesso! Retornados ${rows.length} registros.`);
    if (rows.length > 0) {
      console.log('Amostra da primeira linha:');
      console.log(JSON.stringify(rows[0], null, 2));
    }
  } catch (err) {
    console.error('Erro ao executar querySql:', err);
    process.exit(1);
  } finally {
    await db.close();
    console.log('Pool fechado.');
  }
}

testServerQueries().catch(err => {
  console.error(err);
  process.exit(1);
});
