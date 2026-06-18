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
    
    $query = @"
        SELECT TRIM(XM.XML_OK) as XML_OK, COUNT(*) as QTD
        FROM PROTHEUS11.CONDORXML XM
        LEFT JOIN PROTHEUS11.SFT020 FT ON FT.D_E_L_E_T_ = ' ' AND FT.FT_CHVNFE = XM.XML_CHAVE AND FT.FT_TIPOMOV = 'E'
        WHERE XM.D_E_L_E_T_ = ' ' AND FT.R_E_C_N_O_ IS NULL
        GROUP BY TRIM(XM.XML_OK)
"@
    $cmd = New-Object System.Data.Odbc.OdbcCommand($query, $connection)
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        Write-Host "XML_OK: '$($reader['XML_OK'])' -> $($reader['QTD'])"
    }
    $reader.Close()
    $connection.Close()
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
