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
    
    # Vamos contar os status do Cabeçalho para Pendentes e no Total Geral
    $query = @"
        SELECT 
            -- No Total Geral (61.719 registros)
            SUM(CASE WHEN TRIM(XM.XML_REJEIT) IS NOT NULL THEN 1 ELSE 0 END) as ALL_REJ,
            SUM(CASE WHEN TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) = 'T' AND TRIM(XM.XML_CTEFOB) = 'S' THEN 1 ELSE 0 END) as ALL_CTE_FOB,
            SUM(CASE WHEN TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) = 'T' AND (TRIM(XM.XML_CTEFOB) <> 'S' OR XM.XML_CTEFOB IS NULL) THEN 1 ELSE 0 END) as ALL_CTE_CIF,
            SUM(CASE WHEN TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) <> 'T' AND TRIM(XM.XML_OK) = 'NP' THEN 1 ELSE 0 END) as ALL_PRE_NOTA,
            SUM(CASE WHEN TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) = 'F' THEN 1 ELSE 0 END) as ALL_COMPL,
            SUM(CASE WHEN TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) NOT IN ('T', 'F') AND (TRIM(XM.XML_OK) <> 'NP' OR XM.XML_OK IS NULL) THEN 1 ELSE 0 END) as ALL_NFE_NORMAL,
            
            -- Nos Pendentes (40.690 registros)
            SUM(CASE WHEN FT.R_E_C_N_O_ IS NULL AND TRIM(XM.XML_REJEIT) IS NOT NULL THEN 1 ELSE 0 END) as PEND_REJ,
            SUM(CASE WHEN FT.R_E_C_N_O_ IS NULL AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) = 'T' AND TRIM(XM.XML_CTEFOB) = 'S' THEN 1 ELSE 0 END) as PEND_CTE_FOB,
            SUM(CASE WHEN FT.R_E_C_N_O_ IS NULL AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) = 'T' AND (TRIM(XM.XML_CTEFOB) <> 'S' OR XM.XML_CTEFOB IS NULL) THEN 1 ELSE 0 END) as PEND_CTE_CIF,
            SUM(CASE WHEN FT.R_E_C_N_O_ IS NULL AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) <> 'T' AND TRIM(XM.XML_OK) = 'NP' THEN 1 ELSE 0 END) as PEND_PRE_NOTA,
            SUM(CASE WHEN FT.R_E_C_N_O_ IS NULL AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) = 'F' THEN 1 ELSE 0 END) as PEND_COMPL,
            SUM(CASE WHEN FT.R_E_C_N_O_ IS NULL AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) NOT IN ('T', 'F') AND (TRIM(XM.XML_OK) <> 'NP' OR XM.XML_OK IS NULL) THEN 1 ELSE 0 END) as PEND_NFE_NORMAL
        FROM PROTHEUS11.CONDORXML XM
        LEFT JOIN PROTHEUS11.SFT020 FT ON FT.D_E_L_E_T_ = ' ' AND FT.FT_CHVNFE = XM.XML_CHAVE AND FT.FT_TIPOMOV = 'E'
        WHERE XM.D_E_L_E_T_ = ' '
"@
    $cmd = New-Object System.Data.Odbc.OdbcCommand($query, $connection)
    $reader = $cmd.ExecuteReader()
    if ($reader.Read()) {
        Write-Host "--- TOTAL GERAL ---"
        Write-Host "Rejeitada: $($reader['ALL_REJ'])"
        Write-Host "CTe FOB: $($reader['ALL_CTE_FOB'])"
        Write-Host "CTe CIF: $($reader['ALL_CTE_CIF'])"
        Write-Host "NFe Pré-Nota: $($reader['ALL_PRE_NOTA'])"
        Write-Host "Complementar: $($reader['ALL_COMPL'])"
        Write-Host "NFe Normal: $($reader['ALL_NFE_NORMAL'])"
        
        Write-Host "--- PENDENTES ---"
        Write-Host "Rejeitada: $($reader['PEND_REJ'])"
        Write-Host "CTe FOB: $($reader['PEND_CTE_FOB'])"
        Write-Host "CTe CIF: $($reader['PEND_CTE_CIF'])"
        Write-Host "NFe Pré-Nota: $($reader['PEND_PRE_NOTA'])"
        Write-Host "Complementar: $($reader['PEND_COMPL'])"
        Write-Host "NFe Normal: $($reader['PEND_NFE_NORMAL'])"
    }
    $reader.Close()
    $connection.Close()
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
