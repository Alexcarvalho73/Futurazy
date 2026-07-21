const { Client } = require('ssh2');

const host = '192.168.180.34';
const port = 22;
const username = 'alexandre.carvalho';
const password = 'Agro@2026';

const psScript = `
$workDir = "C:\\Projetos\\QlikFuturazy"
Set-Location -Path $workDir

Write-Host "=== STATUS DA TAREFA ANTES ==="
schtasks /query /tn "QlikFuturazyServer" /fo LIST

Write-Host "\n=== INICIANDO TAREFA AGENDADA ==="
schtasks /run /tn "QlikFuturazyServer"

Write-Host "Aguardando 5 segundos..."
Start-Sleep -Seconds 5

Write-Host "\n=== STATUS DA TAREFA DEPOIS ==="
schtasks /query /tn "QlikFuturazyServer" /fo LIST

Write-Host "\n=== PROCESSOS NODE RODANDO ==="
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Path | Format-Table

Write-Host "\n=== PORTAS ESCUTANDO 443 OU 80 ==="
Get-NetTCPConnection -LocalPort 443,80 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess, State | Format-Table

Write-Host "\n=== ULTIMAS LINHAS DE SERVER.LOG ==="
if (Test-Path "server.log") {
    Get-Content "server.log" -Tail 20
}

Write-Host "\n=== ULTIMAS LINHAS DE SERVER.ERR.LOG ==="
if (Test-Path "server.err.log") {
    Get-Content "server.err.log" -Tail 20
}
`;

const buffer = Buffer.from(psScript, 'utf16le');
const encodedCommand = buffer.toString('base64');
const cmd = `powershell -EncodedCommand ${encodedCommand}`;

const conn = new Client();

console.log('Conectando ao servidor remoto para iniciar o servidor...');

conn.on('ready', () => {
  console.log('Conectado via SSH. Executando...');
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Erro ao executar o comando:', err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log(`\nSessao SSH encerrada (codigo de saida: ${code}).`);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).on('error', (err) => {
  if (err.message !== 'read ECONNRESET') {
    console.error('Erro de conexao SSH:', err.message);
  } else {
    console.log('Conexao SSH fechada pelo host remoto (ECONNRESET).');
  }
}).connect({
  host,
  port,
  username,
  password,
  readyTimeout: 20000
});
