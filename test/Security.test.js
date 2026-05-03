import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("MiniDEX Security & Edge Cases", function () {
  let tokenA, tokenB, dex;
  let owner, user1, user2;
  const initialSupply = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const TokenA = await ethers.getContractFactory("TokenA");
    tokenA = await TokenA.deploy(initialSupply);
    const TokenB = await ethers.getContractFactory("TokenB");
    tokenB = await TokenB.deploy(initialSupply);
    const MiniDEX = await ethers.getContractFactory("MiniDEX");
    dex = await MiniDEX.deploy(await tokenA.getAddress(), await tokenB.getAddress());

    // Provide tokens to user1
    await tokenA.transfer(user1.address, ethers.parseEther("1000"));
    await tokenB.transfer(user1.address, ethers.parseEther("1000"));
  });

  describe("Liquidity Management", function () {
    it("Should allow ANYONE to remove liquidity (Design Observation)", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("100");

      // User1 adds liquidity
      await tokenA.connect(user1).approve(await dex.getAddress(), amountA);
      await tokenB.connect(user1).approve(await dex.getAddress(), amountB);
      await dex.connect(user1).addLiquidity(amountA, amountB);

      // User2 (who added nothing) removes liquidity
      const user2InitialA = await tokenA.balanceOf(user2.address);
      const user2InitialB = await tokenB.balanceOf(user2.address);

      await dex.connect(user2).removeLiquidity(amountA, amountB);

      expect(await tokenA.balanceOf(user2.address)).to.equal(user2InitialA + amountA);
      expect(await tokenB.balanceOf(user2.address)).to.equal(user2InitialB + amountB);
      
      const [resA, resB] = await dex.getReserves();
      expect(resA).to.equal(0);
      expect(resB).to.equal(0);
    });

    it("Should fail to remove more liquidity than available", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("100");

      await tokenA.approve(await dex.getAddress(), amountA);
      await tokenB.approve(await dex.getAddress(), amountB);
      await dex.addLiquidity(amountA, amountB);

      await expect(
          dex.removeLiquidity(amountA + 1n, amountB)
      ).to.be.revertedWith("Not enough A");

      await expect(
          dex.removeLiquidity(amountA, amountB + 1n)
      ).to.be.revertedWith("Not enough B");
    });
  });

  describe("Swap Edge Cases", function () {
    it("Should handle extremely large swaps without draining reserves", async function () {
      const liqA = ethers.parseEther("100");
      const liqB = ethers.parseEther("100");
      await tokenA.approve(await dex.getAddress(), liqA);
      await tokenB.approve(await dex.getAddress(), liqB);
      await dex.addLiquidity(liqA, liqB);

      // AmountIn = half of total supply, much larger than liqA
      const largeIn = initialSupply / 2n; 
      await tokenA.transfer(user1.address, largeIn);
      await tokenA.connect(user1).approve(await dex.getAddress(), largeIn);
      
      const amountOut = await dex.getAmountOut(largeIn, liqA, liqB);
      // Even with huge input, amountOut must be less than liqB due to x*y=k formula
      expect(amountOut).to.be.below(liqB);
      
      await expect(dex.connect(user1).swap(await tokenA.getAddress(), largeIn)).to.not.be.reverted;
      
      const [resA, resB] = await dex.getReserves();
      expect(resB).to.be.above(0);
      expect(resA).to.equal(liqA + largeIn);
    });

    it("Should handle multiple swaps correctly", async function () {
        const liqA = ethers.parseEther("1000");
        const liqB = ethers.parseEther("1000");
        await tokenA.approve(await dex.getAddress(), liqA);
        await tokenB.approve(await dex.getAddress(), liqB);
        await dex.addLiquidity(liqA, liqB);

        const amountIn = ethers.parseEther("10");
        for(let i=0; i<5; i++) {
            await tokenA.connect(user1).approve(await dex.getAddress(), amountIn);
            await dex.connect(user1).swap(await tokenA.getAddress(), amountIn);
        }

        const [resA, resB] = await dex.getReserves();
        expect(resA).to.equal(liqA + amountIn * 5n);
        expect(resB).to.be.below(liqB);
    });
  });
});
