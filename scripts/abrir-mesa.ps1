# Liga a mesa online (https://meutabletop.com) neste PC: banco (Docker), servidor,
# app compilado e túnel do Cloudflare. Cada um abre numa guia da janela "mesa" do
# Windows Terminal (sem ele, em janelas separadas); o que já estiver rodando é
# pulado. Atalho: "Abrir mesa" na Área de Trabalho (abre esta guia nessa janela).

$pasta = Split-Path $PSScriptRoot -Parent
$site = 'https://meutabletop.com'
$host.UI.RawUI.WindowTitle = 'Abrir mesa'

function Passo($texto) { Write-Host "`n> $texto" -ForegroundColor Cyan }
function Ok($texto) { Write-Host "  $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "  $texto" -ForegroundColor Yellow }
function PortaEmUso($porta) { [bool](Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue) }

$terminal = Get-Command wt -ErrorAction SilentlyContinue

function AbrirGuia($titulo, $comando) {
    if ($terminal) {
        # -w mesa: todas as guias na mesma janela do Windows Terminal
        Start-Process wt -ArgumentList "-w mesa new-tab --title $titulo --suppressApplicationTitle -d `"$pasta`" powershell -NoExit -Command $comando"
    } else {
        Start-Process powershell -WorkingDirectory $pasta -ArgumentList @(
            '-NoExit', '-Command', "`$host.UI.RawUI.WindowTitle = '$titulo'; $comando"
        )
    }
}

Write-Host '==== Meu Tabletop ====' -ForegroundColor Cyan

# 1. VPN: o túnel usa a porta 7844, que a VPN (Cisco AnyConnect) bloqueia
Passo 'VPN'
while (Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.InterfaceDescription -like '*AnyConnect*' }) {
    Aviso 'A VPN está ligada e o túnel não conecta com ela.'
    Read-Host '  Desligue a VPN e aperte Enter'
}
Ok 'desligada'

# 2. Banco de dados (Postgres no Docker)
Passo 'Banco de dados (Docker)'
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Aviso 'abrindo o Docker Desktop...'
    Start-Process "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
    $limite = (Get-Date).AddMinutes(3)
    do { Start-Sleep 3; docker info *> $null } while ($LASTEXITCODE -ne 0 -and (Get-Date) -lt $limite)
    if ($LASTEXITCODE -ne 0) { Aviso 'o Docker não abriu em 3 minutos. Abra o Docker Desktop e rode este atalho de novo.'; Read-Host '  Enter para fechar'; exit 1 }
}
docker compose -f "$pasta\docker-compose.yml" up -d db *> $null
$limite = (Get-Date).AddMinutes(2)
do { Start-Sleep 2; $saude = docker inspect -f '{{.State.Health.Status}}' virtual-tabletop-de-rpg--db-1 2>$null } while ($saude -ne 'healthy' -and (Get-Date) -lt $limite)
if ($saude -ne 'healthy') { Aviso 'o banco não ficou pronto. Veja o container no Docker Desktop.'; Read-Host '  Enter para fechar'; exit 1 }
Ok 'pronto'

# 3. Servidor, app compilado e túnel, cada um na sua guia
Passo 'Servidor (porta 3001)'
if (PortaEmUso 3001) { Ok 'já estava rodando' } else { AbrirGuia 'Servidor' 'npm run dev:server'; Ok 'abrindo...' }

Passo 'Mesa compilada (porta 4173)'
if (PortaEmUso 4173) { Ok 'já estava rodando' } else { AbrirGuia 'Mesa' 'npm run mesa'; Ok 'compilando e abrindo...' }

Passo 'Túnel (meutabletop.com)'
if (Get-Process cloudflared -ErrorAction SilentlyContinue) { Ok 'já estava rodando' } else { AbrirGuia 'Tunel' 'npm run tunel'; Ok 'conectando...' }

# 4. Espera o site responder e abre no navegador
Passo "Esperando $site responder"
$limite = (Get-Date).AddMinutes(3)
$noAr = $false
while (-not $noAr -and (Get-Date) -lt $limite) {
    try { Invoke-WebRequest "$site/api/health" -UseBasicParsing -TimeoutSec 5 | Out-Null; $noAr = $true } catch { Start-Sleep 3 }
}
if ($noAr) {
    Ok 'no ar!'
    Start-Process $site
    Write-Host "`nPronto. Pode fechar esta guia; deixe as guias Servidor, Mesa e Tunel abertas durante a sessão." -ForegroundColor Green
    Write-Host 'Para desligar a mesa, feche a janela (ou essas três guias).'
} else {
    Aviso 'o site não respondeu em 3 minutos. Veja as guias Servidor, Mesa e Tunel para o erro.'
}
Read-Host "`nEnter para fechar"
