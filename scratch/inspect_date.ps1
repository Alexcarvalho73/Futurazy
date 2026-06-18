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
        SELECT 
            XM.XML_CHAVE,
            XM.XML_RECEB,
            XM.XML_EMISSA,
            TRIM(XM.XML_RECEB) as TRIM_REC,
            TRIM(XM.XML_EMISSA) as TRIM_EMI,
            COALESCE(TRIM(XM.XML_RECEB), XM.XML_EMISSA) as COAL,
            TRIM(COALESCE(TRIM(XM.XML_RECEB), XM.XML_EMISSA)) as TRIM_COAL,
            LENGTH(TRIM(COALESCE(TRIM(XM.XML_RECEB), XM.XML_EMISSA))) as LEN_COAL,
            CASE WHEN REGEXP_LIKE(TRIM(COALESCE(TRIM(XM.XML_RECEB), XM.XML_EMISSA)), '^[0-9]{8}$') THEN 1 ELSE 0 END as REGEXP_MATCH
        FROM PROTHEUS11.CONDORXML XM
        WHERE XM.XML_CHAVE LIKE '35220503298420000356570020005149411007920951%'
"@
    $cmd = New-Object System.Data.Odbc.OdbcCommand($query, $connection)
    $reader = $cmd.ExecuteReader()
    if ($reader.Read()) {
        Write-Host "CHAVE: $($reader['XML_CHAVE'])"
        Write-Host "RECEB: '$($reader['XML_RECEB'])'"
        Write-Host "EMISSA: '$($reader['XML_EMISSA'])'"
        Write-Host "TRIM_REC: '$($reader['TRIM_REC'])'"
        Write-Host "TRIM_EMI: '$($reader['TRIM_EMI'])'"
        Write-Host "COAL: '$($reader['COAL'])'"
        Write-Host "TRIM_COAL: '$($reader['TRIM_COAL'])'"
        Write-Host "LEN_COAL: $($reader['LEN_COAL'])"
        Write-Host "REGEXP_MATCH: $($reader['REGEXP_MATCH'])"
    }
    $reader.Close()
    $connection.Close()
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
