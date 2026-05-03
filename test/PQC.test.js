import { expect } from "chai";
import { generateKeys, encryptMessage, decryptMessage } from "../agents/pqc.js";
import fs from "fs";
import path from "path";

describe("PQC (Post-Quantum Cryptography)", function () {
    const role1 = "test-agent-1";
    const role2 = "test-agent-2";
    const message = "Hello, this is a secret message!";

    before(function () {
        // Clean up any existing keys for test roles
        const keysDir = path.join(process.cwd(), "agents", "keys");
        const roles = [role1, role2];
        roles.forEach(role => {
            ["public", "secret"].forEach(type => {
                const keyPath = path.join(keysDir, `${role}-${type}.key`);
                if (fs.existsSync(keyPath)) {
                    fs.unlinkSync(keyPath);
                }
            });
        });
    });

    it("Should generate keys for agents", function () {
        const keys1 = generateKeys(role1);
        const keys2 = generateKeys(role2);

        expect(keys1).to.have.property("publicKey");
        expect(keys1).to.have.property("secretKey");
        expect(keys2).to.have.property("publicKey");
        expect(keys2).to.have.property("secretKey");
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
