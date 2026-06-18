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
    
    # Vamos contar registros onde o formato da data é inválido (tamanho diferente de 8 ou não numérico)
    $query = @"
        SELECT COUNT(*) FROM PROTHEUS11.CONDORXML XM
        WHERE XM.D_E_L_E_T_ = ' '
          AND (
            TRIM(XM.XML_EMISSA) IS NULL 
            OR LENGTH(TRIM(XM.XML_EMISSA)) <> 8
            OR NOT REGEXP_LIKE(TRIM(XM.XML_EMISSA), '^[0-9]{8}$')
          )
"@
    $cmd = New-Object System.Data.Odbc.OdbcCommand($query, $connection)
    $c1 = $cmd.ExecuteScalar()
    Write-Host "Registros com XML_EMISSA inválido: $c1"
    
    # E para XML_RECEB?
    $cmd.CommandText = @"
        SELECT COUNT(*) FROM PROTHEUS11.CONDORXML XM
        WHERE XM.D_E_L_E_T_ = ' '
          AND TRIM(XM.XML_RECEB) IS NOT NULL
          AND (
            LENGTH(TRIM(XM.XML_RECEB)) <> 8
            OR NOT REGEXP_LIKE(TRIM(XM.XML_RECEB), '^[0-9]{8}$')
          )
"@
    $c2 = $cmd.ExecuteScalar()
    Write-Host "Registros com XML_RECEB inválido: $c2"

    $connection.Close()
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
