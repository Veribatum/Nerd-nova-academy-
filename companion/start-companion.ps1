# Nerd Nova Academy local companion — read-only, Windows PowerShell 5.1 compatible.
# Binds to loopback only and exposes no command execution or configuration changes.
$ErrorActionPreference = 'Stop'
$prefix = 'http://127.0.0.1:8765/'
$allowedOrigin = 'https://veribatum.github.io'
$vmName = 'RHEL 9.8 Vehicle Node'
$vbox = Join-Path $env:ProgramFiles 'Oracle\VirtualBox\VBoxManage.exe'
if (-not (Test-Path $vbox)) {
  Write-Host 'VBoxManage missing from the standard VirtualBox installation path.'
  exit 1
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try { $listener.Start() } catch {
  Write-Host "Cannot start $prefix : $($_.Exception.Message)"
  exit 1
}
Write-Host 'NERD NOVA LOCAL COMPANION // READ ONLY'
Write-Host "Serving $prefix"
Write-Host "Assigned VM: $vmName"
Write-Host 'Keep this window open. Press Ctrl+C to stop.'
try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    try {
      $origin = $req.Headers['Origin']
      if ($origin -and $origin -ne $allowedOrigin) {
        $res.StatusCode = 403
      } elseif ($req.HttpMethod -notin @('GET','OPTIONS')) {
        $res.StatusCode = 405
      } elseif ($req.Url.AbsolutePath -notin @('/health','/vm/status')) {
        $res.StatusCode = 404
      } else {
        if ($origin -eq $allowedOrigin) {
          $res.Headers.Add('Access-Control-Allow-Origin', $allowedOrigin)
          $res.Headers.Add('Vary', 'Origin')
        }
        $res.Headers.Add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        $res.Headers.Add('Cache-Control', 'no-store')
        if ($req.HttpMethod -eq 'OPTIONS') {
          $res.StatusCode = 204
        } else {
          if ($req.Url.AbsolutePath -eq '/health') {
            $data = @{ connected = $true; app = 'Nerd Nova Academy'; mode = 'read-only' }
          } else {
            $lines = & $vbox showvminfo $vmName --machinereadable 2>&1
            if ($LASTEXITCODE -ne 0) {
              $data = @{ connected = $false; vm = $vmName; error = 'VM not registered' }
            } else {
              $state = ''
              foreach ($line in $lines) {
                if ($line -match '^VMState="([^"]+)"') { $state = $Matches[1] }
              }
              $data = @{ connected = $true; vm = $vmName; state = $state; running = ($state -eq 'running'); mode = 'read-only' }
            }
          }
          $json = $data | ConvertTo-Json -Compress
          $bytes = [Text.Encoding]::UTF8.GetBytes($json)
          $res.ContentType = 'application/json; charset=utf-8'
          $res.ContentLength64 = $bytes.Length
          $res.OutputStream.Write($bytes,0,$bytes.Length)
          Write-Host "$($req.HttpMethod) $($req.Url.AbsolutePath)"
        }
      }
    } catch {
      Write-Host "Request error: $($_.Exception.Message)"
      if (-not $res.OutputStream.CanWrite) { continue }
      $res.StatusCode = 500
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
