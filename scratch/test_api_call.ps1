try {
    $res = Invoke-WebRequest -Uri "http://localhost:3000/api/notas?page=1&limit=50&status=pendente&filial=&fornecedor=&numnf=&emissao_de=&emissao_ate=&vencimento_de=&vencimento_ate=" -UseBasicParsing
    Write-Host "Status Code: $($res.StatusCode)" -ForegroundColor Green
    Write-Host "Body snippet: $($res.Content.Substring(0, 200))"
} catch {
    Write-Host "Error occurred:" -ForegroundColor Red
    Write-Host $_
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Host "Response Body: $body" -ForegroundColor Yellow
    }
}
