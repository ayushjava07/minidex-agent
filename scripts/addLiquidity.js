import { ethers } from "ethers";
import "dotenv/config";
import { loadLiquidityConfig } from "../config/env.js";

const ERC20_ABI = [
    "function approve(address spender, uint amount) returns (bool)",
    "function balanceOf(address) view returns (uint)"
];

const DEX_ABI = [
    "function addLiquidity(uint amountA, uint amountB) external",
    "function getReserves() view returns (uint, uint)"
];

async function main() {
    const config = loadLiquidityConfig();
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(config.privateKey, provider);

    const tokenA = new ethers.Contract(config.tokenA, ERC20_ABI, wallet);
    const tokenB = new ethers.Contract(config.tokenB, ERC20_ABI, wallet);
    const dex = new ethers.Contract(config.dexAddress, DEX_ABI, wallet);

    const amount = ethers.parseEther(config.liquidityAmount);

    console.log("Approving TokenA...");
    await (await tokenA.approve(config.dexAddress, amount)).wait();

    console.log("Approving TokenB...");
    await (await tokenB.approve(config.dexAddress, amount)).wait();

    console.log("Adding liquidity...");
    await (await dex.addLiquidity(amount, amount)).wait();

    const [resA, resB] = await dex.getReserves();
    console.log("Liquidity Added!");
    console.log("ReserveA:", ethers.formatEther(resA));
    console.log("ReserveB:", ethers.formatEther(resB));
}

main().catch((error) => {
    console.error(`[addLiquidity] ${error.message}`);
    process.exitCode = 1;
});
