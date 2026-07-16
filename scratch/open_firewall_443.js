const { Client } = require('ssh2');

const host = '192.168.180.34';
const port = 22;
const username = 'alexandre.carvalho';
const password = 'Agro@2026';

const cmd = 'netsh advfirewall firewall add rule name="QlikFuturazy HTTPS 443" dir=in action=allow protocol=TCP localport=443';

const conn = new Client();

console.log('Abrindo porta 443 no firewall do servidor remoto...');

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', () => {
      console.log('Comando de firewall 443 executado.');
      conn.end();
    }).on('data', d => console.log(d.toString()));
  });
}).connect({ host, port, username, password });
