// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MiniDEX {
    IERC20 public tokenA;
    IERC20 public tokenB;
    uint public reserveA;
    uint public reserveB;

    event LiquidityAdded(uint amountA, uint amountB);
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
        emit LiquidityAdded(amountA, amountB);
    }

    // Swap A for B
    function swapAforB(uint amountA) external {
        require(amountA > 0, "Amount must be > 0");
        uint amountB = getAmountOut(amountA, reserveA, reserveB);
        require(amountB > 0, "Insufficient output");
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transfer(msg.sender, amountB);
        reserveA += amountA;
        reserveB -= amountB;
        emit Swapped(msg.sender, amountA, amountB);
    }

    // Swap B for A
    function swapBforA(uint amountB) external {
        require(amountB > 0, "Amount must be > 0");
        uint amountA = getAmountOut(amountB, reserveB, reserveA);
        require(amountA > 0, "Insufficient output");
        tokenB.transferFrom(msg.sender, address(this), amountB);
        tokenA.transfer(msg.sender, amountA);
        reserveB += amountB;
        reserveA -= amountA;
        emit Swapped(msg.sender, amountB, amountA);
    }

    // Remove Liquidity
    function removeLiquidity(uint amountA, uint amountB) external {
        require(reserveA >= amountA, "Not enough A");
        require(reserveB >= amountB, "Not enough B");
        reserveA -= amountA;
        reserveB -= amountB;
        tokenA.transfer(msg.sender, amountA);
        tokenB.transfer(msg.sender, amountB);
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