// PlinkoEngine - Deterministic Custom Physics (No Matter.js)
// Uses pre-calculated X positions for natural ball trajectories.
// Ball drops at a precise X → physics naturally guides it to the correct bin.

import { Ball, pad, unpad } from './Ball';
import { BIN_PAYOUTS } from './constants';
import { OUTCOMES } from './plinkoOutcomes';

const WIDTH = 760;
const HEIGHT = 570;
const PADDING_X = 52;
const PADDING_TOP = 36;
const PADDING_BOTTOM = 28;

// Physics tuning per row count (gravity, hFriction, vFriction)
// These are tuned so the ball spreads naturally across all bins
const PHYSICS_BY_ROWS = {
    8: { gravity: pad(0.5), hFriction: 0.4, vFriction: 0.8 },
    9: { gravity: pad(0.5), hFriction: 0.4, vFriction: 0.8 },
    10: { gravity: pad(0.5), hFriction: 0.4, vFriction: 0.8 },
    11: { gravity: pad(0.5), hFriction: 0.4, vFriction: 0.8 },
    12: { gravity: pad(0.55), hFriction: 0.4, vFriction: 0.8 },
    13: { gravity: pad(0.55), hFriction: 0.4, vFriction: 0.8 },
    14: { gravity: pad(0.55), hFriction: 0.4, vFriction: 0.8 },
    15: { gravity: pad(0.6), hFriction: 0.4, vFriction: 0.8 },
    16: { gravity: pad(0.6), hFriction: 0.4, vFriction: 0.8 },
};

// Outcomes loaded from pre-generated file (no runtime simulation)

class PlinkoEngine {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.betAmount = options.betAmount || 1;
        this.rowCount = options.rowCount || 16;
        this.riskLevel = options.riskLevel || 'medium';
        this.onBallEnterBin = options.onBallEnterBin || (() => { });
        this.onBalanceChange = options.onBalanceChange || (() => { });

        this.balls = [];
        this.pins = [];           // { id, x, y, radius } — x,y in UNPADDED screen coords
        this.paddedPins = [];     // { id, x, y, radius } — x,y in PADDED space for physics
        this.sinks = [];          // { x, y, width, height } — UNPADDED screen coords
        this.pinsLastRowXCoords = [];
        this.pinGrid = [];
        this.pinAnimations = new Map();
        this.betAmountOfExistingBalls = {};
        this.ballColor = '#ff0000';
        this.ballImage = null;

        this.animationId = null;

        // Handle high DPI displays (Retina/4K) for crisp rendering
        this._setupCanvasHDPI();

        // Build board
        this.placePinsAndWalls();
    }

    _setupCanvasHDPI() {
        const dpr = window.devicePixelRatio || 1;
        // The CSS size is fixed to WIDTH x HEIGHT
        this.canvas.width = WIDTH * dpr;
        this.canvas.height = HEIGHT * dpr;
        this.canvas.style.width = `${WIDTH}px`;
        this.canvas.style.height = `${HEIGHT}px`;

        // Normalize coordinate system to use css pixels
        this.ctx.scale(dpr, dpr);
    }

    static get WIDTH() { return WIDTH; }
    static get HEIGHT() { return HEIGHT; }

    get pinDistanceX() {
        const lastRowPinCount = 3 + this.rowCount - 1;
        return (WIDTH - PADDING_X * 2) / (lastRowPinCount - 1);
    }

    get pinRadius() {
        return Math.max((24 - this.rowCount) / 2, 3);
    }

    get binsWidthPercentage() {
        const lastPinX = this.pinsLastRowXCoords[this.pinsLastRowXCoords.length - 1];
        return (lastPinX - this.pinsLastRowXCoords[0]) / WIDTH;
    }

    // ─── OUTCOMES SYSTEM ─────────────────────────────────────────────────────

    /**
     * Get a valid drop X for a specific bin from pre-generated outcomes
     * Data loaded from plinkoOutcomes.js (generated offline by scripts/generatePlinkoOutcomes.cjs)
     */
    _getDropXForBin(binIndex) {
        const rowOutcomes = OUTCOMES[this.rowCount];
        if (!rowOutcomes) return pad(WIDTH / 2);

        const positions = rowOutcomes[binIndex];
        if (!positions || positions.length === 0) return pad(WIDTH / 2);

        // Random pick from valid X positions for this bin
        return positions[Math.floor(Math.random() * positions.length)];
    }

    // ─── LIFECYCLE ───────────────────────────────────────────────────────────

    start() {
        this.gameLoop();
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    gameLoop() {
        // Clear canvas (transparent — uses web page background)
        this.ctx.clearRect(0, 0, WIDTH, HEIGHT);

        // Draw pins
        this.drawPins();

        // Update & draw balls
        this.updateBalls();

        // Continue loop
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }

    triggerPinAnimation(pinId) {
        this.pinAnimations.set(pinId, { frames: 12 });
    }

    // ─── DRAWING ─────────────────────────────────────────────────────────────

    drawPins() {
        this.pins.forEach(pin => {
            const anim = this.pinAnimations.get(pin.id);

            if (anim && anim.frames > 0) {
                const progress = anim.frames / 12;

                this.ctx.beginPath();
                this.ctx.arc(pin.x, pin.y, pin.radius, 0, Math.PI * 2);
                this.ctx.fillStyle = '#00e701'; // Stake signature green when hit
                this.ctx.fill();

                // Bright glow effect
                if (progress > 0) {
                    this.ctx.beginPath();
                    this.ctx.arc(pin.x, pin.y, pin.radius, 0, Math.PI * 2);
                    this.ctx.shadowBlur = 10 * progress;
                    this.ctx.shadowColor = '#00e701';
                    this.ctx.fillStyle = '#00e701';
                    this.ctx.fill();
                    // Reset shadow so it doesn't affect other elements
                    this.ctx.shadowBlur = 0;
                }
            } else {
                this.ctx.beginPath();
                this.ctx.arc(pin.x, pin.y, pin.radius, 0, Math.PI * 2);
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fill();
            }
        });
    }

    // ─── UPDATE ──────────────────────────────────────────────────────────────

    updateBalls() {
        const toRemove = [];

        this.balls.forEach(ball => {
            ball.update();
            ball.draw();

            // Check for finished balls
            if (ball.isFinished()) {
                toRemove.push(ball);
            }
        });

        // Process finished balls
        toRemove.forEach(ball => this._handleBallFinish(ball));

        // Update pin animations
        this.pinAnimations.forEach((anim, pinId) => {
            if (anim.frames > 0) {
                anim.frames--;
                if (anim.frames === 0) {
                    this.pinAnimations.delete(pinId);
                }
            }
        });
    }

    _handleBallFinish(ball) {
        const binIndex = ball.binIndex;
        const payouts = BIN_PAYOUTS[this.rowCount]?.[this.riskLevel];

        if (payouts && binIndex >= 0 && binIndex < payouts.length) {
            const betAmount = this.betAmountOfExistingBalls[ball.id] || 0;
            const multiplier = payouts[binIndex];
            const payoutValue = betAmount * multiplier;
            const profit = payoutValue - betAmount;

            this.onBallEnterBin({
                betAmount,
                rowCount: this.rowCount,
                binIndex,
                payout: { multiplier, value: payoutValue },
                profit,
                ballType: ball.type // Pass the preserved ball type back!
            });

            this.onBalanceChange(payoutValue);
        }

        this.removeBall(ball);
    }

    // ─── PUBLIC API ─────────────────────────────────────────────────────────

    /**
     * Drop a ball to a specific bin
     * @param {number} binIndex - The target bin index (0 = leftmost, rowCount = rightmost)
     * @param {string} ballType - The identifier for the ball type being dropped
     */
    dropBall(binIndex, ballType) {
        // Get pre-calculated X for this bin
        const dropX = this._getDropXForBin(binIndex);
        const startY = pad(0);

        const physics = PHYSICS_BY_ROWS[this.rowCount] || PHYSICS_BY_ROWS[16];
        const ballRadius = this.pinRadius * 2;

        const ball = new Ball(
            dropX,
            startY,
            ballRadius,
            this.ballColor,
            this.ctx,
            this.paddedPins,  // PADDED pins for physics
            this.sinks,        // UNPADDED sinks for detection
            (finishedBinIndex) => {
                ball.binIndex = finishedBinIndex;
            },
            physics.gravity,
            physics.hFriction,
            physics.vFriction,
            this.ballImage,
            (pinId) => this.triggerPinAnimation(pinId) // Pass collision callback
        );

        ball.id = Math.random().toString(36).substr(2, 9);
        ball.type = ballType; // Attach ballType to preserve it
        this.balls.push(ball);
        this.betAmountOfExistingBalls[ball.id] = this.betAmount;

        // Notify balance change (deduct bet)
        this.onBalanceChange(-this.betAmount);

        return ball;
    }

    /**
     * Drop ball with random X (for backward compatibility)
     * Note: This doesn't guarantee a specific bin - use dropBall(binIndex) instead
     */
    dropBallRandom() {
        const spawnRange = this.pinDistanceX * 0.8;
        const startX = pad(WIDTH / 2 + (Math.random() - 0.5) * spawnRange);

        const physics = PHYSICS_BY_ROWS[this.rowCount] || PHYSICS_BY_ROWS[16];
        const ballRadius = this.pinRadius * 2;

        const ball = new Ball(
            startX,
            pad(0),
            ballRadius,
            this.ballColor,
            this.ctx,
            this.paddedPins,
            this.sinks,
            (finishedBinIndex) => {
                ball.binIndex = finishedBinIndex;
            },
            physics.gravity,
            physics.hFriction,
            physics.vFriction,
            this.ballImage
        );

        ball.id = Math.random().toString(36).substr(2, 9);
        this.balls.push(ball);
        this.betAmountOfExistingBalls[ball.id] = this.betAmount;
        this.onBalanceChange(-this.betAmount);

        return ball;
    }

    removeBall(ball) {
        const idx = this.balls.indexOf(ball);
        if (idx > -1) this.balls.splice(idx, 1);
        delete this.betAmountOfExistingBalls[ball.id];
    }

    placePinsAndWalls() {
        this.pins = [];
        this.paddedPins = [];
        this.pinsLastRowXCoords = [];
        this.pinGrid = [];
        this.sinks = [];

        // Create pins
        for (let row = 0; row < this.rowCount; ++row) {
            const rowY = PADDING_TOP + ((HEIGHT - PADDING_TOP - PADDING_BOTTOM) / (this.rowCount - 1)) * row;
            const rowPaddingX = PADDING_X + ((this.rowCount - 1 - row) * this.pinDistanceX) / 2;
            const rowPins = [];

            for (let col = 0; col < 3 + row; ++col) {
                const colX = rowPaddingX + ((WIDTH - rowPaddingX * 2) / (3 + row - 1)) * col;
                const radius = this.pinRadius;

                // Screen coords (unpadded)
                const pinId = `p_${row}_${col}`;
                this.pins.push({ id: pinId, x: colX, y: rowY, radius });
                rowPins.push({ x: colX, y: rowY, radius });

                // Padded coords for physics (include ID for collision callback)
                this.paddedPins.push({ id: pinId, x: pad(colX), y: pad(rowY), radius });

                if (row === this.rowCount - 1) {
                    this.pinsLastRowXCoords.push(colX);
                }
            }
            this.pinGrid.push(rowPins);
        }

        // Create sinks (buckets) — detection zone must be BELOW the last row of pins
        const sinkWidth = this.pinDistanceX;
        const sinkHeight = 20;
        const sinkY = HEIGHT;  // Bottom edge of canvas
        const sinkCount = this.rowCount + 1;
        const sinksStartX = this.pinsLastRowXCoords[0] + sinkWidth / 2;

        for (let i = 0; i < sinkCount; i++) {
            this.sinks.push({
                x: sinksStartX + i * sinkWidth,
                y: sinkY,
                width: sinkWidth,
                height: sinkHeight,
                index: i
            });
        }
    }

    updateRowCount(newRowCount) {
        if (newRowCount === this.rowCount) return;
        this.removeAllBalls();
        this.rowCount = newRowCount;
        this.placePinsAndWalls();
    }

    updateRiskLevel(riskLevel) {
        this.riskLevel = riskLevel;
    }

    updateBetAmount(betAmount) {
        this.betAmount = betAmount;
    }

    updateBallStyle(color, image) {
        this.ballColor = color;
        this.ballImage = image;
    }

    removeAllBalls() {
        this.balls = [];
        this.betAmountOfExistingBalls = {};
    }

    hasOutstandingBalls() {
        return this.balls.length > 0;
    }
}

export default PlinkoEngine;
