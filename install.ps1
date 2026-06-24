# Honey one-line installer (Windows PowerShell 5.1+).
#   irm https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.ps1 | iex
# To pass flags, clone and run bin/install.js directly (see INSTALL.md).
$ErrorActionPreference = "Stop"

$Repo = "https://github.com/Green-PT/honey-for-devs"
$Dest = Join-Path $HOME ".honey-src"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Honey needs Node.js on your PATH. Install Node, then re-run."
  exit 1
}

if (Get-Command git -ErrorAction SilentlyContinue) {
  # Throwaway cache: force it to origin/main. `pull --ff-only` aborts on
  # divergence and leaves stale code (missing newly-added agents), so reset
  # hard and reclone if the fetch/reset fails.
  $ok = $false
  if (Test-Path (Join-Path $Dest ".git")) {
    git -C $Dest fetch --depth 1 --quiet origin main
    if ($LASTEXITCODE -eq 0) {
      git -C $Dest reset --hard --quiet FETCH_HEAD
      $ok = ($LASTEXITCODE -eq 0)
    }
  }
  if (-not $ok) {
    if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
    git clone --depth 1 --quiet "$Repo.git" $Dest
  }
} else {
  Write-Host "git not found - downloading zip..."
  if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
  $zip = Join-Path $env:TEMP "honey.zip"
  Invoke-WebRequest -UseBasicParsing "$Repo/archive/refs/heads/main.zip" -OutFile $zip
  Expand-Archive -Force $zip $env:TEMP
  Move-Item -Force (Join-Path $env:TEMP "honey-for-devs-main") $Dest
}

node (Join-Path $Dest "bin/install.js") @args
