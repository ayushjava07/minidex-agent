import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("MiniDEX", function () {
  let TokenA, TokenB, MiniDEX;
  let tokenA, tokenB, dex;
  let owner, user;
  const initialSupply = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    TokenA = await ethers.getContractFactory("TokenA");
    tokenA = await TokenA.deploy(initialSupply);
    await tokenA.waitForDeployment();

    TokenB = await ethers.getContractFactory("TokenB");
    tokenB = await TokenB.deploy(initialSupply);
    await tokenB.waitForDeployment();

    MiniDEX = await ethers.getContractFactory("MiniDEX");
    dex = await MiniDEX.deploy(await tokenA.getAddress(), await tokenB.getAddress());
    await dex.waitForDeployment();

    // Distribute tokens to user
    await tokenA.transfer(user.address, ethers.parseEther("10000"));
    await tokenB.transfer(user.address, ethers.parseEther("10000"));
  });

  describe("Deployment", function () {
    it("Should store the correct token addresses", async function () {
      expect(await dex.tokenA()).to.equal(await tokenA.getAddress());
      expect(await dex.tokenB()).to.equal(await tokenB.getAddress());
    });

    it("Should start with zero reserves", async function () {
      const [resA, resB] = await dex.getReserves();
      expect(resA).to.equal(0);
      expect(resB).to.equal(0);
    });
  });

  describe("addLiquidity", function () {
    it("Should increase reserves and emit event", async function () {
      const amountA = ethers.parseEther("1000");
      const amountB = ethers.parseEther("1000");

      await tokenA.approve(await dex.getAddress(), amountA);
      await tokenB.approve(await dex.getAddress(), amountB);

      await expect(dex.addLiquidity(amountA, amountB))
        .to.emit(dex, "LiquidityAdded")
        .withArgs(amountA, amountB);

      const [resA, resB] = await dex.getReserves();
      expect(resA).to.equal(amountA);
      expect(resB).to.equal(amountB);
    });

    it("Should fail if tokens are not approved", async function () {
      const amountA = ethers.parseEther("1000");
      const amountB = ethers.parseEther("1000");

      await expect(
        dex.addLiquidity(amountA, amountB)
      ).to.be.revertedWithCustomError(tokenA, "ERC20InsufficientAllowance");
    });
  });

  describe("swap", function () {
    const liqA = ethers.parseEther("1000"); // 1000 A
    const liqB = ethers.parseEther("2000"); // 2000 B (Price A = 2B)

    beforeEach(async function () {
      await tokenA.approve(await dex.getAddress(), liqA);
      await tokenB.approve(await dex.getAddress(), liqB);
      await dex.addLiquidity(liqA, liqB);
    });

    it("Should swap TKNA for TKNB correctly", async function () {
      const amountIn = ethers.parseEther("100");
      // x * y = k => 1000 * 2000 = 2,000,000
      // amountOut = (dx * y) / (x + dx) = (100 * 2000) / (1000 + 100) = 200,000 / 1100 = 181.818...
      const expectedOut = (amountIn * liqB) / (liqA + amountIn);

      await tokenA.connect(user).approve(await dex.getAddress(), amountIn);
      
      const userInitialB = await tokenB.balanceOf(user.address);
      
      await expect(dex.connect(user).swap(await tokenA.getAddress(), amountIn))
        .to.emit(dex, "Swapped")
        .withArgs(user.address, amountIn, expectedOut);

      expect(await tokenB.balanceOf(user.address)).to.equal(userInitialB + expectedOut);
      
      const [resA, resB] = await dex.getReserves();
      expect(resA).to.equal(liqA + amountIn);
      expect(resB).to.equal(liqB - expectedOut);
    });

    it("Should swap TKNB for TKNA correctly", async function () {
      const amountIn = ethers.parseEther("200");
      // amountOut = (200 * 1000) / (2000 + 200) = 200,000 / 2200 = 90.909...
      const expectedOut = (amountIn * liqA) / (liqB + amountIn);

      await tokenB.connect(user).approve(await dex.getAddress(), amountIn);
      
      const userInitialA = await tokenA.balanceOf(user.address);
      
      await expect(dex.connect(user).swap(await tokenB.getAddress(), amountIn))
        .to.emit(dex, "Swapped")
        .withArgs(user.address, amountIn, expectedOut);

      expect(await tokenA.balanceOf(user.address)).to.equal(userInitialA + expectedOut);
      
      const [resA, resB] = await dex.getReserves();
      expect(resB).to.equal(liqB + amountIn);
      expect(resA).to.equal(liqA - expectedOut);
    });

    it("Should maintain x*y=k invariant (ignoring rounding)", async function () {
      const amountIn = ethers.parseEther("500");
      const kInitial = liqA * liqB;

      await tokenA.connect(user).approve(await dex.getAddress(), amountIn);
      await dex.connect(user).swap(await tokenA.getAddress(), amountIn);

      const [resA, resB] = await dex.getReserves();
      const kFinal = resA * resB;

      // kFinal should be >= kInitial because of integer division rounding in favor of the pool
      expect(kFinal).to.be.at.least(kInitial);
      // The difference should be very small (less than the amount out of 1 token due to rounding)
      expect(kFinal - kInitial).to.be.below(resA); 
    });

    it("Should fail on zero amount swap", async function () {
      await expect(
        dex.swap(await tokenA.getAddress(), 0)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should fail on invalid token address", async function () {
      await expect(
        dex.swap(owner.address, 100)
      ).to.be.revertedWith("Invalid token");
    });

    it("Should demonstrate price impact (slippage)", async function () {
      // Small swap: 1 TKNA
      const smallIn = ethers.parseEther("1");
      const smallOut = await dex.getAmountOut(smallIn, liqA, liqB);
      const smallPrice = smallOut / smallIn; // ~2.0

      // Large swap: 500 TKNA (50% of reserveA)
      const largeIn = ethers.parseEther("500");
      const largeOut = await dex.getAmountOut(largeIn, liqA, liqB);
      const largePrice = largeOut / largeIn; // (500*2000)/(1000+500) = 1,000,000 / 1500 = 666.6... / 500 = 1.33...

      expect(largePrice).to.be.below(smallPrice);
    });

    it("Should give ~1:1 price for small swaps in 1:1 pool", async function () {
      // Create 1:1 pool
      const TokenA2 = await ethers.getContractFactory("TokenA");
      const ta = await TokenA2.deploy(initialSupply);
      const TokenB2 = await ethers.getContractFactory("TokenB");
      const tb = await TokenB2.deploy(initialSupply);
      const dex2 = await MiniDEX.deploy(await ta.getAddress(), await tb.getAddress());
      
      const liq = ethers.parseEther("10000");
      await ta.approve(await dex2.getAddress(), liq);
      await tb.approve(await dex2.getAddress(), liq);
      await dex2.addLiquidity(liq, liq);

      const amountIn = ethers.parseEther("1");
      const amountOut = await dex2.getAmountOut(amountIn, liq, liq);
      
      // Expected out = (1 * 10000) / (10000 + 1) = 10000 / 10001 = 0.9999...
      expect(amountOut).to.be.closeTo(amountIn, ethers.parseEther("0.001"));
    });
  });
});
