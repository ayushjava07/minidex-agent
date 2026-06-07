import { expect } from "chai";
import { generateKeys, encryptMessage, decryptMessage } from "../agents/pqc.js";
import fs from "fs";
import os from "os";
import path from "path";

describe("PQC (Post-Quantum Cryptography)", function () {
    const role1 = "test-agent-1";
    const role2 = "test-agent-2";
    const message = "Hello, this is a secret message!";
    let tempDir;

    before(function () {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "minidex-pqc-test-"));
        process.env.AGENT_KEYS_DIR = path.join(tempDir, "keys");
        process.env.AGENT_PUBLIC_KEYS_FILE = path.join(tempDir, "public-keys.json");
    });

    after(function () {
        delete process.env.AGENT_KEYS_DIR;
        delete process.env.AGENT_PUBLIC_KEYS_FILE;
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("Should generate keys for agents", function () {
        const keys1 = generateKeys(role1);
        const keys2 = generateKeys(role2);

        expect(keys1).to.have.property("publicKey");
        expect(keys1).to.have.property("secretKey");
        expect(keys2).to.have.property("publicKey");
        expect(keys2).to.have.property("secretKey");
        expect(fs.statSync(path.join(process.env.AGENT_KEYS_DIR, `${role1}-secret.key`)).mode & 0o777).to.equal(0o600);
    });

    it("Should encrypt and decrypt a message between two agents", function () {
        // Agent 1 encrypts for Agent 2
        const encrypted = encryptMessage(role2, message);
        expect(encrypted).to.not.be.null;
        expect(encrypted).to.have.property("cipherText");
        expect(encrypted).to.have.property("encryptedMessage");
        expect(encrypted).to.have.property("iv");

        // Agent 2 decrypts
        const decrypted = decryptMessage(role2, encrypted.cipherText, encrypted.encryptedMessage, encrypted.iv);
        expect(decrypted).to.equal(message);
    });

    it("Should fail to encrypt if target public key is missing", function () {
        const encrypted = encryptMessage("non-existent-role", "some message");
        expect(encrypted).to.be.null;
    });

    it("Should fail to decrypt if secret key is missing", function () {
        const encrypted = encryptMessage(role2, message);
        // Temporarily rename or delete secret key for role2 to test failure
        // Actually decryptMessage throws error if keys not found
        expect(() => {
            decryptMessage("non-existent-role", encrypted.cipherText, encrypted.encryptedMessage, encrypted.iv);
        }).to.throw();
    });
});
