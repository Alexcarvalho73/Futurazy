const db = require('../db');

async function inspectSE2020() {
  try {
    await db.initialize();
    
    // Buscar 10 registros quaisquer ativos no SE2020
    const sql = `
      SELECT * FROM (
        SELECT 
          E2_FILIAL,
          E2_NUM,
          E2_PREFIXO,
          E2_FORNECE,
          E2_LOJA,
          E2_NOMFOR,
          E2_TIPO,
          E2_VALOR,
          E2_SALDO,
          E2_TPGER,
          E2_HIST
        FROM PROTHEUS11.SE2020
        WHERE D_E_L_E_T_ = ' '
      ) WHERE ROWNUM <= 10
    `;
    
    const rows = await db.execute(sql);
    console.log('--- SE2020 DADOS (AMOSTRA) ---');
    rows.forEach(r => {
      console.log({
        E2_FILIAL: `[${r.E2_FILIAL}]`,
        E2_NUM: `[${r.E2_NUM}]`,
        E2_PREFIXO: `[${r.E2_PREFIXO}]`,
        E2_FORNECE: `[${r.E2_FORNECE}]`,
        E2_LOJA: `[${r.E2_LOJA}]`,
        E2_NOMFOR: `[${r.E2_NOMFOR}]`,
        E2_TIPO: `[${r.E2_TIPO}]`,
        E2_VALOR: r.E2_VALOR,
        E2_SALDO: r.E2_SALDO,
        E2_TPGER: `[${r.E2_TPGER}]`,
        E2_HIST: `[${r.E2_HIST}]`
      });
    });
    
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

inspectSE2020();
