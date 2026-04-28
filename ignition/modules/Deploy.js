import { buildModule }from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MiniDEXModule", (m)=> {
    // Deploy tokens
    const tokenA = m.contract("TokenA");
    const tokenB = m.contract("TokenB");

    // Deploy DEX with token addresses
    const miniDEX = m.contract("MiniDEX", [tokenA, tokenB]);

    return { tokenA, tokenB, miniDEX };
});