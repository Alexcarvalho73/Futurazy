const { Client } = require('ssh2');

const host = '192.168.180.34';
const port = 22;
const username = 'alexandre.carvalho';
const password = 'Agro@2026';

const cmd = 'powershell -Command "Get-ChildItem -Path C:\\Projetos\\QlikFuturazy -Force"';

const conn = new Client();

console.log('Lendo arquivo .env do servidor remoto...');

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', () => {
      conn.end();
    }).on('data', d => {
      console.log('Conteudo do .env em producao:');
      console.log(d.toString());
    }).stderr.on('data', d => console.error(d.toString()));
  });
}).on('error', (err) => {
  console.error('Erro de conexao:', err);
}).connect({ host, port, username, password });
