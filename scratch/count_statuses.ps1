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
    
    # 1. Classificação Status (Doc. Lançado)
    $q_class = @"
        SELECT 
            SUM(CASE WHEN FT.R_E_C_N_O_ IS NOT NULL THEN 1 ELSE 0 END) as CLASSIFICADO,
            SUM(CASE WHEN FT.R_E_C_N_O_ IS NULL THEN 1 ELSE 0 END) as PENDENTE,
            SUM(CASE WHEN FT.R_E_C_N_O_ IS NULL AND (XM.XML_OK IS NULL OR TRIM(XM.XML_OK) <> 'NP') THEN 1 ELSE 0 END) as EM_ABERTO,
            SUM(CASE WHEN FT.R_E_C_N_O_ IS NULL AND TRIM(XM.XML_OK) = 'NP' THEN 1 ELSE 0 END) as PRE_NOTA
        FROM PROTHEUS11.CONDORXML XM
        LEFT JOIN PROTHEUS11.SFT020 FT ON FT.D_E_L_E_T_ = ' ' AND FT.FT_CHVNFE = XM.XML_CHAVE AND FT.FT_TIPOMOV = 'E'
        WHERE XM.D_E_L_E_T_ = ' '
"@
    $cmd = New-Object System.Data.Odbc.OdbcCommand($q_class, $connection)
    $reader = $cmd.ExecuteReader()
    if ($reader.Read()) {
        Write-Host "--- CLASSIFICACAO ---"
        Write-Host "Classificado: $($reader['CLASSIFICADO'])"
        Write-Host "Pendente (Aberto + Pré-Nota): $($reader['PENDENTE'])"
        Write-Host "   - Em Aberto: $($reader['EM_ABERTO'])"
        Write-Host "   - Pré-Nota: $($reader['PRE_NOTA'])"
    }
    $reader.Close()

    # 2. Document Statuses (based on getHeaderStatusBadge logic)
    # We query the total database (61719 records)
    $q_docs = @"
        SELECT 
            SUM(CASE WHEN XM.XML_REJEIT IS NOT NULL AND TRIM(XM.XML_REJEIT) <> ' ' THEN 1 ELSE 0 END) as REJEITADA,
            SUM(CASE WHEN XM.XML_REJEIT IS NULL OR TRIM(XM.XML_REJEIT) = ' ' THEN
                CASE WHEN TRIM(XM.XML_TIPODC) = 'T' AND TRIM(XM.XML_CTEFOB) = 'S' THEN 1 ELSE 0 END
            ELSE 0 END) as CTE_FOB,
            SUM(CASE WHEN XM.XML_REJEIT IS NULL OR TRIM(XM.XML_REJEIT) = ' ' THEN
                CASE WHEN TRIM(XM.XML_TIPODC) = 'T' AND (TRIM(XM.XML_CTEFOB) <> 'S' OR XM.XML_CTEFOB IS NULL) THEN 1 ELSE 0 END
            ELSE 0 END) as CTE_CIF,
            SUM(CASE WHEN XM.XML_REJEIT IS NULL OR TRIM(XM.XML_REJEIT) = ' ' THEN
                CASE WHEN TRIM(XM.XML_TIPODC) <> 'T' AND TRIM(XM.XML_OK) = 'NP' THEN 1 ELSE 0 END
            ELSE 0 END) as PRE_NOTA_DOC,
            SUM(CASE WHEN XM.XML_REJEIT IS NULL OR TRIM(XM.XML_REJEIT) = ' ' THEN
                CASE WHEN TRIM(XM.XML_TIPODC) = 'F' THEN 1 ELSE 0 END
            ELSE 0 END) as COMPLEMENTAR,
            SUM(CASE WHEN XM.XML_REJEIT IS NULL OR TRIM(XM.XML_REJEIT) = ' ' THEN
                CASE WHEN TRIM(XM.XML_TIPODC) NOT IN ('T', 'F') AND (TRIM(XM.XML_OK) <> 'NP' OR XM.XML_OK IS NULL) THEN 1 ELSE 0 END
            ELSE 0 END) as NFE_NORMAL
        FROM PROTHEUS11.CONDORXML XM
        WHERE XM.D_E_L_E_T_ = ' '
"@
    $cmd.CommandText = $q_docs
    $reader = $cmd.ExecuteReader()
    if ($reader.Read()) {
        Write-Host "--- STATUS DO CABEÇALHO (TOTAL DO BANCO) ---"
        Write-Host "Rejeitada: $($reader['REJEITADA'])"
        Write-Host "CTe FOB: $($reader['CTE_FOB'])"
        Write-Host "CTe CIF: $($reader['CTE_CIF'])"
        Write-Host "NFe Pré-Nota (Documento): $($reader['PRE_NOTA_DOC'])"
        Write-Host "Complementar: $($reader['COMPLEMENTAR'])"
        Write-Host "NFe Normal: $($reader['NFE_NORMAL'])"
    }
    $reader.Close()

    # 3. Document Statuses filtered by PENDENTES ONLY (40690 records)
    $q_docs_pend = @"
        SELECT 
            SUM(CASE WHEN XM.XML_REJEIT IS NOT NULL AND TRIM(XM.XML_REJEIT) <> ' ' THEN 1 ELSE 0 END) as REJEITADA,
            SUM(CASE WHEN XM.XML_REJEIT IS NULL OR TRIM(XM.XML_REJEIT) = ' ' THEN
                CASE WHEN TRIM(XM.XML_TIPODC) = 'T' AND TRIM(XM.XML_CTEFOB) = 'S' THEN 1 ELSE 0 END
            ELSE 0 END) as CTE_FOB,
            SUM(CASE WHEN XM.XML_REJEIT IS NULL OR TRIM(XM.XML_REJEIT) = ' ' THEN
                CASE WHEN TRIM(XM.XML_TIPODC) = 'T' AND (TRIM(XM.XML_CTEFOB) <> 'S' OR XM.XML_CTEFOB IS NULL) THEN 1 ELSE 0 END
            ELSE 0 END) as CTE_CIF,
            SUM(CASE WHEN XM.XML_REJEIT IS NULL OR TRIM(XM.XML_REJEIT) = ' ' THEN
                CASE WHEN TRIM(XM.XML_TIPODC) <> 'T' AND TRIM(XM.XML_OK) = 'NP' THEN 1 ELSE 0 END
            ELSE 0 END) as PRE_NOTA_DOC,
            SUM(CASE WHEN XM.XML_REJEIT IS NULL OR TRIM(XM.XML_REJEIT) = ' ' THEN
                CASE WHEN TRIM(XM.XML_TIPODC) = 'F' THEN 1 ELSE 0 END
            ELSE 0 END) as COMPLEMENTAR,
            SUM(CASE WHEN XM.XML_REJEIT IS NULL OR TRIM(XM.XML_REJEIT) = ' ' THEN
                CASE WHEN TRIM(XM.XML_TIPODC) NOT IN ('T', 'F') AND (TRIM(XM.XML_OK) <> 'NP' OR XM.XML_OK IS NULL) THEN 1 ELSE 0 END
            ELSE 0 END) as NFE_NORMAL
        FROM PROTHEUS11.CONDORXML XM
        LEFT JOIN PROTHEUS11.SFT020 FT ON FT.D_E_L_E_T_ = ' ' AND FT.FT_CHVNFE = XM.XML_CHAVE AND FT.FT_TIPOMOV = 'E'
        WHERE XM.D_E_L_E_T_ = ' ' AND FT.R_E_C_N_O_ IS NULL
"@
    $cmd.CommandText = $q_docs_pend
    $reader = $cmd.ExecuteReader()
    if ($reader.Read()) {
        Write-Host "--- STATUS DO CABEÇALHO (PENDENTES / SEM CLASSIFICAÇÃO) ---"
        Write-Host "Rejeitada: $($reader['REJEITADA'])"
        Write-Host "CTe FOB: $($reader['CTE_FOB'])"
        Write-Host "CTe CIF: $($reader['CTE_CIF'])"
        Write-Host "NFe Pré-Nota (Documento): $($reader['PRE_NOTA_DOC'])"
        Write-Host "Complementar: $($reader['COMPLEMENTAR'])"
        Write-Host "NFe Normal: $($reader['NFE_NORMAL'])"
    }
    $reader.Close()

    $connection.Close()
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
