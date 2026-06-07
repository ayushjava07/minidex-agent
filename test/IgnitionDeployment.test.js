import { expect } from "chai";
import hardhat from "hardhat";
import DeployModule from "../ignition/modules/Deploy.js";

const { ethers, ignition } = hardhat;

describe("Ignition deployment", function () {
  it("deploys funded tokens and wires them into MiniDEX", async function () {
    const [deployer] = await ethers.getSigners();
    const expectedSupply = ethers.parseEther("1000000");
    const { tokenA, tokenB, miniDEX } = await ignition.deploy(DeployModule);

    expect(await tokenA.totalSupply()).to.equal(expectedSupply);
    expect(await tokenB.totalSupply()).to.equal(expectedSupply);
    expect(await tokenA.balanceOf(deployer.address)).to.equal(expectedSupply);
    expect(await tokenB.balanceOf(deployer.address)).to.equal(expectedSupply);
    expect(await miniDEX.tokenA()).to.equal(await tokenA.getAddress());
    expect(await miniDEX.tokenB()).to.equal(await tokenB.getAddress());
  });
});
