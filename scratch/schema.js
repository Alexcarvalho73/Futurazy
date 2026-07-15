const oracledb = require('oracledb');
(async () => {
  let conn = await oracledb.getConnection({
    user: 'protheus11',
    password: 'protheus11',
    connectString: 'localhost/XEPDB1'
  });
  const t = ['FECHAMENTO_RECEITA', 'FECHAMENTO_INSUMOS', 'FECHAMENTO_PECUARIA', 'FECHAMENTO_FINANCEIRO'];
  for (let x of t) {
    let r = await conn.execute(`SELECT column_name FROM all_tab_columns WHERE table_name = '${x}'`);
    console.log(x, r.rows.map(a => a[0]).join(','));
  }
  await conn.close();
})();
