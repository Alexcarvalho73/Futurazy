const db = require('../db');

async function main() {
  await db.initialize();
  try {
    const rows = await db.execute(`
      SELECT DISTINCT FT_FILIAL, LENGTH(FT_FILIAL) as LEN_FILIAL
      FROM PROTHEUS11.SFT020
      WHERE ROWNUM <= 10
    `, []);
    console.log('Distinct FT_FILIAL in SFT020:', rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.close();
  }
}

main();
