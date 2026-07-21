const { Client } = require('ssh2');

const host = '192.168.180.34';
const port = 22;
const username = 'alexandre.carvalho';
const password = 'Agro@2026';

const envContent = `# Configurações de Ambiente - FuturazyBI
SESSION_SECRET=futurazy_bi_super_secret_2026_mude_isso_em_producao
LDAP_ENABLED=true
LDAP_URL=ldap://srvad01.futurazy.local
LDAP_PORT=389
LDAP_BASE_DN=DC=futurazy,DC=local
LDAP_USER_BASE_DN=DC=futurazy,DC=local
LDAP_BIND_DN=CN=serv_futurazy,OU=servidores,DC=futurazy,DC=local
LDAP_BIND_PASSWORD="FutAccess#@2026"
LDAP_GROUP_PREFIX=DF_
ADMIN_USER=admin
ADMIN_PASS=123123
PORT=3000
`;

// Usando PowerShell para criar o arquivo .env no servidor
const base64Content = Buffer.from(envContent, 'utf-8').toString('base64');
const cmd = `powershell -Command "[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${base64Content}')) | Out-File -FilePath C:\\Projetos\\QlikFuturazy\\.env -Encoding utf8"`;

const conn = new Client();

console.log('Gravando arquivo .env no servidor remoto...');

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', () => {
      console.log('.env gravado com sucesso.');
      
      // Reiniciar o serviço de producao para aplicar o .env
      console.log('Reiniciando servidor de producao...');
      conn.exec('powershell -Command "Stop-Process -Name node -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1; schtasks /run /tn \\"QlikFuturazyServer\\""', (err2, stream2) => {
        stream2.on('close', () => {
          console.log('Servidor reiniciado.');
          conn.end();
        });
      });
    }).on('data', d => console.log(d.toString()));
  });
}).on('error', err => console.error(err)).connect({ host, port, username, password });
