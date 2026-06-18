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
        SELECT * FROM (
            SELECT 
              TRIM(XM.XML_NUMNF) as XML_NUMNF,
              TRIM(XM.XML_NOMEMT) as XML_NOMEMT,
              XM.XML_EMISSA,
              XM.XML_RECEB,
              CASE 
                WHEN REGEXP_LIKE(TRIM(COALESCE(TRIM(XM.XML_RECEB), XM.XML_EMISSA)), '^[0-9]{8}$') 
                THEN ROUND(SYSDATE - TO_DATE(TRIM(COALESCE(TRIM(XM.XML_RECEB), XM.XML_EMISSA)), 'YYYYMMDD'))
                ELSE NULL 
              END as DIAS
            FROM PROTHEUS11.CONDORXML XM
            WHERE XM.D_E_L_E_T_ = ' '
              AND NOT EXISTS (
                  SELECT 1 FROM PROTHEUS11.SFT020 FT 
                  WHERE FT.D_E_L_E_T_ = ' ' 
                    AND FT.FT_CHVNFE = XM.XML_CHAVE 
                    AND FT.FT_TIPOMOV = 'E'
              )
            ORDER BY DIAS DESC NULLS LAST
        ) WHERE ROWNUM <= 5
"@
    $cmd = New-Object System.Data.Odbc.OdbcCommand($query, $connection)
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        Write-Host "NF: $($reader['XML_NUMNF']) Forn: $($reader['XML_NOMEMT']) Emissa: $($reader['XML_EMISSA']) Dias: $($reader['DIAS'])"
    }
    $reader.Close()
    $connection.Close()
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
