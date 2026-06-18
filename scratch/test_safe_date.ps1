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
    
    # Vamos rodar a query com o CASE WHEN REGEXP_LIKE seguro para todas as 61,719 linhas de CONDORXML
    $query = @"
        SELECT COUNT(*) FROM (
            SELECT 
              XM.XML_CHAVE,
              CASE 
                WHEN REGEXP_LIKE(TRIM(COALESCE(TRIM(XM.XML_RECEB), XM.XML_EMISSA)), '^[0-9]{8}$') 
                THEN ROUND(SYSDATE - TO_DATE(TRIM(COALESCE(TRIM(XM.XML_RECEB), XM.XML_EMISSA)), 'YYYYMMDD'))
                ELSE NULL 
              END as DIAS
            FROM PROTHEUS11.CONDORXML XM
            WHERE XM.D_E_L_E_T_ = ' '
        )
"@
    $cmd = New-Object System.Data.Odbc.OdbcCommand($query, $connection)
    $count = $cmd.ExecuteScalar()
    Write-Host "Sucesso! Total de registros calculados com segurança: $count" -ForegroundColor Green
    
    $connection.Close()
} catch {
    Write-Host "Erro detectado no TO_DATE seguro: $_" -ForegroundColor Red
}
