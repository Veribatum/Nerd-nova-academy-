# Run on Windows PowerShell 5.1. VM and SSH dispatch are stubbed; routes are real.
$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'companion\core.ps1')
function Assert-Equal($Actual, $Expected, [string]$Label) { if ($Actual -cne $Expected) { throw "$Label : expected $Expected, received $Actual" } }
$script:Calls = New-Object Collections.Generic.List[string]
function Get-AcademyVMStatus([string]$VBox) { return @{ connected = $true; running = $true; vm = 'RHEL 9.8 Vehicle Node'; state = 'running' } }
function Invoke-AcademyLab([string]$Operation, [string]$KeyPath) { $script:Calls.Add($Operation); return @{ operation = $Operation; verified = ($Operation -eq 'verify') } }
$s = New-AcademySession $true 'fixture-key' 'fixture-vbox'
$origin = 'https://veribatum.github.io'
function Route([string]$Method, [string]$Path, [string]$Token = '', [string]$Body = '', [string]$Origin = $origin, [string]$HostValue = '127.0.0.1:8765') {
    return Get-AcademyRoute $Method $Path $HostValue $Origin $Token $Body $s
}
Assert-Equal (Route 'GET' '/vm/status').Data.running $true 'Original VM status'
Assert-Equal (Route 'POST' '/lab/deploy' '' '{"mission":"rhel-link"}').Status 401 'Unauthenticated deploy'
Assert-Equal (Route 'OPTIONS' '/lab/deploy' '' '' 'https://evil.invalid').Status 403 'Foreign origin'
Assert-Equal (Route 'GET' '/health' '' '' $origin 'attacker.invalid:8765').Status 403 'DNS rebinding host'
Assert-Equal (Route 'POST' '/pair' '' ('{"code":"' + $s.Code + '"}') '').Status 403 'Originless pairing'
$paired = Route 'POST' '/pair' '' ('{"code":"' + $s.Code + '"}')
Assert-Equal $paired.Status 200 'Console pairing'
$token = 'Bearer ' + $paired.Data.token
Assert-Equal (Route 'GET' '/lab/status' $token).Status 200 'Authorized read'
Assert-Equal (Route 'GET' '/lab/deploy' $token).Status 405 'No mutation by GET'
Assert-Equal (Route 'POST' '/lab/deploy' $token '{"mission":"rhel-link"}').Status 200 'Fixed deploy'
Assert-Equal (Route 'POST' '/lab/deploy' $token '{"mission":"MPPCS"}').Status 400 'Reject other target'
Assert-Equal (Route 'POST' '/lab/deploy' $token '{"mission":"rhel-link","command":"rm -rf /"}').Status 400 'Reject executable payload'
Assert-Equal (Route 'POST' '/lab/deploy' $token '{}').Status 400 'Reject missing mission'
Assert-Equal (Route 'POST' '/exec' $token '{"command":"whoami"}').Status 404 'No unrestricted endpoint'
Assert-Equal (Route 'POST' '/lab/reset' $token '{"mission":"rhel-link"}' 'https://evil.invalid').Status 403 'Foreign origin with token'
Assert-Equal $script:Calls.Count 2 'Only status and approved deploy reached dispatch'
$s.Expires = [DateTime]::UtcNow.AddSeconds(-1)
Assert-Equal (Route 'POST' '/lab/verify' $token '{"mission":"rhel-link"}').Status 403 'Expired authorization'
$s = New-AcademySession $true 'fixture' 'fixture'
for ($i = 0; $i -lt 5; $i++) { [void](Route 'POST' '/pair' '' '{"code":"wrong"}') }
Assert-Equal (Route 'POST' '/pair' '' ('{"code":"' + $s.Code + '"}')).Status 429 'Pairing brute-force lockout'
# Exercise the actual native argument quoting path with an official Windows binary.
$exe = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$result = Invoke-AcademyProcess $exe @('-NoProfile', '-Command', '[Console]::Write("spaces and quotes")')
Assert-Equal $result.ExitCode 0 'Process launch'
Assert-Equal $result.Output 'spaces and quotes' 'Win32 argument quoting'
Write-Host 'PowerShell 5.1 route, authorization, origin, payload and native-launch checks passed.'
