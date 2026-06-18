const oracledb = require('oracledb');

// Ativar o modo Thick para suportar verificação de senha antiga do Oracle (NJS-116)
try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_24' });
  console.log('Oracledb inicializado em modo Thick (Instant Client local).');
} catch (err) {
  console.error('Erro ao inicializar o Thick Mode:', err);
}

// Configurações do Banco de Dados Oracle
const dbConfig = {
  user: 'SYS_READ',
  password: 'Hctm9pvy9#jpcta80y4',
  connectString: '192.168.180.30:1521/homprot',
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 1,
  poolTimeout: 60
};

let pool;

async function initialize() {
  try {
    pool = await oracledb.createPool(dbConfig);
    console.log('Pool de conexões com o Oracle inicializado com sucesso.');
  } catch (err) {
    console.error('Erro ao inicializar o Pool de conexões Oracle:', err);
    throw err;
  }
}

async function close() {
  try {
    if (pool) {
      await pool.close();
      console.log('Pool de conexões Oracle fechado.');
    }
  } catch (err) {
    console.error('Erro ao fechar o pool Oracle:', err);
  }
}

async function execute(sql, binds = [], opts = {}) {
  let conn;
  // Retornar os registros como Objetos com chaves correspondentes aos nomes das colunas
  opts.outFormat = oracledb.OUT_FORMAT_OBJECT;
  try {
    if (!pool) {
      throw new Error('O pool de conexões não está inicializado.');
    }
    conn = await pool.getConnection();
    const result = await conn.execute(sql, binds, opts);
    return result.rows;
  } catch (err) {
    console.error('Erro ao executar consulta SQL no Oracle:', err);
    throw err;
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Erro ao fechar a conexão individual:', err);
      }
    }
  }
}

module.exports = {
  initialize,
  close,
  execute
};
