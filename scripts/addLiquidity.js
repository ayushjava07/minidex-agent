import { ethers } from "ethers";
import "dotenv/config";

const {
    RPC_URL,
    SEPOLIA_PRIVATE_KEY,
    TOKEN_A,
    TOKEN_B,
    DEX_ADDRESS,
    LIQUIDITY_AMOUNT = "1000",
} = process.env;

const required = { RPC_URL, SEPOLIA_PRIVATE_KEY, TOKEN_A, TOKEN_B, DEX_ADDRESS };
const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);

if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

const ERC20_ABI = [
    "function approve(address spender, uint amount) returns (bool)",
    "function balanceOf(address) view returns (uint)"
];

const DEX_ABI = [
    "function addLiquidity(uint amountA, uint amountB) external",
    "function getReserves() view returns (uint, uint)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(SEPOLIA_PRIVATE_KEY, provider);

    const tokenA = new ethers.Contract(TOKEN_A, ERC20_ABI, wallet);
    const tokenB = new ethers.Contract(TOKEN_B, ERC20_ABI, wallet);
    const dex = new ethers.Contract(DEX_ADDRESS, DEX_ABI, wallet);

    const amount = ethers.parseEther(LIQUIDITY_AMOUNT);

    console.log("Approving TokenA...");
    await (await tokenA.approve(DEX_ADDRESS, amount)).wait();

    console.log("Approving TokenB...");
    await (await tokenB.approve(DEX_ADDRESS, amount)).wait();

    console.log("Adding liquidity...");
    await (await dex.addLiquidity(amount, amount)).wait();

    const [resA,resB]= await dex.getReserves();
    console.log("✅ Liquidity Added!");
    console.log("ReserveA:", ethers.formatEther(resA));
    console.log("ReserveB:", ethers.formatEther(resB));
}

main().catch((error) => {
    console.error(`[addLiquidity] ${error.message}`);
    process.exitCode = 1;
});
