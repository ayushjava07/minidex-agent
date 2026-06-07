import { expect } from "chai";
import hardhat from "hardhat";
import { MINIDEX_ABI } from "../frontend/src/contracts.js";

const { artifacts, ethers } = hardhat;

describe("Frontend MiniDEX ABI", function () {
  it("only exposes functions implemented by the MiniDEX contract", async function () {
    const artifact = await artifacts.readArtifact("MiniDEX");
    const contractInterface = new ethers.Interface(artifact.abi);
    const frontendInterface = new ethers.Interface(MINIDEX_ABI);

    for (const fragment of frontendInterface.fragments) {
      if (fragment.type !== "function") continue;

      expect(
        () => contractInterface.getFunction(fragment.format("sighash")),
        `Missing contract function: ${fragment.format("sighash")}`
      ).not.to.throw();
    }
  });

  it("uses the token-address based swap signature", function () {
    const frontendInterface = new ethers.Interface(MINIDEX_ABI);

    expect(frontendInterface.getFunction("swap").format("sighash")).to.equal(
      "swap(address,uint256)"
    );
    expect(frontendInterface.getFunction("swapAforB")).to.equal(null);
    expect(frontendInterface.getFunction("swapBforA")).to.equal(null);
  });
});
