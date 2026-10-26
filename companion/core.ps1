# Windows PowerShell 5.1. Routes never accept executable text or a VM name.
Set-StrictMode -Version Latest
function New-AcademySecret([int]$Bytes = 32) {
    $value = New-Object byte[] $Bytes
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($value) } finally { $rng.Dispose() }
    return (($value | ForEach-Object { $_.ToString('x2') }) -join '')
}
function Test-AcademySecret([string]$Left, [string]$Right) {
    if (-not $Left -or -not $Right -or $Left.Length -ne $Right.Length) { return $false }
    $difference = 0
    for ($i = 0; $i -lt $Left.Length; $i++) { $difference = $difference -bor ([int]$Left[$i] -bxor [int]$Right[$i]) }
    return ($difference -eq 0)
}
function ConvertTo-AcademyArgument([string]$Value) {
    # Windows CommandLineToArgvW quoting. Process.Start never invokes a shell.
    return '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}
function Invoke-AcademyProcess([string]$File, [string[]]$Arguments, [int]$Timeout = 18000) {
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $File
    $start.Arguments = (($Arguments | ForEach-Object { ConvertTo-AcademyArgument $_ }) -join ' ')
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $start
    try {
        [void]$process.Start()
        $outTask = $process.StandardOutput.ReadToEndAsync()
        $errTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($Timeout)) { $process.Kill(); throw 'Local operation timed out. Check the companion console.' }
        $stdout = $outTask.Result; $stderr = $errTask.Result
        if ($stdout.Length -gt 65536) { throw 'Unexpected response size.' }
        return @{ ExitCode = $process.ExitCode; Output = $stdout; ErrorText = $stderr }
    } finally { $process.Dispose() }
}
function Get-AcademyVMStatus([string]$VBox) {
    $result = Invoke-AcademyProcess $VBox @('showvminfo', 'RHEL 9.8 Vehicle Node', '--machinereadable')
    if ($result.ExitCode -ne 0) { return @{ connected = $false; vm = 'RHEL 9.8 Vehicle Node'; error = 'VM not registered' } }
    $state = 'unknown'
    foreach ($line in ($result.Output -split "`n")) { if ($line -match '^VMState="([^"]+)"') { $state = $Matches[1] } }
    return @{ connected = $true; vm = 'RHEL 9.8 Vehicle Node'; state = $state; running = ($state -eq 'running'); mode = 'restricted-lab' }
}
function Invoke-AcademyLab([string]$Operation, [string]$KeyPath) {
    if (@('status', 'deploy', 'verify', 'reset') -cnotcontains $Operation) { throw 'Operation not authorized.' }
    $ssh = Join-Path $env:WINDIR 'System32\OpenSSH\ssh.exe'
    if (-not (Test-Path $ssh)) { throw 'Windows OpenSSH Client is required.' }
    if (-not (Test-Path $KeyPath)) { throw 'Run setup-lab.bat once to enroll this VM.' }
    $result = Invoke-AcademyProcess $ssh @('-T', '-p', '2224', '-i', $KeyPath, '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=5', 'jamean@127.0.0.1', "academy $Operation")
    try { $data = $result.Output | ConvertFrom-Json } catch { throw 'The enrolled VM did not return lab evidence. Check SSH or rerun setup-lab.bat.' }
    if ($result.ExitCode -ne 0) {
        if ($data.PSObject.Properties.Name -contains 'error') { throw [string]$data.error }
        throw 'The VM rejected the lab operation.'
    }
    return $data
}
function New-AcademySession([bool]$LabEnabled, [string]$KeyPath, [string]$VBox) {
    return @{ Code = (New-AcademySecret 6); Token = (New-AcademySecret 32); Failures = 0;
              Expires = [DateTime]::UtcNow.AddHours(12); LabEnabled = $LabEnabled;
              KeyPath = $KeyPath; VBox = $VBox; Paired = $false }
}
function Get-AcademyRoute([string]$Method, [string]$Path, [string]$HostHeader,
                          [string]$Origin, [string]$Authorization, [string]$Body, [hashtable]$Session) {
    $reply = @{ Status = 200; Data = @{}; Cors = $false }
    if ($HostHeader -cne '127.0.0.1:8765') { $reply.Status = 403; return $reply }
    $allowedOrigin = 'https://veribatum.github.io'
    if ($Origin -and $Origin -cne $allowedOrigin) { $reply.Status = 403; return $reply }
    $reply.Cors = ($Origin -ceq $allowedOrigin)
    $paths = @('/health', '/vm/status', '/pair', '/lab/status', '/lab/deploy', '/lab/verify', '/lab/reset')
    if ($paths -cnotcontains $Path) { $reply.Status = 404; return $reply }
    if ($Method -ceq 'OPTIONS') { $reply.Status = 204; if (-not $reply.Cors) { $reply.Status = 403 }; return $reply }
    $readOnly = @('/health', '/vm/status') -ccontains $Path
    if ($readOnly) {
        if ($Method -cne 'GET') { $reply.Status = 405; return $reply }
        if ($Path -ceq '/health') { $reply.Data = @{ connected = $true; app = 'Nerd Nova Academy'; version = 2; mode = 'restricted-lab'; canPair = $Session.LabEnabled } }
        else { $reply.Data = Get-AcademyVMStatus $Session.VBox }
        return $reply
    }
    if (-not $reply.Cors) { $reply.Status = 403; return $reply }
    if ([DateTime]::UtcNow -gt $Session.Expires -or -not $Session.LabEnabled) {
        $reply.Status = 403; $reply.Data = @{ error = 'Lab control is not enabled for this companion session.' }; return $reply
    }
    if ($Path -ceq '/pair') {
        if ($Method -cne 'POST') { $reply.Status = 405; return $reply }
        if ($Session.Failures -ge 5) { $reply.Status = 429; $reply.Data = @{ error = 'Pairing locked. Restart the companion.' }; return $reply }
        try { $inputData = $Body | ConvertFrom-Json; $code = [string]$inputData.code } catch { $code = '' }
        if (-not (Test-AcademySecret $code.ToLowerInvariant() $Session.Code)) {
            $Session.Failures++; $reply.Status = 401; $reply.Data = @{ error = 'Pairing code does not match the companion console.' }; return $reply
        }
        $Session.Paired = $true
        $reply.Data = @{ token = $Session.Token; expires = $Session.Expires.ToString('o'); target = 'nova-academy' }
        return $reply
    }
    if (-not $Session.Paired -or -not (Test-AcademySecret $Authorization ('Bearer ' + $Session.Token))) {
        $reply.Status = 401; $reply.Data = @{ error = 'Pair this browser with the local companion first.' }; return $reply
    }
    $op = $Path.Substring(5)
    if (($op -ceq 'status' -and $Method -cne 'GET') -or ($op -cne 'status' -and $Method -cne 'POST')) { $reply.Status = 405; return $reply }
    if ($op -cne 'status') {
        try { $inputData = $Body | ConvertFrom-Json } catch { $reply.Status = 400; return $reply }
        if (-not $inputData -or -not $inputData.PSObject.Properties['mission'] -or $inputData.mission -cne 'rhel-link' -or @($inputData.PSObject.Properties).Count -ne 1) {
            $reply.Status = 400; $reply.Data = @{ error = 'Only the fixed rhel-link mission is authorized.' }; return $reply
        }
    }
    try { $reply.Data = Invoke-AcademyLab $op $Session.KeyPath }
    catch { $reply.Status = 503; $reply.Data = @{ error = $_.Exception.Message; verified = $false } }
    return $reply
}
