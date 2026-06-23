const { Client } = require('ssh2');

const host = '192.168.180.34';
const port = 22;
const username = 'alexandre.carvalho';
const password = 'Agro@2026';

const psScript = `
$workDir = "C:\\Projetos\\QlikFuturazy"
Set-Location -Path $workDir

Write-Host "=== CONTEUDO DE START.BAT ==="
Get-Content "start.bat"

Write-Host "\n=== PROCESSO ESCUTANDO NA PORTA 80 ==="
$conn = Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    $procId = $conn.OwningProcess
    Write-Host "Process ID: $procId"
    Get-Process -Id $procId | Format-List *
    Get-CimInstance Win32_Process -Filter "ProcessId = $procId" | Select-Object CommandLine | Format-List
} else {
    Write-Host "Nenhum processo escutando na porta 80."
}

Write-Host "\n=== PROCESSOS NODE RUNNING ==="
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Path, CommandLine | Format-List
`;

const buffer = Buffer.from(psScript, 'utf16le');
const encodedCommand = buffer.toString('base64');
const cmd = `powershell -EncodedCommand ${encodedCommand}`;

const conn = new Client();

console.log('Conectando ao servidor remoto 192.168.180.34 para inspecao...');

conn.on('ready', () => {
  console.log('Conectado via SSH. Executando inspecao...');
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Erro ao executar o comando:', err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log(`\nSessao de inspecao encerrada (codigo de saida: ${code}).`);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).on('error', (err) => {
  console.error('Erro de conexao SSH:', err.message);
}).connect({
  host,
  port,
  username,
  password,
  readyTimeout: 20000
});
