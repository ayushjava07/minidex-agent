import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("TokenB", function () {
  let TokenB;
  let token;
  let owner;
  let addr1;
  let addr2;
  const initialSupply = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    TokenB = await ethers.getContractFactory("TokenB");
    token = await TokenB.deploy(initialSupply);
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right name", async function () {
      expect(await token.name()).to.equal("TokenB");
    });

    it("Should set the right symbol", async function () {
      expect(await token.symbol()).to.equal("TKNB");
    });

    it("Should assign the total supply to the owner", async function () {
      const ownerBalance = await token.balanceOf(owner.address);
      expect(await token.totalSupply()).to.equal(ownerBalance);
      expect(ownerBalance).to.equal(initialSupply);
    });

    it("Should have 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });
  });

  describe("Transfer", function () {
    it("Should transfer tokens between accounts", async function () {
      const amount = ethers.parseEther("100");
      await token.transfer(addr1.address, amount);
      expect(await token.balanceOf(addr1.address)).to.equal(amount);

      await token.connect(addr1).transfer(addr2.address, amount);
      expect(await token.balanceOf(addr2.address)).to.equal(amount);
    });

    it("Should emit Transfer event", async function () {
      const amount = ethers.parseEther("100");
      await expect(token.transfer(addr1.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, amount);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await token.balanceOf(owner.address);
      await expect(
        token.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");

      expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });

    it("Should fail when transferring to zero address", async function () {
      await expect(
        token.transfer(ethers.ZeroAddress, 100)
      ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
    });

    it("Should allow zero amount transfer", async function () {
      await expect(token.transfer(addr1.address, 0)).to.not.be.reverted;
      expect(await token.balanceOf(addr1.address)).to.equal(0);
    });

    it("Should transfer full balance", async function () {
      const balance = await token.balanceOf(owner.address);
      await token.transfer(addr1.address, balance);
      expect(await token.balanceOf(owner.address)).to.equal(0);
      expect(await token.balanceOf(addr1.address)).to.equal(balance);
    });

    it("Should handle self-transfer", async function () {
      const amount = ethers.parseEther("100");
      const initialBalance = await token.balanceOf(owner.address);
      await token.transfer(owner.address, amount);
      expect(await token.balanceOf(owner.address)).to.equal(initialBalance);
    });
  });

  describe("Allowances", function () {
    it("Should set allowance and emit Approval event", async function () {
      const amount = ethers.parseEther("100");
      await expect(token.approve(addr1.address, amount))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, amount);
      
      expect(await token.allowance(owner.address, addr1.address)).to.equal(amount);
    });

    it("Should overwrite allowance", async function () {
      await token.approve(addr1.address, 100);
      await token.approve(addr1.address, 200);
      expect(await token.allowance(owner.address, addr1.address)).to.equal(200);
    });

    it("Should transfer tokens via transferFrom", async function () {
      const amount = ethers.parseEther("100");
      await token.approve(addr1.address, amount);
      await token.connect(addr1).transferFrom(owner.address, addr2.address, amount);
      
      expect(await token.balanceOf(addr2.address)).to.equal(amount);
      expect(await token.allowance(owner.address, addr1.address)).to.equal(0);
    });

    it("Should reduce allowance after transferFrom", async function () {
      const amount = ethers.parseEther("100");
      const transferAmount = ethers.parseEther("40");
      await token.approve(addr1.address, amount);
      await token.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount);
      
      expect(await token.allowance(owner.address, addr1.address)).to.equal(amount - transferAmount);
    });

    it("Should fail transferFrom if allowance is exceeded", async function () {
      await token.approve(addr1.address, 100);
      await expect(
        token.connect(addr1).transferFrom(owner.address, addr2.address, 101)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("Should fail transferFrom with no approval", async function () {
      await expect(
        token.connect(addr1).transferFrom(owner.address, addr2.address, 1)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });
  });
});
