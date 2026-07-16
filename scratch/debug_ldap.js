const { Client } = require('ldapts');

async function debugLDAP() {
  const url = 'ldap://srvad01.futurazy.local';
  
  // O BIND_DN que foi configurado: CN=serv_futurazy,OU=servidores,DC=futurazy,DC=local
  const bindDN = 'CN=serv_futurazy,OU=servidores,DC=futurazy,DC=local';
  const bindPassword = 'FutAccess#@2026';
  
  const baseDN = 'OU=servidores,DC=futurazy,DC=local';
  const usuario = 'alexandre.carvalho';
  
  console.log('Conectando ao LDAP...');
  const client = new Client({ url });
  
  try {
    console.log(`Fazendo bind com usuário de serviço: ${bindDN}...`);
    await client.bind(bindDN, bindPassword);
    console.log('✅ Bind do serviço realizado com sucesso!');
    
    const filter = `(sAMAccountName=${usuario})`;
    console.log(`Buscando usuário com filtro: ${filter} na base: ${baseDN}...`);
    
    const { searchEntries } = await client.search(baseDN, {
      scope: 'sub',
      filter: filter,
      attributes: ['dn', 'cn', 'displayName', 'memberOf', 'sAMAccountName']
    });
    
    console.log(`Busca concluída. Encontrado(s): ${searchEntries.length} registro(s)`);
    if (searchEntries.length > 0) {
      console.log('DN do usuário encontrado:', searchEntries[0].dn);
      console.log('Atributos retornados:', JSON.stringify(searchEntries[0], null, 2));
    } else {
      console.log('❌ Usuário não encontrado no contêiner ' + baseDN);
      
      // Tentar buscar na raiz para ver onde o usuário está localizado
      console.log('Tentando busca na raiz (DC=futurazy,DC=local)...');
      const rootSearch = await client.search('DC=futurazy,DC=local', {
        scope: 'sub',
        filter: filter,
        attributes: ['dn']
      });
      if (rootSearch.searchEntries.length > 0) {
        console.log('✅ Usuário encontrado na raiz! DN correto:', rootSearch.searchEntries[0].dn);
      } else {
        console.log('❌ Usuário também não foi encontrado na raiz!');
      }
    }
  } catch (err) {
    console.error('❌ Erro durante o debug do LDAP:', err);
  } finally {
    try { await client.unbind(); } catch(e) {}
  }
}

debugLDAP();
