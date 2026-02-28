/**
 * Provably Fair System using HMAC-SHA256
 * Used by both Crash Game and Dino Game
 * 
 * How it works:
 * 1. Server generates a serverSeed and hashes it (serverSeedHash)
 * 2. serverSeedHash is shown to the player BEFORE the game
 * 3. Player provides their own clientSeed
 * 4. The game result is computed from: HMAC-SHA256(serverSeed, clientSeed:nonce)
 * 5. After the game, the serverSeed is revealed so the player can verify
 */

// Convert hex string to array of bytes
function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

// Simple string to bytes
function stringToBytes(str) {
    return Array.from(str).map(c => c.charCodeAt(0));
}

// SHA-256 using Web Crypto API (async)
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// HMAC-SHA256 using Web Crypto API (async)
async function hmacSHA256(key, message) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a random hex seed
function generateSeed(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a random client seed (human-readable)
function generateClientSeed() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    for (let i = 0; i < 16; i++) {
        result += chars[array[i] % chars.length];
    }
    return result;
}

/**
 * ProvablyFair class - manages seed rotation and result generation
 */
class ProvablyFair {
    constructor() {
        this.serverSeed = generateSeed();
        this.serverSeedHash = null;
        this.clientSeed = generateClientSeed();
        this.nonce = 0;
        this.previousSeeds = []; // history for verification
        this._hashReady = this._computeHash();
    }

    async _computeHash() {
        this.serverSeedHash = await sha256(this.serverSeed);
    }

    async waitReady() {
        await this._hashReady;
    }

    /**
     * Get result as a float [0, 1) from HMAC-SHA256
     * @returns {Promise<number>}
     */
    async getResult() {
        await this._hashReady;
        const message = `${this.clientSeed}:${this.nonce}`;
        const hash = await hmacSHA256(this.serverSeed, message);

        // Use first 8 hex chars (32 bits) to get a float [0, 1)
        const int = parseInt(hash.substr(0, 8), 16);
        const result = int / 0x100000000; // Divide by 2^32

        this.nonce++;
        return result;
    }

    /**
     * Generate a crash point from HMAC result
     * Uses the same formula as Stake: 
     *   crashPoint = max(1, floor(99 / (1 - result)) / 100)
     * With house edge of ~1%
     * @returns {Promise<number>}
     */
    async generateCrashPoint() {
        const result = await this.getResult();

        // 1% instant crash (house edge)
        const houseEdge = 0.01;
        if (result < houseEdge) return 1.00;

        // Formula: e = 99 / (1 - r)  =>  result in [1.00, ∞)
        const e = Math.floor((100 / (1 - result))) / 100;
        return Math.max(1.00, Math.min(e, 1000.00));
    }

    /**
     * Generate survival result for Dino Game step
     * @param {number} survivalChance - probability of surviving (0-1)
     * @returns {Promise<{survived: boolean, roll: number}>}
     */
    async generateDinoStep(survivalChance) {
        const roll = await this.getResult();
        return {
            survived: roll < survivalChance,
            roll, // For transparency/verification
        };
    }

    /**
     * Peek at the generated Dino jump result for the CURRENT nonce without advancing it.
     * Used for Debug Mode.
     * @param {number} survivalChance 
     * @returns {Promise<{survived: boolean, roll: number, nonce: number}>}
     */
    async peekDinoStep(survivalChance) {
        await this._hashReady;
        const message = `${this.clientSeed}:${this.nonce}`;
        const hash = await hmacSHA256(this.serverSeed, message);

        const int = parseInt(hash.substr(0, 8), 16);
        const roll = int / 0x100000000;

        return {
            survived: roll < survivalChance,
            roll,
            nonce: this.nonce
        };
    }

    /**
     * Generate a Plinko path from HMAC result
     * @param {number} rowCount - Number of rows/pins (e.g. 16)
     * @returns {Promise<{path: number[], binIndex: number, hash: string}>}
     */
    async generatePlinkoPath(rowCount) {
        await this._hashReady;
        const message = `${this.clientSeed}:${this.nonce}`;
        const hash = await hmacSHA256(this.serverSeed, message);

        const path = [];
        let binIndex = 0;

        // Follow Stake's exact float calculation
        // Extract 4 bytes at a time per row to convert to a float [0, 1)
        for (let i = 0; i < rowCount; i++) {
            const hexOffset = i * 4 * 2; // Each round needs 4 bytes = 8 hex chars
            const byteStr = hash.substr(hexOffset, 8);

            // Reached end of 256-bit hash (32 bytes = 64 chars)? Wait, Plinko is max 16 rows.
            // 16 rows * 8 chars = 128 chars needed... wait, SHA-256 is only 64 chars!

            // Correct approach: if using 1 byte per row, modulo 2 is sometimes biased in JS.
            // Let's use 4 hex chars (2 bytes) per row => 16 rows * 4 = 64 chars (Perfect match for SHA-256)
            const chunk = hash.substr(i * 4, 4);
            const value = parseInt(chunk, 16);
            const floatValue = value / 65536; // 16-bit integer max

            // floatValue gives [0, 1). 
            // Multiple by 2 and floor to get exactly 0 or 1.
            const dir = Math.floor(floatValue * 2);

            path.push(dir);
            binIndex += dir;
        }

        this.nonce++;
        return {
            path,
            binIndex,
            hash
        };
    }

    /**
     * Peek at the generated Plinko path for the CURRENT nonce without advancing it.
     * Used for Debug Mode.
     * @param {number} rowCount 
     * @returns {Promise<{path: number[], binIndex: number, hash: string, nonce: number}>}
     */
    async peekPlinkoPath(rowCount) {
        await this._hashReady;
        const message = `${this.clientSeed}:${this.nonce}`;
        const hash = await hmacSHA256(this.serverSeed, message);

        const path = [];
        let binIndex = 0;

        for (let i = 0; i < rowCount; i++) {
            const chunk = hash.substr(i * 4, 4);
            const value = parseInt(chunk, 16);
            const floatValue = value / 65536;
            const dir = Math.floor(floatValue * 2);

            path.push(dir);
            binIndex += dir;
        }

        return {
            path,
            binIndex,
            hash,
            nonce: this.nonce
        };
    }

    /**
     * Generate mine positions for Mines game using provably fair system.
     * Uses Fisher-Yates shuffle seeded by HMAC-SHA256 to deterministically
     * select which tiles contain mines on a 5×5 (25-tile) grid.
     * @param {number} minesCount - Number of mines to place (1-24)
     * @returns {Promise<{minePositions: number[], hash: string}>}
     */
    async generateMinesPositions(minesCount) {
        await this._hashReady;
        const message = `${this.clientSeed}:${this.nonce}`;
        const hash = await hmacSHA256(this.serverSeed, message);

        // Create array [0..24] representing all tile positions
        const tiles = Array.from({ length: 25 }, (_, i) => i);

        // Fisher-Yates shuffle using hash bytes as entropy source
        // We need minesCount swaps, each consuming 4 hex chars (2 bytes)
        for (let i = 0; i < minesCount; i++) {
            const hexOffset = (i * 4) % 64; // Wrap around if needed
            const chunk = hash.substr(hexOffset, 4);
            const value = parseInt(chunk, 16);
            // Pick from remaining positions [i..24]
            const remaining = 25 - i;
            const swapIdx = i + (value % remaining);
            // Swap
            [tiles[i], tiles[swapIdx]] = [tiles[swapIdx], tiles[i]];
        }

        // First minesCount elements are where mines go
        const minePositions = tiles.slice(0, minesCount).sort((a, b) => a - b);

        this.nonce++;
        return {
            minePositions,
            hash
        };
    }

    /**
     * Peek at the generated Mines positions for the CURRENT nonce without advancing it.
     * Used for Debug Mode.
     * @param {number} minesCount - Number of mines
     * @returns {Promise<{minePositions: number[], hash: string, nonce: number}>}
     */
    async peekMinesPositions(minesCount) {
        await this._hashReady;
        const message = `${this.clientSeed}:${this.nonce}`;
        const hash = await hmacSHA256(this.serverSeed, message);

        const tiles = Array.from({ length: 25 }, (_, i) => i);

        for (let i = 0; i < minesCount; i++) {
            const hexOffset = (i * 4) % 64;
            const chunk = hash.substr(hexOffset, 4);
            const value = parseInt(chunk, 16);
            const remaining = 25 - i;
            const swapIdx = i + (value % remaining);
            [tiles[i], tiles[swapIdx]] = [tiles[swapIdx], tiles[i]];
        }

        const minePositions = tiles.slice(0, minesCount).sort((a, b) => a - b);

        return {
            minePositions,
            hash,
            nonce: this.nonce
        };
    }

    /**
     * Rotate server seed (after revealing current one)
     * Stores old seed pair for verification history
     */
    async rotateSeed() {
        const revealed = {
            serverSeed: this.serverSeed,
            serverSeedHash: this.serverSeedHash,
            clientSeed: this.clientSeed,
            nonce: this.nonce,
            timestamp: Date.now(),
        };

        this.previousSeeds.unshift(revealed);
        if (this.previousSeeds.length > 20) {
            this.previousSeeds = this.previousSeeds.slice(0, 20);
        }

        // Generate new seed
        this.serverSeed = generateSeed();
        this.nonce = 0;
        this._hashReady = this._computeHash();
        await this._hashReady;

        return revealed;
    }

    /**
     * Update client seed
     * @param {string} newSeed 
     */
    async setClientSeed(newSeed) {
        if (newSeed && newSeed.length > 0) {
            this.clientSeed = newSeed;
            this.nonce = 0;
        }
    }

    /**
     * Get current fairness data to display in UI
     */
    async getFairnessData() {
        await this._hashReady;
        return {
            serverSeedHash: this.serverSeedHash,
            clientSeed: this.clientSeed,
            nonce: this.nonce,
        };
    }

    /**
     * Verify a past result using the revealed seed
     * @param {string} serverSeed - revealed server seed
     * @param {string} clientSeed - client seed used
     * @param {number} nonce - nonce used
     * @returns {Promise<{hash: string, result: number}>}
     */
    static async verify(serverSeed, clientSeed, nonce) {
        const message = `${clientSeed}:${nonce}`;
        const hash = await hmacSHA256(serverSeed, message);
        const int = parseInt(hash.substr(0, 8), 16);
        const result = int / 0x100000000;

        return {
            hash,
            result,
            serverSeedHash: await sha256(serverSeed),
        };
    }
}

export { ProvablyFair, sha256, hmacSHA256, generateSeed, generateClientSeed };
export default ProvablyFair;
