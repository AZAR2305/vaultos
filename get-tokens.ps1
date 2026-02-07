# Yellow Network Testnet Token Faucet
# Run this script to request ytest.usd tokens

Write-Host "`n💰 Yellow Network Testnet Token Request`n" -ForegroundColor Cyan
Write-Host ("=" * 70)

# Load wallet address from .env file
$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    $privateKey = (Get-Content $envPath | Where-Object { $_ -like "PRIVATE_KEY=*" } | ForEach-Object { $_.Split('=')[1] })
    
    if ($privateKey) {
        # Use Node.js to derive address from private key
        $address = node -e "const { privateKeyToAccount } = require('viem/accounts'); console.log(privateKeyToAccount('$privateKey').address);"
        
        Write-Host "📍 Wallet: $address`n" -ForegroundColor Green
        
        Write-Host "🔄 Requesting tokens from faucet...`n"
        
        # Try API request
        try {
            $body = @{
                address = $address
                chain_id = 84532
                token = "ytest.usd"
            } | ConvertTo-Json
            
            $response = Invoke-WebRequest `
                -Uri "https://earn-ynetwork.yellownetwork.io/api/faucet" `
                -Method POST `
                -ContentType "application/json" `
                -Body $body `
                -ErrorAction Stop
            
            Write-Host "✅ Request successful!`n" -ForegroundColor Green
            Write-Host "Response:" ($response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10)
            
            Write-Host "`n⏰ Wait 1-2 minutes for tokens to arrive`n"
            Write-Host "Then check your balance: npm run check:yellow`n"
            
        } catch {
            Write-Host "⚠️  API request failed: $($_.Exception.Message)`n" -ForegroundColor Yellow
            
            Write-Host "📝 Alternative: Use the web interface`n"
            Write-Host "🌐 Visit: https://earn-ynetwork.yellownetwork.io`n" -ForegroundColor Cyan
            Write-Host "Steps:"
            Write-Host "  1. Paste address: $address"
            Write-Host "  2. Select network: Base Sepolia"
            Write-Host "  3. Select token: ytest.usd"
            Write-Host "  4. Click 'Request Tokens'`n"
            
            Write-Host "🔗 Or try these Base Sepolia ETH faucets:"
            Write-Host "  • https://www.alchemy.com/faucets/base-sepolia"
            Write-Host "  • https://docs.base.org/tools/network-faucets`n"
            
            # Open browser automatically
            $openBrowser = Read-Host "Open faucet in browser? (y/n)"
            if ($openBrowser -eq 'y') {
                Start-Process "https://earn-ynetwork.yellownetwork.io"
            }
        }
    } else {
        Write-Host "❌ PRIVATE_KEY not found in .env file`n" -ForegroundColor Red
    }
} else {
    Write-Host "❌ .env file not found`n" -ForegroundColor Red
}

Write-Host "`n" ("=" * 70)
