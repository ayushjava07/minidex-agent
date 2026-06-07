import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import {
    loadDeploymentAddressConfig,
    loadLiquidityConfig,
    loadOptionalSepoliaConfig,
    loadReadOnlyAgentConfig,
} from "../config/env.js";
import { assertNoCommittedSecrets, scanTrackedFiles } from "../scripts/checkSecrets.js";

const VALID_ENV = {
    RPC_URL: "https://rpc.sepolia.example.com/v3/project-id",
    SEPOLIA_PRIVATE_KEY: "1".repeat(64),
    TOKEN_A: "0x1111111111111111111111111111111111111111",
    TOKEN_B: "0x2222222222222222222222222222222222222222",
    DEX_ADDRESS: "0x3333333333333333333333333333333333333333",
    LIQUIDITY_AMOUNT: "1000",
};

function createGitFixture(files) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "minidex-secret-test-"));
    execFileSync("git", ["init", "-q"], { cwd: directory });

    for (const [fileName, content] of Object.entries(files)) {
        const absolutePath = path.join(directory, fileName);
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, content);
    }

    execFileSync("git", ["add", "."], { cwd: directory });
    return directory;
}

describe("Secret management", function () {
    it("loads and normalizes valid liquidity configuration", function () {
        const config = loadLiquidityConfig(VALID_ENV);

        expect(config.privateKey).to.equal(`0x${VALID_ENV.SEPOLIA_PRIVATE_KEY}`);
        expect(config.dexAddress).to.equal(VALID_ENV.DEX_ADDRESS);
        expect(config.liquidityAmount).to.equal("1000");
    });

    it("rejects missing and malformed private keys", function () {
        expect(() => loadLiquidityConfig({ ...VALID_ENV, SEPOLIA_PRIVATE_KEY: "" }))
            .to.throw("Missing required environment variable: SEPOLIA_PRIVATE_KEY");
        expect(() => loadLiquidityConfig({ ...VALID_ENV, SEPOLIA_PRIVATE_KEY: "not-a-private-key" }))
            .to.throw("SEPOLIA_PRIVATE_KEY must be a 32-byte hexadecimal private key");
    });

    it("rejects invalid URLs, addresses, and liquidity amounts", function () {
        expect(() => loadLiquidityConfig({ ...VALID_ENV, RPC_URL: "file:///tmp/rpc" }))
            .to.throw("RPC_URL must use http or https");
        expect(() => loadLiquidityConfig({ ...VALID_ENV, DEX_ADDRESS: "0x0" }))
            .to.throw("DEX_ADDRESS must be a valid non-zero Ethereum address");
        expect(() => loadLiquidityConfig({ ...VALID_ENV, LIQUIDITY_AMOUNT: "-1" }))
            .to.throw("LIQUIDITY_AMOUNT must be a positive decimal amount");
        expect(() => loadLiquidityConfig({ ...VALID_ENV, RPC_URL: "https://sepolia.example.invalid/v3/replace-me" }))
            .to.throw("RPC_URL contains a placeholder value");
        expect(() => loadLiquidityConfig({ ...VALID_ENV, SEPOLIA_PRIVATE_KEY: "0".repeat(64) }))
            .to.throw("SEPOLIA_PRIVATE_KEY must not be the zero private key");
    });

    it("requires complete Sepolia credentials when either value is configured", function () {
        expect(loadOptionalSepoliaConfig({})).to.deep.equal({ url: "", accounts: [] });
        expect(() => loadOptionalSepoliaConfig({ RPC_URL: VALID_ENV.RPC_URL }))
            .to.throw("Missing required environment variable: SEPOLIA_PRIVATE_KEY");
        expect(loadOptionalSepoliaConfig(VALID_ENV).accounts)
            .to.deep.equal([`0x${VALID_ENV.SEPOLIA_PRIVATE_KEY}`]);
    });

    it("validates agent and deployment address configuration", function () {
        expect(loadReadOnlyAgentConfig(VALID_ENV)).to.deep.equal({
            rpcUrl: VALID_ENV.RPC_URL,
            dexAddress: VALID_ENV.DEX_ADDRESS,
        });
        expect(loadDeploymentAddressConfig(VALID_ENV)).to.deep.equal({
            tokenA: VALID_ENV.TOKEN_A,
            tokenB: VALID_ENV.TOKEN_B,
            dexAddress: VALID_ENV.DEX_ADDRESS,
        });
        expect(() => loadReadOnlyAgentConfig({ DEX_ADDRESS: VALID_ENV.DEX_ADDRESS }))
            .to.throw("Missing required environment variable: RPC_URL");
    });

    it("detects committed private keys and secret-key files", function () {
        const fixture = createGitFixture({
            "config.js": `const PRIVATE_KEY = "${"a".repeat(64)}";\n`,
            "agents/keys/deploy-secret.key": "secret material",
        });

        try {
            const findings = scanTrackedFiles(fixture);
            expect(findings.some((finding) => finding.includes("hardcoded hexadecimal private key"))).to.be.true;
            expect(findings.some((finding) => finding.includes("tracked private key material"))).to.be.true;
        } finally {
            fs.rmSync(fixture, { recursive: true, force: true });
        }
    });

    it("contains no committed secrets in this repository", function () {
        expect(() => assertNoCommittedSecrets()).to.not.throw();
    });
});
