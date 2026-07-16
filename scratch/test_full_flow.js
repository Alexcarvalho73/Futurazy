const { Client } = require('ldapts');

async function testFullFlow() {
  const url = 'ldap://srvad01.futurazy.local';
  const bindDN = 'CN=serv_futurazy,OU=servidores,DC=futurazy,DC=local';
  const bindPassword = 'FutAccess#@2026';
  const baseDN = 'DC=futurazy,DC=local';
  const usuario = 'alexandre.carvalho';
  const senha = 'Agro@2026';
  
  const client = new Client({ url });
  
  try {
    console.log('1. Conectando e fazendo bind com service account...');
    await client.bind(bindDN, bindPassword);
    
    console.log(`2. Procurando por ${usuario} em ${baseDN}...`);
    const { searchEntries } = await client.search(baseDN, {
      scope: 'sub',
      filter: `(sAMAccountName=${usuario})`,
      attributes: ['dn', 'cn', 'displayName', 'memberOf']
    });
    
    console.log('Resultados da busca:', searchEntries.length);
    if (searchEntries.length === 0) {
      console.log('Usuário não encontrado.');
      return;
    }
    
    const userDN = searchEntries[0].dn;
    console.log('DN do usuário encontrado:', userDN);
    
    console.log('3. Tentando autenticar (bind) o usuário final...');
    // Realiza novo bind na mesma conexão
    await client.bind(userDN, senha);
    console.log('✅ LOGIN FINAL COM SUCESSO!');
  } catch (err) {
    console.error('❌ Erro no fluxo:', err);
  } finally {
    try { await client.unbind(); } catch(e) {}
  }
}

testFullFlow();
