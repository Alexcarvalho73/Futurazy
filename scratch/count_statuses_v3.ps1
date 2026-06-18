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
    
    # 1. Total Geral e Total Pendentes
    $cmd = New-Object System.Data.Odbc.OdbcCommand("SELECT COUNT(*) FROM PROTHEUS11.CONDORXML WHERE D_E_L_E_T_ = ' '", $connection)
    $total = $cmd.ExecuteScalar()
    
    $q_pend_count = @"
SELECT COUNT(*) FROM PROTHEUS11.CONDORXML XM
LEFT JOIN PROTHEUS11.SFT020 FT ON FT.D_E_L_E_T_ = ' ' AND FT.FT_CHVNFE = XM.XML_CHAVE AND FT.FT_TIPOMOV = 'E'
WHERE XM.D_E_L_E_T_ = ' ' AND FT.R_E_C_N_O_ IS NULL
"@
    $cmd.CommandText = $q_pend_count
    $pendente = $cmd.ExecuteScalar()
    
    # 2. Vamos fazer contagens individuais para os status das Notas no banco
    # --- TOTAL GERAL ---
    $rej_tot = (New-Object System.Data.Odbc.OdbcCommand("SELECT COUNT(*) FROM PROTHEUS11.CONDORXML WHERE D_E_L_E_T_ = ' ' AND TRIM(XML_REJEIT) IS NOT NULL", $connection)).ExecuteScalar()
    
    $cte_fob_tot = (New-Object System.Data.Odbc.OdbcCommand("SELECT COUNT(*) FROM PROTHEUS11.CONDORXML WHERE D_E_L_E_T_ = ' ' AND TRIM(XML_REJEIT) IS NULL AND TRIM(XML_TIPODC) = 'T' AND TRIM(XML_CTEFOB) = 'S'", $connection)).ExecuteScalar()
    
    $cte_cif_tot = (New-Object System.Data.Odbc.OdbcCommand("SELECT COUNT(*) FROM PROTHEUS11.CONDORXML WHERE D_E_L_E_T_ = ' ' AND TRIM(XML_REJEIT) IS NULL AND TRIM(XML_TIPODC) = 'T' AND (TRIM(XML_CTEFOB) IS NULL OR TRIM(XML_CTEFOB) <> 'S')", $connection)).ExecuteScalar()
    
    $prenota_tot = (New-Object System.Data.Odbc.OdbcCommand("SELECT COUNT(*) FROM PROTHEUS11.CONDORXML WHERE D_E_L_E_T_ = ' ' AND TRIM(XML_REJEIT) IS NULL AND TRIM(XML_TIPODC) <> 'T' AND TRIM(XML_OK) = 'NP'", $connection)).ExecuteScalar()
    
    $compl_tot = (New-Object System.Data.Odbc.OdbcCommand("SELECT COUNT(*) FROM PROTHEUS11.CONDORXML WHERE D_E_L_E_T_ = ' ' AND TRIM(XML_REJEIT) IS NULL AND TRIM(XML_TIPODC) = 'F'", $connection)).ExecuteScalar()
    
    $q_normal_tot = @"
SELECT COUNT(*) FROM PROTHEUS11.CONDORXML 
WHERE D_E_L_E_T_ = ' ' 
  AND TRIM(XML_REJEIT) IS NULL 
  AND TRIM(XML_TIPODC) NOT IN ('T', 'F') 
  AND (TRIM(XML_OK) IS NULL OR TRIM(XML_OK) <> 'NP')
"@
    $normal_tot = (New-Object System.Data.Odbc.OdbcCommand($q_normal_tot, $connection)).ExecuteScalar()

    # --- PENDENTES ---
    $q_base = "FROM PROTHEUS11.CONDORXML XM LEFT JOIN PROTHEUS11.SFT020 FT ON FT.D_E_L_E_T_ = ' ' AND FT.FT_CHVNFE = XM.XML_CHAVE AND FT.FT_TIPOMOV = 'E' WHERE XM.D_E_L_E_T_ = ' ' AND FT.R_E_C_N_O_ IS NULL"
    
    $rej_pend = (New-Object System.Data.Odbc.OdbcCommand("SELECT COUNT(*) $q_base AND TRIM(XM.XML_REJEIT) IS NOT NULL", $connection)).ExecuteScalar()
    
    $cte_fob_pend = (New-Object System.Data.Odbc.OdbcCommand("SELECT COUNT(*) $q_base AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) = 'T' AND TRIM(XM.XML_CTEFOB) = 'S'", $connection)).ExecuteScalar()
    
    $cte_cif_pend = (New-Object System.Data.Odbc.OdbcCommand("SELECT COUNT(*) $q_base AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) = 'T' AND (TRIM(XM.XML_CTEFOB) IS NULL OR TRIM(XM.XML_CTEFOB) <> 'S')", $connection)).ExecuteScalar()
    
    $prenota_pend = (New-Object System.Data.Odbc.OdbcCommand("SELECT COUNT(*) $q_base AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) <> 'T' AND TRIM(XM.XML_OK) = 'NP'", $connection)).ExecuteScalar()
    
    $compl_pend = (New-Object System.Data.Odbc.OdbcCommand("SELECT COUNT(*) $q_base AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) = 'F'", $connection)).ExecuteScalar()
    
    $q_normal_pend = @"
SELECT COUNT(*) $q_base 
  AND TRIM(XM.XML_REJEIT) IS NULL 
  AND TRIM(XM.XML_TIPODC) NOT IN ('T', 'F') 
  AND (TRIM(XM.XML_OK) IS NULL OR TRIM(XM.XML_OK) <> 'NP')
"@
    $normal_pend = (New-Object System.Data.Odbc.OdbcCommand($q_normal_pend, $connection)).ExecuteScalar()

    Write-Host "--- DETALHAMENTO DE STATUS ---"
    Write-Host "Total Banco: $total (Classificados: $($total - $pendente), Pendentes: $pendente)"
    Write-Host ""
    Write-Host "STATUS DAS NOTAS (TOTAL GERAL BANCO):"
    Write-Host " - NFe Normal: $normal_tot"
    Write-Host " - CTe CIF: $cte_cif_tot"
    Write-Host " - Complementar: $compl_tot"
    Write-Host " - Rejeitada: $rej_tot"
    Write-Host " - NFe Pré-Nota: $prenota_tot"
    Write-Host " - CTe FOB: $cte_fob_tot"
    Write-Host " Soma: $($normal_tot + $cte_cif_tot + $compl_tot + $rej_tot + $prenota_tot + $cte_fob_tot)"
    
    Write-Host ""
    Write-Host "STATUS DAS NOTAS (PENDENTES / SEM CLASSIFICACAO):"
    Write-Host " - NFe Normal: $normal_pend"
    Write-Host " - CTe CIF: $cte_cif_pend"
    Write-Host " - Complementar: $compl_pend"
    Write-Host " - Rejeitada: $rej_pend"
    Write-Host " - NFe Pré-Nota: $prenota_pend"
    Write-Host " - CTe FOB: $cte_fob_pend"
    Write-Host " Soma: $($normal_pend + $cte_cif_pend + $compl_pend + $rej_pend + $prenota_pend + $cte_fob_pend)"
    
    $connection.Close()
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
