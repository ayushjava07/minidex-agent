export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)"
];

export const MINIDEX_ABI = [
  "function addLiquidity(uint256 amountA, uint256 amountB) external",
  "function swap(address tokenIn, uint256 amountIn) external",
  "function removeLiquidity(uint256 amountA, uint256 amountB) external",
  "function getReserves() external view returns (uint256, uint256)"
];
