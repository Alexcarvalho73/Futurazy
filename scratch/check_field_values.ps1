$env:TNS_ADMIN = "C:\oracle\instantclient_19_24\network\admin"
if ($env:PATH -notlike "*C:\oracle\instantclient_19_24*") {
    $env:PATH = "C:\oracle\instantclient_19_24;" + $env:PATH
}

$user = "SYS_READ"
$pass = "Hctm9pvy9#jpcta80y4"
$service = "homprot"

$connString = "Driver={Oracle in instantclient_19_24};Dbq=192.168.180.30:1521/$service;Uid=$user;Pwd=$pass;"
$connection = New-Object System.Data.Odbc.OdbcConnection($connString)

try {
    $connection.Open()
    
    # 1. Distinct XML_TIPODC
    $cmd = New-Object System.Data.Odbc.OdbcCommand("SELECT TRIM(XML_TIPODC) as VAL, COUNT(*) as QTD FROM PROTHEUS11.CONDORXML GROUP BY TRIM(XML_TIPODC)", $connection)
    $reader = $cmd.ExecuteReader()
    Write-Host "--- Distinct XML_TIPODC ---"
    while ($reader.Read()) {
        Write-Host "Value: '$($reader['VAL'])' -> $($reader['QTD'])"
    }
    $reader.Close()

    # 2. Distinct XML_CTEFOB
    $cmd.CommandText = "SELECT TRIM(XML_CTEFOB) as VAL, COUNT(*) as QTD FROM PROTHEUS11.CONDORXML GROUP BY TRIM(XML_CTEFOB)"
    $reader = $cmd.ExecuteReader()
    Write-Host "--- Distinct XML_CTEFOB ---"
    while ($reader.Read()) {
        Write-Host "Value: '$($reader['VAL'])' -> $($reader['QTD'])"
    }
    $reader.Close()

    $connection.Close()
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
