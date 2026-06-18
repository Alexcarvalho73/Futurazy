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
    
    # Vamos rodar a query inteira com TO_DATE e ver se falha
    $query = @"
        SELECT COUNT(*) FROM (
            SELECT 
              XM.XML_CHAVE,
              ROUND(SYSDATE - TO_DATE(COALESCE(TRIM(XM.XML_RECEB), XM.XML_EMISSA), 'YYYYMMDD')) as DIAS
            FROM PROTHEUS11.CONDORXML XM
            WHERE XM.D_E_L_E_T_ = ' '
              AND NOT EXISTS (
                  SELECT 1 FROM PROTHEUS11.SFT020 FT 
                  WHERE FT.D_E_L_E_T_ = ' ' 
                    AND FT.FT_CHVNFE = XM.XML_CHAVE 
                    AND FT.FT_TIPOMOV = 'E'
              )
        )
"@
    $cmd = New-Object System.Data.Odbc.OdbcCommand($query, $connection)
    $count = $cmd.ExecuteScalar()
    Write-Host "Sucesso! Total de registros calculados sem erro: $count" -ForegroundColor Green
    
    $connection.Close()
} catch {
    Write-Host "Erro detectado no TO_DATE: $_" -ForegroundColor Red
}
