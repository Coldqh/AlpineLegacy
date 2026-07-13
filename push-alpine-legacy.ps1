$ErrorActionPreference = "Stop"

Set-Location "C:\AlpineLegacy"

if (-not (Test-Path ".git")) {
    git init
}

git branch -M main

$origin = git remote 2>$null | Select-String '^origin$'
if ($origin) {
    git remote set-url origin "https://github.com/Coldqh/AlpineLegacy.git"
} else {
    git remote add origin "https://github.com/Coldqh/AlpineLegacy.git"
}

if (-not (git config user.name)) {
    git config user.name "Coldqh"
}

if (-not (git config user.email)) {
    git config user.email "coldqh@users.noreply.github.com"
}

git add .

$changes = git status --porcelain
if ($changes) {
    git commit -m "feat: release Alpine Legacy v0.1 foundation"
} else {
    Write-Host "Нет новых изменений для коммита."
}

git push -u origin main

Write-Host "Готово: https://github.com/Coldqh/AlpineLegacy"
