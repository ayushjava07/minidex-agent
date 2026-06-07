// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MiniDEX {
    IERC20 public tokenA;
    IERC20 public tokenB;
    uint public reserveA;
    uint public reserveB;
    mapping(address => uint) public liquidityA;
    mapping(address => uint) public liquidityB;

    event LiquidityAdded(uint amountA, uint amountB);
    event LiquidityRemoved(address indexed provider, uint amountA, uint amountB);
    event Swapped(address user, uint amountIn, uint amountOut);

    constructor(address _tokenA, address _tokenB) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    // Add Liquidity
    function addLiquidity(uint amountA, uint amountB) external {
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);
        reserveA += amountA;
        reserveB += amountB;
        liquidityA[msg.sender] += amountA;
        liquidityB[msg.sender] += amountB;
        emit LiquidityAdded(amountA, amountB);
    }

    // Swap tokens
    function swap(address tokenIn, uint256 amountIn) external {
        require(amountIn > 0, "Amount must be > 0");
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "Invalid token");

        bool isTokenA = tokenIn == address(tokenA);
        (IERC20 tokenFrom, IERC20 tokenTo) = isTokenA ? (tokenA, tokenB) : (tokenB, tokenA);
        (uint256 reserveFrom, uint256 reserveTo) = isTokenA ? (reserveA, reserveB) : (reserveB, reserveA);

        uint256 amountOut = getAmountOut(amountIn, reserveFrom, reserveTo);
        require(amountOut > 0, "Insufficient output");

        tokenFrom.transferFrom(msg.sender, address(this), amountIn);
        tokenTo.transfer(msg.sender, amountOut);

        if (isTokenA) {
            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            reserveB += amountIn;
            reserveA -= amountOut;
        }
        
        emit Swapped(msg.sender, amountIn, amountOut);
    }

    // Remove Liquidity
    function removeLiquidity(uint amountA, uint amountB) external {
        require(liquidityA[msg.sender] >= amountA, "Insufficient liquidity A");
        require(liquidityB[msg.sender] >= amountB, "Insufficient liquidity B");
        require(reserveA >= amountA, "Not enough A");
        require(reserveB >= amountB, "Not enough B");
        liquidityA[msg.sender] -= amountA;
        liquidityB[msg.sender] -= amountB;
        reserveA -= amountA;
        reserveB -= amountB;
        tokenA.transfer(msg.sender, amountA);
        tokenB.transfer(msg.sender, amountB);
        emit LiquidityRemoved(msg.sender, amountA, amountB);
    }

    // AMM formula x*y=k
    function getAmountOut(
        uint amountIn,
        uint reserveIn,
        uint reserveOut
    ) public pure returns (uint) {
        require(reserveIn > 0 && reserveOut > 0, "Invalid reserves");
        return (amountIn * reserveOut) / (reserveIn + amountIn);
    }

    // Get reserves
    function getReserves() external view returns (uint, uint) {
        return (reserveA, reserveB);
    }
}
