import { ml_kem768 }from "@noble/post-quantum/ml-kem";

// Generate PQC keypair
export function generateKeys() {
    return ml_kem768.keygen();
}

// Encrypt message
export function encryptMessage(publicKey,message) {
    const {cipherText,sharedSecret }= ml_kem768.encapsulate(publicKey);
    return {
        cipherText: Buffer.from(cipherText).toString("hex"),
        sharedSecret: Buffer.from(sharedSecret).toString("hex"),
        message: message
    };
}

// Decrypt message
export function decryptMessage(secretKey,cipherText) {
    const sharedSecret = ml_kem768.decapsulate(
        Buffer.from(cipherText,"hex"),
        secretKey
    );
    return Buffer.from(sharedSecret).toString("hex");
}