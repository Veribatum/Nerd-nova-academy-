$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'core.ps1')
$ssh = Join-Path $env:WINDIR 'System32\OpenSSH\ssh.exe'
$scp = Join-Path $env:WINDIR 'System32\OpenSSH\scp.exe'
$keygen = Join-Path $env:WINDIR 'System32\OpenSSH\ssh-keygen.exe'
$tar = Join-Path $env:WINDIR 'System32\tar.exe'
foreach ($tool in @($ssh, $scp, $keygen, $tar)) { if (-not (Test-Path $tool)) { throw "Required Windows tool missing: $tool" } }
$lab = Join-Path (Split-Path $PSScriptRoot -Parent) 'lab'
if (-not (Test-Path (Join-Path $lab 'install-lab.sh'))) { throw 'Extract the full Academy ZIP first. The lab folder must be beside companion.' }
Write-Host 'ENROLL ONLY RHEL 9.8 Vehicle Node / nova-academy'
Write-Host 'This installs a restricted key and root-owned isolated lab helper on jamean@127.0.0.1:2224.'
Write-Host 'It never reconfigures enp0s3, enp0s8, SSH, MPPCS, or GRAMPS.'
if ((Read-Host 'Type INSTALL to continue') -cne 'INSTALL') { exit }
$folder = Join-Path $env:LOCALAPPDATA 'NerdNovaAcademy'
[void](New-Item -ItemType Directory -Path $folder -Force)
$key = Join-Path $folder 'academy_ed25519'
if (-not (Test-Path $key)) {
    $result = Invoke-AcademyProcess $keygen @('-t', 'ed25519', '-f', $key, '-N', '', '-C', 'nerd-nova-restricted-companion')
    if ($result.ExitCode -ne 0) { throw 'Could not create the dedicated Academy key.' }
}
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $key /inheritance:r /grant:r "*${sid}:(F)" '*S-1-5-18:(F)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the Academy private-key file permissions.' }
$stage = Join-Path $env:TEMP ('NerdNova-' + [Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory $stage)
try {
    foreach ($name in @('academy-lab.py', 'academy-gateway', 'install-lab.sh')) { Copy-Item (Join-Path $lab $name) (Join-Path $stage $name) }
    Copy-Item "$key.pub" (Join-Path $stage 'academy.pub')
    $archive = Join-Path $stage 'academy-install.tar'
    & $tar -cf $archive -C $stage academy-lab.py academy-gateway install-lab.sh academy.pub
    if ($LASTEXITCODE -ne 0) { throw 'Could not package the lab installer.' }
    Write-Host 'Enter your existing VM password when SSH asks. Nothing saves it.'
    & $scp -P 2224 -o StrictHostKeyChecking=yes $archive 'jamean@127.0.0.1:academy-install.tar'
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy the reviewed installer to the Vehicle Node.' }
    & $ssh -t -p 2224 -o StrictHostKeyChecking=yes 'jamean@127.0.0.1' 'mkdir -p ~/nerd-nova-academy-lab && tar -xf ~/academy-install.tar -C ~/nerd-nova-academy-lab && cd ~/nerd-nova-academy-lab && sudo bash install-lab.sh'
    if ($LASTEXITCODE -ne 0) { throw 'VM enrollment did not complete.' }
    $ready = Invoke-AcademyLab 'status' $key
    if (-not $ready.installed -or $ready.target -cne 'nova-academy') { throw 'VM enrollment could not be verified.' }
    Write-Host 'ENROLLED. Start start-companion.bat, type ENABLE, and pair the Academy browser.'
} finally { Remove-Item $stage -Recurse -Force }
