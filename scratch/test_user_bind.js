const { Client } = require('ldapts');

async function testUserBind() {
  const url = 'ldap://srvad01.futurazy.local';
  
  // O DN que descobrimos no script anterior
  const userDN = 'CN=Alexandre Carvalho,OU=TI,OU=CUIABA,OU=MATO GROSSO,DC=FUTURAZY,DC=LOCAL';
  const userPassword = 'Agro@2026';
  
  console.log('Conectando ao LDAP...');
  const client = new Client({ url });
  
  try {
    console.log(`Tentando fazer bind direto com o DN do usuário: ${userDN}...`);
    await client.bind(userDN, userPassword);
    console.log('✅ BIND DO USUÁRIO LOGADO COM SUCESSO! Senha correta.');
  } catch (err) {
    console.error('❌ Erro no bind do usuário:', err);
  } finally {
    try { await client.unbind(); } catch(e) {}
  }
}

testUserBind();
