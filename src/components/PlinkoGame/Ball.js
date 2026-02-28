// Custom Ball Physics - Deterministic Plinko Ball
// Port from plinko-stake-app/src/game/classes/Ball.ts
// Uses padding system (×10000) for deterministic floating-point math
// x, y, vx, vy are all in PADDED space. Only unpad() when drawing.

const DECIMAL_MULTIPLIER = 10000;
const pad = (n) => n * DECIMAL_MULTIPLIER;
const unpad = (n) => Math.floor(n / DECIMAL_MULTIPLIER);

// Image cache for ball sprites
const imageCache = new Map();

function loadImage(src) {
    if (!src) return null;
    if (imageCache.has(src)) return imageCache.get(src);
    const img = new Image();
    img.src = src;
    imageCache.set(src, img);
    return img;
}

export class Ball {
    constructor(x, y, radius, color, ctx, obstacles, sinks, onFinish, gravity, hFriction, vFriction, ballImage, onCollidePin) {
        // x, y are already in PADDED space
        this.x = x;
        this.y = y;
        this.radius = radius;       // visual radius (unpadded)
        this.color = color;
        this.ballImage = ballImage ? loadImage(ballImage) : null;
        this.vx = 0;
        this.vy = 0;
        this.ctx = ctx;
        this.obstacles = obstacles;  // pins: { id, x (padded), y (padded), radius (unpadded) }
        this.sinks = sinks;          // buckets: { x, y, width, height } (unpadded)
        this.onFinish = onFinish;
        this.onCollidePin = onCollidePin;
        this.finished = false;
        this.id = Math.random().toString(36).substr(2, 9);

        // Physics constants (configurable per rowCount)
        this.gravity = gravity || pad(0.6);
        this.horizontalFriction = hFriction || 0.4;
        this.verticalFriction = vFriction || 0.8;
    }

    draw() {
        if (this.finished) return;
        const ux = unpad(this.x);
        const uy = unpad(this.y);
        const r = this.radius;

        if (this.ballImage && this.ballImage.complete) {
            // Draw SVG/image centered
            this.ctx.drawImage(this.ballImage, ux - r, uy - r, r * 2, r * 2);
        } else {
            // Fallback: draw colored circle
            this.ctx.beginPath();
            this.ctx.arc(ux, uy, r, 0, Math.PI * 2);
            this.ctx.fillStyle = this.color || '#ff4d4f';
            this.ctx.fill();
            this.ctx.closePath();
        }
    }

    update() {
        if (this.finished) return;

        // Apply gravity (padded)
        this.vy += this.gravity;

        // Update position (padded)
        this.x += this.vx;
        this.y += this.vy;

        // Collision with obstacles (pins)
        for (const obstacle of this.obstacles) {
            const dx = this.x - obstacle.x;
            const dy = this.y - obstacle.y;
            const dist = Math.hypot(dx, dy);
            const minDist = pad(this.radius + obstacle.radius);

            if (dist < minDist) {
                const angle = Math.atan2(dy, dx);
                const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

                // Reflect with friction
                this.vx = Math.cos(angle) * speed * this.horizontalFriction;
                this.vy = Math.sin(angle) * speed * this.verticalFriction;

                // Push out to prevent sticking
                const overlap = this.radius + obstacle.radius - unpad(dist);
                this.x += pad(Math.cos(angle) * overlap);
                this.y += pad(Math.sin(angle) * overlap);

                // Notify collision manager for UI animations
                if (this.onCollidePin && obstacle.id) {
                    this.onCollidePin(obstacle.id);
                }
            }
        }

        // Check sinks (buckets) — sinks are in UNPADDED space
        const ux = unpad(this.x);
        const uy = unpad(this.y);

        for (let i = 0; i < this.sinks.length; i++) {
            const sink = this.sinks[i];
            if (
                ux > sink.x - sink.width / 2 &&
                ux < sink.x + sink.width / 2 &&
                (uy + this.radius) > (sink.y - sink.height / 2)
            ) {
                this.vx = 0;
                this.vy = 0;
                this.finished = true;
                this.onFinish(i);
                break;
            }
        }
    }

    isFinished() {
        return this.finished;
    }
}

export { pad, unpad, DECIMAL_MULTIPLIER };
export default Ball;
