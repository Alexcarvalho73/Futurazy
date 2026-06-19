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
SELECT STATUS, COUNT(*) QUANT 
FROM (
    SELECT CASE  
            WHEN XML_REJEIT <> ' ' THEN 'Rejeitada'
            WHEN XML_KEYF1 <> ' ' AND XML_KEYF1 LIKE '%|A%' AND XML_CONFCO <> ' ' AND XML_CONFIS <> ' ' AND XML_DTRCTO <> ' ' THEN 'Classificada COM/FIS/LOG-Ok'
            WHEN XML_KEYF1 <> ' ' AND XML_KEYF1 LIKE '%| %' AND XML_CONFCO <> ' ' AND XML_CONFIS <> ' ' AND XML_DTRCTO <> ' ' THEN 'Pré-Nota COM/FIS/LOG-Ok'
            WHEN XML_KEYF1 <> ' ' AND XML_CONFCO <> ' ' AND XML_CONFIS <> ' ' AND XML_DTRCTO <> ' ' THEN 'Lançada COM/FIS/LOG-Ok'
            
            WHEN XML_KEYF1 <> ' ' AND XML_KEYF1 LIKE '%|A%' AND XML_CONFIS <> ' ' AND XML_DTRCTO <> ' ' THEN 'Classificada FIS/LOG-Ok'
            WHEN XML_KEYF1 <> ' ' AND XML_KEYF1 LIKE '%| %' AND XML_CONFIS <> ' ' AND XML_DTRCTO <> ' ' THEN 'Pré-Nota FIS/LOG-Ok'
            WHEN XML_KEYF1 <> ' ' AND XML_CONFCO <> ' ' AND XML_CONFIS <> ' ' AND XML_DTRCTO <> ' ' THEN 'Lançada FIS/LOG-Ok'
            
            WHEN XML_KEYF1 <> ' ' AND XML_KEYF1 LIKE '%|A%' AND XML_DTRCTO <> ' ' AND XML_CONFCO = ' ' THEN 'Classificada LOG-Ok'
            WHEN XML_KEYF1 <> ' ' AND XML_KEYF1 LIKE '%| %' AND XML_DTRCTO <> ' ' AND XML_CONFCO = ' ' THEN 'Pré-Nota LOG-Ok'
            WHEN XML_KEYF1 <> ' ' AND XML_KEYF1 LIKE '%| %' AND XML_DTRCTO <> ' ' THEN 'Pré-Nota LOG-Ok'
            
            WHEN XML_KEYF1 <> ' ' AND XML_KEYF1 LIKE '%|A%' AND XML_CONFCO <> ' ' THEN 'Classificada COM-Ok'
            WHEN XML_KEYF1 <> ' ' AND XML_KEYF1 LIKE '%| %' AND XML_CONFCO <> ' ' THEN 'Pré-Nota COM-Ok'
            
            WHEN XML_KEYF1 <> ' ' AND XML_KEYF1 LIKE '%|A%' THEN 'Classificada'
            WHEN XML_KEYF1 <> ' ' AND XML_KEYF1 LIKE '%| %'  THEN 'Pré-Nota'
            
            WHEN XML_KEYF1 <> ' ' THEN 'Lançada'
            
            WHEN XML_KEYF1 = ' ' AND XML_TIPODC = 'B' THEN 'Benef.Aberto' 
            
            WHEN XML_KEYF1 = ' ' AND XML_TIPODC = 'S' THEN 'NFS-e Aberto' 
            
            WHEN XML_KEYF1 = ' ' AND XML_TIPODC = 'D' THEN 'Dev.Venda Aberto' 
            
            WHEN XML_KEYF1 = ' ' AND XML_TIPODC = 'F' THEN 'CT-e FOB Aberto' 
            
            WHEN XML_KEYF1 = ' ' AND XML_TIPODC = 'T' THEN 'CT-e CIF Aberto' 
            
            WHEN XML_KEYF1 = ' ' AND XML_CONFCO = ' ' AND XML_CONFIS = ' ' AND XML_DTRCTO  = ' ' AND XML_TIPODC = 'N' THEN 'NF-e Aberto' 
            
            WHEN XML_KEYF1 = ' ' AND XML_CONFCO <> ' ' AND XML_CONFIS = ' ' AND XML_DTRCTO = ' ' AND XML_TIPODC = 'N'  THEN 'NF-e Aberto + COM-Ok'

            WHEN XML_KEYF1 = ' ' AND XML_CONFCO <> ' ' AND XML_CONFIS <>  ' ' AND XML_DTRCTO = ' ' AND XML_TIPODC = 'N'  THEN 'NF-e Aberto + COM/FIS-Ok'
            
            WHEN XML_KEYF1 = ' ' AND XML_CONFCO <> ' ' AND XML_CONFIS = ' ' AND XML_DTRCTO <> ' ' AND XML_TIPODC = 'N'  THEN 'NF-e Aberto + COM/LOG-Ok'
            
            WHEN XML_KEYF1 = ' ' AND XML_DTRCTO <> ' ' AND XML_TIPODC = 'N'  THEN 'NF-e Aberto LOG-Ok'
            
            WHEN XML_KEYF1 = ' ' AND XML_CONFCO <> ' ' AND XML_TIPODC = 'N'  THEN 'NF-e Aberto COM-Ok'
            
            ELSE 
              'Sem Definição'
            END STATUS 
    FROM PROTHEUS11.CONDORXML 
    WHERE D_E_L_E_T_ =' '
      AND (XML_TIPODC IN('T','F') OR XML_TPNF NOT IN('0'))
      AND XML_DEST <> XML_EMIT
) TBL 
GROUP BY STATUS 
ORDER BY 2 DESC
"@
    $cmd = New-Object System.Data.Odbc.OdbcCommand($query, $connection)
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        Write-Host "$($reader['STATUS']) -> $($reader['QUANT'])"
    }
    $reader.Close()
    $connection.Close()
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
