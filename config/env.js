import { ethers } from "ethers";

const PLACEHOLDER_VALUES = new Set([
    "",
    "change-me",
    "replace-me",
    "replace-with-a-funded-testnet-private-key",
]);

function requireValue(env, name) {
    const value = env[name]?.trim();
    if (!value || PLACEHOLDER_VALUES.has(value.toLowerCase())) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function requireHttpUrl(env, name) {
    const value = requireValue(env, name);

    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`${name} must be a valid URL`);
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error(`${name} must use http or https`);
    }
    if (url.hostname.endsWith(".invalid") || value.toLowerCase().includes("replace-me")) {
        throw new Error(`${name} contains a placeholder value`);
    }

    return value;
}

function requirePrivateKey(env, name) {
    const value = requireValue(env, name);
    const normalized = value.startsWith("0x") ? value : `0x${value}`;

    if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
        throw new Error(`${name} must be a 32-byte hexadecimal private key`);
    }
    if (/^0x0{64}$/.test(normalized)) {
        throw new Error(`${name} must not be the zero private key`);
    }

    return normalized;
}

function requireAddress(env, name) {
    const value = requireValue(env, name);
    if (!ethers.isAddress(value) || value === ethers.ZeroAddress) {
        throw new Error(`${name} must be a valid non-zero Ethereum address`);
    }
    return ethers.getAddress(value);
}

function optionalPositiveAmount(env, name, defaultValue) {
    const value = env[name]?.trim() || defaultValue;
    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) || Number(value) <= 0) {
        throw new Error(`${name} must be a positive decimal amount`);
    }
    return value;
}

export function loadLiquidityConfig(env = process.env) {
    return Object.freeze({
        rpcUrl: requireHttpUrl(env, "RPC_URL"),
        privateKey: requirePrivateKey(env, "SEPOLIA_PRIVATE_KEY"),
        tokenA: requireAddress(env, "TOKEN_A"),
        tokenB: requireAddress(env, "TOKEN_B"),
        dexAddress: requireAddress(env, "DEX_ADDRESS"),
        liquidityAmount: optionalPositiveAmount(env, "LIQUIDITY_AMOUNT", "1000"),
    });
}

export function loadReadOnlyAgentConfig(env = process.env) {
    return Object.freeze({
        rpcUrl: requireHttpUrl(env, "RPC_URL"),
        dexAddress: requireAddress(env, "DEX_ADDRESS"),
    });
}

export function loadDeploymentAddressConfig(env = process.env) {
    return Object.freeze({
        tokenA: requireAddress(env, "TOKEN_A"),
        tokenB: requireAddress(env, "TOKEN_B"),
        dexAddress: requireAddress(env, "DEX_ADDRESS"),
    });
}

export function loadOptionalSepoliaConfig(env = process.env) {
    const hasRpcUrl = Boolean(env.RPC_URL?.trim());
    const hasPrivateKey = Boolean(env.SEPOLIA_PRIVATE_KEY?.trim());

    if (!hasRpcUrl && !hasPrivateKey) {
        return Object.freeze({ url: "", accounts: [] });
    }

    return Object.freeze({
        url: requireHttpUrl(env, "RPC_URL"),
        accounts: [requirePrivateKey(env, "SEPOLIA_PRIVATE_KEY")],
    });
}
