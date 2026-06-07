import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DEFAULT_INITIAL_SUPPLY = 1_000_000n * 10n ** 18n;

export default buildModule("MiniDEXModule", (m) => {
    const initialSupply = m.getParameter("initialSupply", DEFAULT_INITIAL_SUPPLY);
    const tokenA = m.contract("TokenA", [initialSupply]);
    const tokenB = m.contract("TokenB", [initialSupply]);
    const miniDEX = m.contract("MiniDEX", [tokenA, tokenB]);

    return { tokenA, tokenB, miniDEX };
});
