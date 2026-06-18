$ip = "192.168.180.34"

Write-Host "--- Testando Conectividade com o Servidor $ip ---"

# 1. Testar Ping
Write-Host "Realizando ping..."
$ping = Test-Connection -ComputerName $ip -Count 1 -Quiet
if ($ping) {
    Write-Host "Ping: Sucesso! Servidor está online." -ForegroundColor Green
} else {
    Write-Host "Ping: Falhou. O servidor não respondeu ao ping." -ForegroundColor Red
}

# 2. Testar Portas Comuns
$ports = @{
    "SMB/File Sharing (445)" = 445
    "WinRM HTTP (5985)" = 5985
    "WinRM HTTPS (5986)" = 5986
    "RDP (3389)" = 3389
    "SSH (22)" = 22
    "HTTP (80)" = 80
    "HTTPS (443)" = 443
}

Write-Host "`nTestando portas comuns..."
foreach ($portKey in $ports.Keys) {
    $port = $ports[$portKey]
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $asyncResult = $tcp.BeginConnect($ip, $port, $null, $null)
        $wait = $asyncResult.AsyncWaitHandle.WaitOne(1000) # 1 segundo timeout
        if ($wait -and $tcp.Connected) {
            Write-Host "Porta ${portKey}: ABERTA" -ForegroundColor Green
        } else {
            Write-Host "Porta ${portKey}: FECHADA" -ForegroundColor Gray
        }
        $tcp.Close()
    } catch {
        Write-Host "Porta ${portKey}: ERRO ($($_.Exception.Message))" -ForegroundColor Red
    }
}
