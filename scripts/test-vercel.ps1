$base = "https://go-motors-ten.vercel.app"
$results = @()

function Test-Endpoint {
  param($Name, $Method, $Url, $Body, $ExpectStatus, $Cookie)
  $params = @{
    Uri = $Url
    Method = $Method
    UseBasicParsing = $true
  }
  if ($Body) { $params.ContentType = "application/json"; $params.Body = $Body }
  if ($Cookie) { $params.Headers = @{ Cookie = $Cookie } }
  try {
    $r = Invoke-WebRequest @params -MaximumRedirection 0 -ErrorAction Stop
    $status = [int]$r.StatusCode
    $ok = ($ExpectStatus -contains $status)
    $detail = "HTTP $status"
    if ($r.Content.Length -lt 200) { $detail += " | $($r.Content)" }
    return [PSCustomObject]@{ Name=$Name; Ok=$ok; Detail=$detail; Cookie=$r.Headers["Set-Cookie"] }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $status = [int]$resp.StatusCode
      $reader = [System.IO.StreamReader]::new($resp.GetResponseStream())
      $content = $reader.ReadToEnd()
      $ok = ($ExpectStatus -contains $status)
      $detail = "HTTP $status | $($content.Substring(0, [Math]::Min(120, $content.Length)))"
      return [PSCustomObject]@{ Name=$Name; Ok=$ok; Detail=$detail; Cookie=$null }
    }
    return [PSCustomObject]@{ Name=$Name; Ok=$false; Detail=$_.Exception.Message; Cookie=$null }
  }
}

Write-Output "=== VERCEL / APP TESTS ==="

# Public pages
$results += Test-Endpoint "Login page" GET "$base/login" $null @(200)
$results += Test-Endpoint "Display TV" GET "$base/display" $null @(200)
$results += Test-Endpoint "Display API" GET "$base/api/display/orders" $null @(200)

# Auth required without session
$results += Test-Endpoint "API /me sem login" GET "$base/api/auth/me" $null @(401)
$results += Test-Endpoint "Home sem login" GET "$base/" $null @(307,302)

# Login admin
$login = Test-Endpoint "Login admin API" POST "$base/api/auth/login" '{"email":"admin@gomotors.local","password":"admin123"}' @(200)
$results += $login

$cookie = $null
if ($login.Cookie) { $cookie = ($login.Cookie -split ";")[0] }

if ($cookie) {
  $results += Test-Endpoint "API /me com login" GET "$base/api/auth/me" $null @(200) $cookie
  $results += Test-Endpoint "API clientes" GET "$base/api/clients" $null @(200) $cookie
  $results += Test-Endpoint "API ordens" GET "$base/api/orders" $null @(200) $cookie
  $results += Test-Endpoint "API servicos" GET "$base/api/services" $null @(200) $cookie
  $results += Test-Endpoint "API dashboard" GET "$base/api/dashboard" $null @(200) $cookie
  $results += Test-Endpoint "API caixa" GET "$base/api/cash" $null @(200) $cookie
  $results += Test-Endpoint "API produtos" GET "$base/api/products" $null @(200) $cookie
  $results += Test-Endpoint "API stock alerts" GET "$base/api/stock/alerts" $null @(200) $cookie
  $results += Test-Endpoint "Login credencial errada" POST "$base/api/auth/login" '{"email":"admin@gomotors.local","password":"wrong"}' @(401)
  $results += Test-Endpoint "Login atendente" POST "$base/api/auth/login" '{"email":"atendente@gomotors.local","password":"atendente123"}' @(200)
} else {
  $results += [PSCustomObject]@{ Name="Sessão autenticada"; Ok=$false; Detail="Cookie não retornado no login" }
}

foreach ($r in $results) {
  $flag = if ($r.Ok) { "PASS" } else { "FAIL" }
  Write-Output "$flag | $($r.Name) | $($r.Detail)"
}

$failed = ($results | Where-Object { -not $_.Ok }).Count
Write-Output "=== TOTAL: $($results.Count - $failed)/$($results.Count) passed ==="
exit $(if ($failed -gt 0) { 1 } else { 0 })
