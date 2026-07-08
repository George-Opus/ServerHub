param(
    [Parameter(Mandatory = $true)][string]$ServerIp,
    [Parameter(Mandatory = $true)][string]$SshUser,
    [Parameter(Mandatory = $true)][string]$DeployPath,
    [Parameter(Mandatory = $true)][string]$SshKeyPath,
    [int]$SshPort = 22
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not (Test-Path $SshKeyPath)) {
    throw "SSH key not found: $SshKeyPath"
}

$sshBase = @("-i", $SshKeyPath, "-p", "$SshPort", "-o", "StrictHostKeyChecking=accept-new")
$remote = "${SshUser}@${ServerIp}"

$secretKey = [Convert]::ToBase64String((1..36 | ForEach-Object { Get-Random -Maximum 256 }))
$envContent = "SECRET_KEY=$secretKey`nCORS_ORIGINS=http://${ServerIp}:3000`nNEXT_PUBLIC_API_URL=http://${ServerIp}:8000"

Write-Host "==> Creating deploy directory on server..."
& ssh @sshBase $remote "mkdir -p $DeployPath"

Write-Host "==> Uploading project files..."
$tarPath = Join-Path $env:TEMP "serverhub-deploy.tar.gz"

Push-Location $ProjectRoot
& tar --exclude=".git" --exclude="node_modules" --exclude=".venv" --exclude="data" --exclude=".next" -czf $tarPath .
Pop-Location

& scp @sshBase $tarPath "${remote}:${DeployPath}/serverhub.tar.gz"
Remove-Item $tarPath -Force

Write-Host "==> Extracting and configuring on server..."
$envFile = Join-Path $env:TEMP "serverhub.env"
Set-Content -Path $envFile -Value $envContent -NoNewline
& scp @sshBase $envFile "${remote}:${DeployPath}/serverhub.env"
Remove-Item $envFile -Force

& ssh @sshBase $remote "set -e; cd $DeployPath; rm -rf serverhub; mkdir -p serverhub; tar -xzf serverhub.tar.gz -C serverhub; rm serverhub.tar.gz; mv serverhub.env serverhub/.env; chmod +x serverhub/deploy/remote-setup.sh; cd serverhub; bash deploy/remote-setup.sh"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " ServerHub deploye avec succes !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host " Interface : http://${ServerIp}:3000"
Write-Host " API docs  : http://${ServerIp}:8000/docs"
Write-Host ""
