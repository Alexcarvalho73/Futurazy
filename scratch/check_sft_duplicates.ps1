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
    
    # Vamos contar os registros de CONDORXML
    $cmd = New-Object System.Data.Odbc.OdbcCommand("SELECT COUNT(*) FROM PROTHEUS11.CONDORXML XM WHERE XM.D_E_L_E_T_ = ' '", $connection)
    $c1 = $cmd.ExecuteScalar()
    Write-Host "Total CONDORXML: $c1"
    
    # Vamos contar se fizermos LEFT JOIN direto
    $cmd.CommandText = @"
        SELECT COUNT(*) 
        FROM PROTHEUS11.CONDORXML XM
        LEFT JOIN PROTHEUS11.SFT020 FT ON FT.D_E_L_E_T_ = ' ' AND FT.FT_CHVNFE = XM.XML_CHAVE AND FT.FT_TIPOMOV = 'E'
        WHERE XM.D_E_L_E_T_ = ' '
"@
    $c2 = $cmd.ExecuteScalar()
    Write-Host "Total com LEFT JOIN direto: $c2"
    
    # E se usarmos um subquery para pegar apenas um registro por chave ou um EXISTS/NOT EXISTS?
    # Vamos contar com subquery EXISTS
    $cmd.CommandText = @"
        SELECT COUNT(*)
        FROM PROTHEUS11.CONDORXML XM
        WHERE XM.D_E_L_E_T_ = ' '
          AND EXISTS (
              SELECT 1 FROM PROTHEUS11.SFT020 FT 
              WHERE FT.D_E_L_E_T_ = ' ' 
                AND FT.FT_CHVNFE = XM.XML_CHAVE 
                AND FT.FT_TIPOMOV = 'E'
          )
"@
    $c3 = $cmd.ExecuteScalar()
    Write-Host "Total Classificados (EXISTS): $c3"

    $cmd.CommandText = @"
        SELECT COUNT(*)
        FROM PROTHEUS11.CONDORXML XM
        WHERE XM.D_E_L_E_T_ = ' '
          AND NOT EXISTS (
              SELECT 1 FROM PROTHEUS11.SFT020 FT 
              WHERE FT.D_E_L_E_T_ = ' ' 
                AND FT.FT_CHVNFE = XM.XML_CHAVE 
                AND FT.FT_TIPOMOV = 'E'
          )
"@
    $c4 = $cmd.ExecuteScalar()
    Write-Host "Total Pendentes (NOT EXISTS): $c4"
    
    Write-Host "Soma EXISTS + NOT EXISTS: $($c3 + $c4)"

    $connection.Close()
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
