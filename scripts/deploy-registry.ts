/**
 * Deploy YellowPredictionRegistry to Base Sepolia
 * 
 * This contract acts as a trust anchor for Yellow Network prediction markets.
 * It does NOT hold funds - all value transfer happens off-chain via Yellow.
 */

import { ethers } from "hardhat";

async function main() {
  console.log("\n🚀 ====================================");
  console.log("   Deploy Yellow Prediction Registry");
  console.log("====================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  console.log("⏳ Deploying YellowPredictionRegistry...");
  
  const YellowPredictionRegistry = await ethers.getContractFactory("YellowPredictionRegistry");
  const registry = await YellowPredictionRegistry.deploy();
  
  await registry.waitForDeployment();
  const address = await registry.getAddress();

  console.log("✅ YellowPredictionRegistry deployed!");
  console.log("   Address:", address);
  console.log("   Network: Base Sepolia (84532)");
  console.log("   Explorer: https://sepolia.basescan.org/address/" + address);

  console.log("\n📋 Contract Interface:");
  console.log("   • createMarket(question, expiresAt) → marketId");
  console.log("   • settleMarket(marketId, outcome)");
  console.log("   • markRefundable(marketId)");
  console.log("   • getMarket(marketId) → details");

  console.log("\n💡 Usage in Scripts:");
  console.log("   1. Create market on-chain → get marketId");
  console.log("   2. Run bets off-chain via Yellow Network");
  console.log("   3. Settle on-chain → emit event");
  console.log("   4. Distribute winnings off-chain via Yellow");

  console.log("\n🔗 Next Steps:");
  console.log("   1. Save contract address to .env:");
  console.log(`      REGISTRY_CONTRACT="${address}"`);
  console.log("   2. Verify on BaseScan:");
  console.log(`      npx hardhat verify --network baseSepolia ${address}`);
  console.log("   3. Update market test scripts to use registry");

  console.log("\n✅ Deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
