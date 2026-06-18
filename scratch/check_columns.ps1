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
    
    $cmd = New-Object System.Data.Odbc.OdbcCommand("SELECT * FROM PROTHEUS11.CONDORXML WHERE ROWNUM = 1", $connection)
    $reader = $cmd.ExecuteReader()
    $schemaTable = $reader.GetSchemaTable()
    
    foreach ($row in $schemaTable.Rows) {
        Write-Host $row["ColumnName"] " - " $row["DataType"]
    }
    
    $reader.Close()
    $connection.Close()
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
