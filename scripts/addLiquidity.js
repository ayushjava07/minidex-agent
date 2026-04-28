import { ethers } from "ethers";
import * as fs from "fs";

const PRIVATE_KEY = "fb12de85f46fe1bc7b70808b2463c189464e5ac5e1c4d846508d4f349432ad0f";
const RPC_URL = "https://sepolia.infura.io/v3/cdd2389b301e4e1ca23664b3b6290860";

const TOKEN_A = "0x1dE188094d7dEf44aCc4ae61448deF6d5154200d";// paste address
const TOKEN_B = "0xAc6576aeDB3043dF86B50E6288BF673174aE6ffe";// paste address
const DEX     = "0x37b18fA954Fa516eE60f666A01A36AFCF6A59650";// paste address

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
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const tokenA = new ethers.Contract(TOKEN_A,ERC20_ABI, wallet);
    const tokenB = new ethers.Contract(TOKEN_B,ERC20_ABI, wallet);
    const dex    = new ethers.Contract(DEX,DEX_ABI, wallet);

    const amount = ethers.parseEther("1000");

    console.log("Approving TokenA...");
    await (await tokenA.approve(DEX, amount)).wait();

    console.log("Approving TokenB...");
    await (await tokenB.approve(DEX, amount)).wait();

    console.log("Adding liquidity...");
    await (await dex.addLiquidity(amount, amount)).wait();

    const [resA,resB]= await dex.getReserves();
    console.log("✅ Liquidity Added!");
    console.log("ReserveA:", ethers.formatEther(resA));
    console.log("ReserveB:", ethers.formatEther(resB));
}

main();