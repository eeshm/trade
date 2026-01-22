#!/usr/bin/env pwsh
# Production Secrets Generator
# Run this script to generate secure secrets for production

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Production Secrets Generator" -ForegroundColor Cyan  
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Generate JWT Secret (64 bytes, base64 encoded)
Write-Host "JWT_SECRET:" -ForegroundColor Yellow
$jwtBytes = New-Object byte[] 64
[System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($jwtBytes)
$jwtSecret = [Convert]::ToBase64String($jwtBytes)
Write-Host $jwtSecret -ForegroundColor Green
Write-Host ""

# Generate Database Password (32 characters, alphanumeric)
Write-Host "POSTGRES_PASSWORD:" -ForegroundColor Yellow
$dbBytes = New-Object byte[] 32
[System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($dbBytes)
$dbPassword = [Convert]::ToBase64String($dbBytes).Substring(0, 32) -replace '[^a-zA-Z0-9]', ''
Write-Host $dbPassword -ForegroundColor Green
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Copy these values to your .env file" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
