#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// generatePlinkoOutcomes.cjs
// Chạy: node scripts/generatePlinkoOutcomes.cjs
//
// Mô phỏng physics offline cho mỗi rowCount (8-16),
// tạo mapping: rowCount → binIndex → [startX (padded)]
// Output: src/components/PlinkoGame/plinkoOutcomes.js
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// ─── PHYSICS CONSTANTS (phải khớp 100% với Ball.js) ──────────
const DECIMAL_MULTIPLIER = 10000;
const pad  = (n) => n * DECIMAL_MULTIPLIER;
const unpad = (n) => Math.floor(n / DECIMAL_MULTIPLIER);

// Board layout (phải khớp 100% với PlinkoEngine.js)
const WIDTH = 760;
const HEIGHT = 570;
const PADDING_X = 52;
const PADDING_TOP = 36;
const PADDING_BOTTOM = 28;

// Physics per rowCount (phải khớp 100% với PlinkoEngine.js)
const PHYSICS_BY_ROWS = {
    8:  { gravity: pad(0.5),  hFriction: 0.4, vFriction: 0.8 },
    9:  { gravity: pad(0.5),  hFriction: 0.4, vFriction: 0.8 },
    10: { gravity: pad(0.5),  hFriction: 0.4, vFriction: 0.8 },
    11: { gravity: pad(0.5),  hFriction: 0.4, vFriction: 0.8 },
    12: { gravity: pad(0.55), hFriction: 0.4, vFriction: 0.8 },
    13: { gravity: pad(0.55), hFriction: 0.4, vFriction: 0.8 },
    14: { gravity: pad(0.55), hFriction: 0.4, vFriction: 0.8 },
    15: { gravity: pad(0.6),  hFriction: 0.4, vFriction: 0.8 },
    16: { gravity: pad(0.6),  hFriction: 0.4, vFriction: 0.8 },
};

const SIMULATIONS_PER_ROW = 100000; // Nhiều hơn = chính xác hơn

// ─── BOARD GENERATION ────────────────────────────────────────

function buildBoard(rowCount) {
    const lastRowPinCount = 3 + rowCount - 1;
    const pinDistanceX = (WIDTH - PADDING_X * 2) / (lastRowPinCount - 1);
    const pinRadius = Math.max((24 - rowCount) / 2, 3);

    const paddedPins = [];
    const pinsLastRowXCoords = [];

    for (let row = 0; row < rowCount; ++row) {
        const rowY = PADDING_TOP + ((HEIGHT - PADDING_TOP - PADDING_BOTTOM) / (rowCount - 1)) * row;
        const rowPaddingX = PADDING_X + ((rowCount - 1 - row) * pinDistanceX) / 2;

        for (let col = 0; col < 3 + row; ++col) {
            const colX = rowPaddingX + ((WIDTH - rowPaddingX * 2) / (3 + row - 1)) * col;
            paddedPins.push({ x: pad(colX), y: pad(rowY), radius: pinRadius });

            if (row === rowCount - 1) {
                pinsLastRowXCoords.push(colX);
            }
        }
    }

    // Sinks — detection zone BELOW last row of pins (must match PlinkoEngine.js)
    const sinkWidth = pinDistanceX;
    const sinkHeight = 20;
    const sinkY = HEIGHT;  // Bottom edge of canvas
    const sinkCount = rowCount + 1;
    const sinksStartX = pinsLastRowXCoords[0] + sinkWidth / 2;

    const sinks = [];
    for (let i = 0; i < sinkCount; i++) {
        sinks.push({
            x: sinksStartX + i * sinkWidth,
            y: sinkY,
            width: sinkWidth,
            height: sinkHeight,
        });
    }

    return { paddedPins, sinks, pinDistanceX, pinRadius };
}

// ─── HEADLESS BALL SIMULATION (khớp 100% Ball.js) ───────────

function simulateBall(startXPadded, paddedPins, sinks, pinRadius, physics) {
    let x = startXPadded;
    let y = pad(0);
    let vx = 0;
    let vy = 0;
    const { gravity, hFriction, vFriction } = physics;
    const ballRadius = pinRadius * 2;

    for (let iter = 0; iter < 2000; iter++) {
        vy += gravity;
        x += vx;
        y += vy;

        // Collision with pins
        for (const pin of paddedPins) {
            const dx = x - pin.x;
            const dy = y - pin.y;
            const dist = Math.hypot(dx, dy);
            const minDist = pad(ballRadius + pin.radius);

            if (dist < minDist) {
                const angle = Math.atan2(dy, dx);
                const speed = Math.sqrt(vx * vx + vy * vy);
                vx = Math.cos(angle) * speed * hFriction;
                vy = Math.sin(angle) * speed * vFriction;

                const overlap = (ballRadius + pin.radius) - unpad(dist);
                x += pad(Math.cos(angle) * overlap);
                y += pad(Math.sin(angle) * overlap);
            }
        }

        // Check sinks (unpadded)
        const ux = unpad(x);
        const uy = unpad(y);
        for (let i = 0; i < sinks.length; i++) {
            const sink = sinks[i];
            if (ux > sink.x - sink.width / 2 &&
                ux < sink.x + sink.width / 2 &&
                (uy + ballRadius) > (sink.y - sink.height / 2)) {
                return i;
            }
        }

        if (uy > HEIGHT + 50) return -1;
    }
    return -1;
}

// ─── MAIN ────────────────────────────────────────────────────

function generateOutcomesForRow(rowCount) {
    const { paddedPins, sinks, pinDistanceX, pinRadius } = buildBoard(rowCount);
    const physics = PHYSICS_BY_ROWS[rowCount];
    const numBins = rowCount + 1;

    const outcomes = {};
    for (let i = 0; i < numBins; i++) outcomes[i] = [];

    const spawnRange = pinDistanceX * 1.2;
    let landed = 0;

    for (let i = 0; i < SIMULATIONS_PER_ROW; i++) {
        const startX = WIDTH / 2 + (Math.random() - 0.5) * spawnRange;
        const startXPadded = pad(startX);
        const bin = simulateBall(startXPadded, paddedPins, sinks, pinRadius, physics);

        if (bin >= 0 && bin < numBins) {
            outcomes[bin].push(startXPadded);
            landed++;
        }
    }

    // Stats
    const coverage = Object.keys(outcomes).filter(k => outcomes[k].length > 0).length;
    console.log(`  rows=${rowCount}: ${landed}/${SIMULATIONS_PER_ROW} landed, ${coverage}/${numBins} bins covered`);

    // Warn about empty bins
    for (let i = 0; i < numBins; i++) {
        if (outcomes[i].length === 0) {
            console.log(`    ⚠ bin ${i} has 0 outcomes!`);
        }
    }

    return outcomes;
}

function main() {
    console.log(`\n🎱 Generating Plinko outcomes (${SIMULATIONS_PER_ROW} sims per rowCount)...\n`);

    const allOutcomes = {};

    for (let rows = 8; rows <= 16; rows++) {
        allOutcomes[rows] = generateOutcomesForRow(rows);
    }

    // Build output file
    const header = [
        '// ═══════════════════════════════════════════════════',
        '// AUTO-GENERATED — Do not edit by hand!',
        '// Generated by: node scripts/generatePlinkoOutcomes.cjs',
        '// Maps: rowCount -> binIndex -> [startX (padded)]',
        '// Each startX was tested to naturally lead the ball',
        '// into that bin using our deterministic custom physics.',
        '// ═══════════════════════════════════════════════════',
        '',
    ].join('\n');

    const body = `export const OUTCOMES = ${JSON.stringify(allOutcomes)};\n`;

    const outPath = path.resolve(__dirname, '..', 'src', 'components', 'PlinkoGame', 'plinkoOutcomes.js');
    fs.writeFileSync(outPath, header + body, 'utf-8');

    const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
    console.log(`\n✅ Written to ${outPath} (${sizeKB} KB)\n`);
}

main();
