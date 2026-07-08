param(
    [Parameter(Mandatory = $true)][string]$KubeConfigPath,
    [string]$Context = "",
    [string]$PublicUrl = "http://149.202.84.198",
    [string]$NodeName = "ovhgrapmx01"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not (Test-Path $KubeConfigPath)) {
    throw "Kubeconfig not found: $KubeConfigPath"
}

$env:KUBECONFIG = $KubeConfigPath

Write-Host "==> Cluster"
if ($Context) { kubectl config use-context $Context }
kubectl cluster-info
kubectl get nodes

Write-Host "==> Building images"
Push-Location $ProjectRoot
docker build -t serverhub-api:local ./apps/api
docker build -t serverhub-web:local --build-arg "NEXT_PUBLIC_API_URL=$PublicUrl" ./apps/web
Pop-Location

$apiTar = Join-Path $env:TEMP "serverhub-api.tar"
$webTar = Join-Path $env:TEMP "serverhub-web.tar"
docker save serverhub-api:local -o $apiTar
docker save serverhub-web:local -o $webTar

Write-Host "==> Namespace + secrets"
kubectl create namespace serverhub --dry-run=client -o yaml | kubectl apply -f -

$secretKey = kubectl -n serverhub get secret serverhub-secrets -o jsonpath='{.data.SECRET_KEY}' 2>$null
if ($secretKey) {
    $secretKey = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($secretKey))
    Write-Host "==> Reusing existing SECRET_KEY"
} else {
    $secretKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
    Write-Host "==> Creating new SECRET_KEY"
}

$fernetKey = kubectl -n serverhub get secret serverhub-secrets -o jsonpath='{.data.FERNET_KEY}' 2>$null
if ($fernetKey) {
    $fernetKey = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($fernetKey))
    Write-Host "==> Reusing existing FERNET_KEY"
} else {
    $fernetKey = docker run --rm serverhub-api:local python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    Write-Host "==> Creating new FERNET_KEY"
}

kubectl -n serverhub create secret generic serverhub-secrets `
    --from-literal=SECRET_KEY=$secretKey `
    --from-literal=FERNET_KEY=$fernetKey `
    --dry-run=client -o yaml | kubectl apply -f -

kubectl -n serverhub create configmap serverhub-config `
    --from-literal=CORS_ORIGINS=$PublicUrl `
    --from-literal=DATABASE_URL="sqlite:///./data/serverhub.db" `
    --dry-run=client -o yaml | kubectl apply -f -

Write-Host "==> Importing images into k3s node ($NodeName)"
kubectl -n serverhub delete pod image-importer --ignore-not-found=true
kubectl apply -f (Join-Path $ProjectRoot "deploy/k8s/image-importer-pod.yaml")
kubectl -n serverhub wait --for=condition=Ready pod/image-importer --timeout=120s

$tempDir = $env:TEMP
Push-Location $tempDir
& kubectl cp ".\serverhub-api.tar" "serverhub/image-importer:/host-import/api.tar"
& kubectl cp ".\serverhub-web.tar" "serverhub/image-importer:/host-import/web.tar"
Pop-Location

kubectl -n serverhub exec image-importer -- sh -c "nsenter -t 1 -m -u -i -n -- k3s ctr images import /tmp/serverhub-import/api.tar"
kubectl -n serverhub exec image-importer -- sh -c "nsenter -t 1 -m -u -i -n -- k3s ctr images import /tmp/serverhub-import/web.tar"
kubectl -n serverhub delete pod image-importer --ignore-not-found=true

Remove-Item $apiTar, $webTar -Force

Write-Host "==> Applying manifests"
kubectl apply -k (Join-Path $ProjectRoot "deploy/k8s")

Write-Host "==> Restarting deployments to load new images"
kubectl -n serverhub rollout restart deployment/serverhub-api deployment/serverhub-web

Write-Host "==> Waiting for rollouts"
kubectl -n serverhub rollout status deployment/serverhub-api --timeout=180s
kubectl -n serverhub rollout status deployment/serverhub-web --timeout=180s

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " ServerHub deploye sur Kubernetes !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host " Interface : $PublicUrl"
Write-Host " API docs  : $PublicUrl/api/docs"
Write-Host ""
kubectl -n serverhub get pods,svc,ingress
