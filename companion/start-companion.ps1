# Retains the original loopback Vehicle Node status endpoint; no Python needed.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'core.ps1')
$prefix = 'http://127.0.0.1:8765/'
$vbox = Join-Path $env:ProgramFiles 'Oracle\VirtualBox\VBoxManage.exe'
if (-not (Test-Path $vbox)) { Write-Host 'VBoxManage missing from the standard VirtualBox installation path.'; exit 1 }
$key = Join-Path $env:LOCALAPPDATA 'NerdNovaAcademy\academy_ed25519'
$enable = $false
Write-Host 'NERD NOVA LOCAL COMPANION // VEHICLE NODE'
Write-Host 'Assigned VM: RHEL 9.8 Vehicle Node / nova-academy'
if (Test-Path $key) {
    Write-Host 'Optional lab control creates, verifies, and resets ONLY the isolated Academy network.'
    $enable = ((Read-Host 'Type ENABLE to authorize lab control this session, or Enter for status only') -ceq 'ENABLE')
} else { Write-Host 'Status mode is ready. Run setup-lab.bat once for isolated real missions.' }
$session = New-AcademySession $enable $key $vbox
$listener = New-Object Net.HttpListener
$listener.Prefixes.Add($prefix)
try { $listener.Start() } catch { Write-Host "Cannot start $prefix : $($_.Exception.Message)"; exit 1 }
if ($enable) { Write-Host "PAIRING CODE: $($session.Code)"; Write-Host 'Enter this code only in Academy / Lab connection.' }
Write-Host "Serving $prefix -- keep this window open. Ctrl+C stops."
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $req = $context.Request; $res = $context.Response
        try {
            $body = ''
            if ($req.ContentLength64 -gt 4096 -or $req.ContentLength64 -lt 0) { $route = @{ Status = 413; Data = @{ error = 'Request too large.' }; Cors = $false } }
            elseif ($req.Url.Query) { $route = @{ Status = 400; Data = @{ error = 'Query arguments are not supported.' }; Cors = $false } }
            elseif ($req.HttpMethod -eq 'POST' -and $req.ContentType -notlike 'application/json*') { $route = @{ Status = 415; Data = @{ error = 'JSON required.' }; Cors = $false } }
            else {
                if ($req.ContentLength64 -gt 0) {
                    $reader = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
                    try { $body = $reader.ReadToEnd() } finally { $reader.Dispose() }
                }
                $route = Get-AcademyRoute $req.HttpMethod $req.Url.AbsolutePath $req.Headers['Host'] $req.Headers['Origin'] $req.Headers['Authorization'] $body $session
            }
            $res.StatusCode = $route.Status
            $res.Headers.Add('Cache-Control', 'no-store')
            $res.Headers.Add('X-Content-Type-Options', 'nosniff')
            if ($route.Cors) {
                $res.Headers.Add('Access-Control-Allow-Origin', 'https://veribatum.github.io')
                $res.Headers.Add('Vary', 'Origin')
                $res.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                $res.Headers.Add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
                $res.Headers.Add('Access-Control-Allow-Private-Network', 'true')
            }
            if ($route.Status -ne 204) {
                $json = ConvertTo-Json -InputObject $route.Data -Depth 12 -Compress
                $bytes = [Text.Encoding]::UTF8.GetBytes($json)
                $res.ContentType = 'application/json; charset=utf-8'; $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            Write-Host "$($req.HttpMethod) $($req.Url.AbsolutePath) $($route.Status)"
        } catch { Write-Host "Request error: $($_.Exception.Message)"; try { $res.StatusCode = 500 } catch {} }
        finally { $res.Close() }
    }
} finally { $listener.Stop(); $listener.Close() }
