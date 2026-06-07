import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const FORBIDDEN_TRACKED_PATHS = [
    {
        pattern: /(^|\/)\.env(?:\..+)?$/,
        allow: new Set([".env.example"]),
        description: "environment file",
    },
    {
        pattern: /(^|\/)(?:keys?|secrets?)\/.*(?:private|secret|mnemonic|seed).*$/i,
        allow: new Set(),
        description: "private key material",
    },
];

const SECRET_PATTERNS = [
    {
        pattern: /(?:PRIVATE_KEY|SECRET_KEY|MNEMONIC|SEED_PHRASE)\s*[:=]\s*["'`](?:0x)?[0-9a-fA-F]{64}["'`]/,
        description: "hardcoded hexadecimal private key",
    },
    {
        pattern: /https:\/\/[A-Za-z0-9.-]*infura\.io\/v3\/[0-9a-fA-F]{32}/,
        description: "hardcoded Infura project credential",
    },
    {
        pattern: /AKIA[0-9A-Z]{16}/,
        description: "AWS access key",
    },
    {
        pattern: /(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}/,
        description: "GitHub token",
    },
    {
        pattern: new RegExp(["-----BEGIN ", "(?:EC |RSA |OPENSSH )?", "PRIVATE KEY-----"].join("")),
        description: "PEM private key",
    },
];

const IGNORED_DIRECTORIES = new Set([
    ".git",
    "artifacts",
    "build",
    "cache",
    "coverage",
    "dist",
    "logs",
    "node_modules",
    "typechain-types",
]);

function sourceFiles(rootDir, currentDir = rootDir) {
    const files = [];

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;

        const absolutePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            files.push(...sourceFiles(rootDir, absolutePath));
        } else if (entry.isFile()) {
            files.push(path.relative(rootDir, absolutePath));
        }
    }

    return files;
}

function filesToScan(rootDir) {
    try {
        const output = execFileSync("git", ["ls-files", "-z"], {
            cwd: rootDir,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        });
        return output.split("\0").filter(Boolean);
    } catch {
        return sourceFiles(rootDir);
    }
}

function isBinary(content) {
    return content.includes("\0");
}

export function scanTrackedFiles(rootDir = process.cwd()) {
    const findings = [];

    for (const relativePath of filesToScan(rootDir)) {
        const normalizedPath = relativePath.split(path.sep).join("/");

        for (const rule of FORBIDDEN_TRACKED_PATHS) {
            if (rule.pattern.test(normalizedPath) && !rule.allow.has(normalizedPath)) {
                findings.push(`${normalizedPath}: tracked ${rule.description}`);
            }
        }

        const absolutePath = path.join(rootDir, relativePath);
        if (!fs.existsSync(absolutePath)) continue;

        const content = fs.readFileSync(absolutePath, "utf8");
        if (isBinary(content)) continue;

        const lines = content.split(/\r?\n/);
        lines.forEach((line, index) => {
            for (const rule of SECRET_PATTERNS) {
                if (rule.pattern.test(line)) {
                    findings.push(`${normalizedPath}:${index + 1}: ${rule.description}`);
                }
            }
        });
    }

    return findings;
}

export function assertNoCommittedSecrets(rootDir = process.cwd()) {
    const findings = scanTrackedFiles(rootDir);
    if (findings.length > 0) {
        throw new Error(`Potential committed secrets detected:\n${findings.map((item) => `- ${item}`).join("\n")}`);
    }
}

const isMain = process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    try {
        assertNoCommittedSecrets();
        console.log("No committed secrets detected.");
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
