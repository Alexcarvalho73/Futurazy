const { Client } = require('ssh2');

const host = '192.168.180.34';
const port = 22;
const username = 'alexandre.carvalho';
const password = 'Agro@2026';

const psScript = `
$workDir = "C:\\Projetos\\QlikFuturazy"
Set-Location -Path $workDir

Write-Host "=== SERVER.LOG ==="
if (Test-Path "server.log") {
    Get-Content "server.log"
} else {
    Write-Host "server.log nao encontrado."
}

Write-Host "\n=== SERVER.ERR.LOG ==="
if (Test-Path "server.err.log") {
    Get-Content "server.err.log"
} else {
    Write-Host "server.err.log nao encontrado."
}
`;

const buffer = Buffer.from(psScript, 'utf16le');
const encodedCommand = buffer.toString('base64');
const cmd = `powershell -EncodedCommand ${encodedCommand}`;

const conn = new Client();

console.log('Conectando ao servidor remoto para ler logs...');

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', () => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect({
  host,
  port,
  username,
  password
});
