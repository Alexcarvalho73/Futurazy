const { Client } = require('ssh2');

const host = '192.168.180.34';
const port = 22;
const username = 'alexandre.carvalho';
const password = 'Agro@2026';

// Script PowerShell para fazer git pull no servidor e reiniciar o serviço agendado
const psScript = `
# Ajustar o PATH para a sessão
$env:PATH = "C:\\Program Files\\nodejs;C:\\Program Files\\Git\\cmd;" + $env:PATH

$workDir = "C:\\Projetos\\QlikFuturazy"
Set-Location -Path $workDir

Write-Host "Salvando arquivos modificados no servidor..."
Start-Process -FilePath "git.exe" -ArgumentList "stash" -PassThru -Wait -NoNewWindow

Write-Host "Puxando alteracoes do Git..."
$proc = Start-Process -FilePath "git.exe" -ArgumentList "pull" -PassThru -Wait -NoNewWindow
Write-Host "Git pull finalizado com codigo de saida: $($proc.ExitCode)"

Write-Host "Restaurando arquivos modificados..."
Start-Process -FilePath "git.exe" -ArgumentList "stash", "pop" -PassThru -Wait -NoNewWindow

if ($proc.ExitCode -eq 0) {
    Write-Host "Instalando novas dependencias (npm install)..."
    Start-Process -FilePath "npm.cmd" -ArgumentList "install", "--production" -PassThru -Wait -NoNewWindow

    Write-Host "Parando o processo Node antigo..."
    Stop-Process -Name node -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    
    # Reiniciar o servidor usando a tarefa agendada
    Write-Host "Reiniciando servidor usando a tarefa agendada..."
    schtasks /run /tn "QlikFuturazyServer"
    Start-Sleep -Seconds 3
    
    # Verificar status da tarefa
    $taskStatus = schtasks /query /tn "QlikFuturazyServer"
    Write-Host "Status da tarefa agendada:"
    Write-Host $taskStatus
    
    $logPath = "C:\\Projetos\\QlikFuturazy\\server.log"
    $errPath = "C:\\Projetos\\QlikFuturazy\\server.err.log"
    
    if (Test-Path $logPath) {
        Write-Host "\\nConteudo do log de inicializacao:"
        Get-Content $logPath -Tail 10
    }
    if (Test-Path $errPath) {
        $errContent = Get-Content $errPath
        if ($errContent) {
            Write-Host "\\nErros no log:"
            Write-Host $errContent
        }
    }
} else {
    Write-Host "Falha ao puxar alteracoes do Git. Abortando reinicio."
}
`;

const buffer = Buffer.from(psScript, 'utf16le');
const encodedCommand = buffer.toString('base64');
const cmd = `powershell -EncodedCommand ${encodedCommand}`;

const conn = new Client();

console.log('Conectando ao servidor remoto para atualizar o projeto e reiniciar o servidor...');

conn.on('ready', () => {
  console.log('Conectado via SSH. Executando git pull e restart...');
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Erro ao executar o comando:', err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log(`\nSessão de deploy encerrada (código de saída: ${code}).`);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).on('error', (err) => {
  if (err.message !== 'read ECONNRESET') {
    console.error('Erro de conexão SSH:', err.message);
  }
}).connect({
  host,
  port,
  username,
  password,
  readyTimeout: 20000
});
