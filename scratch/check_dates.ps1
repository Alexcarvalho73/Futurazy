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
    
    # Vamos pegar alguns registros onde XML_DTRVLD ou XML_DTAGEN ou XML_DTENTG não sejam vazios
    $query = "SELECT XML_EMISSA, XML_RECEB, XML_DTRVLD, XML_DTAGEN, XML_DTENTG FROM PROTHEUS11.CONDORXML WHERE D_E_L_E_T_ = ' ' AND (XML_DTRVLD IS NOT NULL OR XML_DTAGEN IS NOT NULL) AND ROWNUM <= 5"
    $cmd = New-Object System.Data.Odbc.OdbcCommand($query, $connection)
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        Write-Host "EMISSA:$($reader['XML_EMISSA']) RECEB:$($reader['XML_RECEB']) DTRVLD:$($reader['XML_DTRVLD']) DTAGEN:$($reader['XML_DTAGEN']) DTENTG:$($reader['XML_DTENTG'])"
    }
    $reader.Close()
    $connection.Close()
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
