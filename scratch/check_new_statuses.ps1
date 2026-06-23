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
    Write-Host "--- TESTANDO NOVA CLASSIFICACAO DE STATUS ---"
    
    $queryStatus = @"
    SELECT STATUS, COUNT(*) QUANT 
    FROM (
        SELECT CASE  
                WHEN XM.XML_REJEIT <> ' ' THEN 'Rejeitada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Pré-Nota'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Pré-Nota'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' AND XM.XML_DTRCTO <> ' ' AND XM.XML_CONFCO = ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_DTRCTO <> ' ' AND XM.XML_CONFCO = ' ' THEN 'Pré-Nota'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_DTRCTO <> ' ' THEN 'Pré-Nota'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' AND XM.XML_CONFCO <> ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_CONFCO <> ' ' THEN 'Pré-Nota'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %'  THEN 'Pré-Nota'
                WHEN XM.XML_KEYF1 <> ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'B' THEN 'Benef.Aberto' 
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'S' THEN 'Em Aberto' 
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'D' THEN 'Dev.Venda Aberto' 
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'F' THEN 'CT-e Aberto' 
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'T' THEN 'CT-e Aberto' 
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO = ' ' AND XM.XML_CONFIS = ' ' AND XM.XML_DTRCTO  = ' ' AND XM.XML_TIPODC = 'N' THEN 'Em Aberto' 
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS = ' ' AND XM.XML_DTRCTO = ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <>  ' ' AND XM.XML_DTRCTO = ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS = ' ' AND XM.XML_DTRCTO <> ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_DTRCTO <> ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
                ELSE 'Sem Definição'
               END STATUS 
        FROM PROTHEUS11.CONDORXML XM
        WHERE XM.D_E_L_E_T_ = ' '
          AND (XM.XML_TIPODC IN ('T', 'F') OR XM.XML_TPNF NOT IN ('0'))
          AND XM.XML_DEST <> XM.XML_EMIT
          AND XM.XML_EMISSA >= '20240601'
    ) TBL 
    GROUP BY STATUS 
    ORDER BY QUANT DESC
"@
    
    $cmd = New-Object System.Data.Odbc.OdbcCommand($queryStatus, $connection)
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        Write-Host "$($reader['STATUS']) -> $($reader['QUANT'])"
    }
    $reader.Close()

    Write-Host "`n--- TESTANDO FILTRO DE CATEGORIAS (PENDENTE VS CONCLUIDO) ---"
    
    $queryCategoria = @"
    SELECT CATEGORIA, COUNT(*) QUANT 
    FROM (
        SELECT 
          CASE
            WHEN (
              CASE  
                WHEN XM.XML_REJEIT <> ' ' THEN 'Rejeitada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Pré-Nota'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Pré-Nota'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' AND XM.XML_DTRCTO <> ' ' AND XM.XML_CONFCO = ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_DTRCTO <> ' ' AND XM.XML_CONFCO = ' ' THEN 'Pré-Nota'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_DTRCTO <> ' ' THEN 'Pré-Nota'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' AND XM.XML_CONFCO <> ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_CONFCO <> ' ' THEN 'Pré-Nota'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' THEN 'Lançada'
                WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %'  THEN 'Pré-Nota'
                WHEN XM.XML_KEYF1 <> ' ' THEN 'Lançada'
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'B' THEN 'Benef.Aberto' 
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'S' THEN 'Em Aberto' 
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'D' THEN 'Dev.Venda Aberto' 
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'F' THEN 'CT-e Aberto' 
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'T' THEN 'CT-e Aberto' 
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO = ' ' AND XM.XML_CONFIS = ' ' AND XM.XML_DTRCTO  = ' ' AND XM.XML_TIPODC = 'N' THEN 'Em Aberto' 
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS = ' ' AND XM.XML_DTRCTO = ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <>  ' ' AND XM.XML_DTRCTO = ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS = ' ' AND XM.XML_DTRCTO <> ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_DTRCTO <> ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
                WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
                ELSE 'Sem Definição'
              END
            ) = 'Lançada' THEN 'Concluido'
            ELSE 'Pendente'
          END as CATEGORIA
        FROM PROTHEUS11.CONDORXML XM
        WHERE XM.D_E_L_E_T_ = ' '
          AND (XM.XML_TIPODC IN ('T', 'F') OR XM.XML_TPNF NOT IN ('0'))
          AND XM.XML_DEST <> XM.XML_EMIT
          AND XM.XML_EMISSA >= '20240601'
    ) TBL 
    GROUP BY CATEGORIA 
    ORDER BY QUANT DESC
"@
    
    $cmd2 = New-Object System.Data.Odbc.OdbcCommand($queryCategoria, $connection)
    $reader2 = $cmd2.ExecuteReader()
    while ($reader2.Read()) {
        Write-Host "$($reader2['CATEGORIA']) -> $($reader2['QUANT'])"
    }
    $reader2.Close()
    
    $connection.Close()
} catch {
    Write-Host "Erro ao executar teste: $_" -ForegroundColor Red
}
