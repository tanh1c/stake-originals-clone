// ===== Stake Crash Game Clone - JavaScript =====

// Game State
const gameState = {
    phase: 'waiting',
    multiplier: 1.00,
    countdown: 5,
    betPlaced: false,
    betAmount: 0,
    cashoutAt: 2.00,
    animationFrame: null,
    startTime: null,
    crashPoint: 0,
    elapsedTime: 0
};

// DOM Elements
const canvas = document.getElementById('crashChart');
const ctx = canvas.getContext('2d');
const multiplierValue = document.getElementById('multiplierValue');
const statusMessage = document.getElementById('statusMessage');
const statusText = statusMessage.querySelector('.status-text');
const betBtn = document.getElementById('betBtn');
const betAmountInput = document.getElementById('betAmount');
const cashoutAtInput = document.getElementById('cashoutAt');
const profitDisplay = document.getElementById('profitDisplay');
const gameHistory = document.getElementById('gameHistory');
const playerCount = document.getElementById('playerCount');
const totalBet = document.getElementById('totalBet');
const yAxisContainer = document.getElementById('yAxis');
const xAxisContainer = document.getElementById('xAxis');

// Canvas setup
function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
}

// Generate crash point
function generateCrashPoint() {
    const houseEdge = 0.04;
    const random = Math.random();
    if (random < houseEdge) return 1.00;
    const crashPoint = 0.99 / (1 - random);
    return Math.max(1.00, Math.min(crashPoint, 1000));
}

// Update Y Axis
function updateYAxis(maxMultiplier) {
    yAxisContainer.innerHTML = '';
    const steps = 6;
    for (let i = steps; i >= 1; i--) {
        const value = 1 + ((maxMultiplier - 1) * i / steps);
        const span = document.createElement('span');
        span.textContent = value.toFixed(1) + '×';
        yAxisContainer.appendChild(span);
    }
}

// Update X Axis
function updateXAxis(totalSeconds) {
    xAxisContainer.innerHTML = '';
    const steps = [4, 8, 12, 16];
    steps.forEach(s => {
        if (s <= totalSeconds + 4) {
            const span = document.createElement('span');
            span.textContent = s + 's';
            xAxisContainer.appendChild(span);
        }
    });
    const totalSpan = document.createElement('span');
    totalSpan.className = 'total-time';
    totalSpan.textContent = 'Total ' + Math.floor(totalSeconds) + 's';
    xAxisContainer.appendChild(totalSpan);
}

// Draw the crash curve with orange gradient fill
function drawCurve() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const padding = { left: 50, right: 20, top: 30, bottom: 50 };

    ctx.clearRect(0, 0, width, height);

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(47, 69, 83, 0.4)';
    ctx.lineWidth = 1;

    // Horizontal grid
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight * i / 5);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }

    // Vertical grid
    for (let i = 0; i <= 4; i++) {
        const x = padding.left + (chartWidth * i / 4);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
    }

    if (gameState.phase === 'running' || gameState.phase === 'crashed') {
        const elapsed = gameState.elapsedTime;
        const maxMultiplier = Math.max(gameState.multiplier * 1.2, 2);

        updateYAxis(maxMultiplier);
        updateXAxis(elapsed);

        // Create gradient for fill area (orange to darker orange) - matching original Stake
        const fillGradient = ctx.createLinearGradient(
            padding.left, height - padding.bottom,
            padding.left, padding.top
        );
        fillGradient.addColorStop(0, 'rgba(247, 147, 26, 0.3)');
        fillGradient.addColorStop(0.3, 'rgba(247, 147, 26, 0.6)');
        fillGradient.addColorStop(0.6, 'rgba(255, 180, 50, 0.85)');
        fillGradient.addColorStop(1, 'rgba(255, 200, 80, 0.95)');

        // Calculate curve points
        const points = [];
        const numPoints = 100;

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const timeAtPoint = elapsed * t;
            const multiplierAtPoint = Math.pow(Math.E, 0.1 * timeAtPoint);

            const x = padding.left + (chartWidth * t);
            const normalizedMultiplier = (multiplierAtPoint - 1) / (maxMultiplier - 1);
            const y = height - padding.bottom - (normalizedMultiplier * chartHeight);

            points.push({ x, y: Math.max(padding.top, y) });
        }

        // Draw filled area
        ctx.beginPath();
        ctx.moveTo(padding.left, height - padding.bottom);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = fillGradient;
        ctx.fill();

        // Draw curve line (white)
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = gameState.phase === 'crashed' ? '#ed4245' : '#ffffff';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Draw end point
        const lastPoint = points[points.length - 1];
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = gameState.phase === 'crashed' ? '#ed4245' : '#ffffff';
        ctx.fill();
    }
}

// Update multiplier display
function updateMultiplierDisplay() {
    multiplierValue.textContent = gameState.multiplier.toFixed(2);
    const display = document.querySelector('.multiplier-display');
    if (gameState.phase === 'crashed') {
        display.classList.add('crashed');
    } else {
        display.classList.remove('crashed');
    }
}

// Update status message
function updateStatusMessage() {
    if (gameState.phase === 'waiting') {
        statusMessage.classList.remove('hidden');
        statusText.textContent = `Starting in ${gameState.countdown.toFixed(1)}s`;
        statusText.style.background = 'linear-gradient(90deg, #f7931a, #ffc107)';
    } else if (gameState.phase === 'crashed') {
        statusMessage.classList.remove('hidden');
        statusText.textContent = `Crashed @${gameState.multiplier.toFixed(2)}×`;
        statusText.style.background = 'linear-gradient(90deg, #ed4245, #ff6b6b)';
    } else {
        statusMessage.classList.add('hidden');
    }
}

// Game loop
function gameLoop() {
    if (gameState.phase === 'running') {
        const elapsed = (Date.now() - gameState.startTime) / 1000;
        gameState.elapsedTime = elapsed;
        gameState.multiplier = Math.pow(Math.E, 0.1 * elapsed);

        if (gameState.multiplier >= gameState.crashPoint) {
            gameState.multiplier = gameState.crashPoint;
            gameState.phase = 'crashed';
            handleCrash();
        }

        updateMultiplierDisplay();
        drawCurve();

        if (gameState.phase === 'running') {
            gameState.animationFrame = requestAnimationFrame(gameLoop);
        }
    }
}

// Handle crash
function handleCrash() {
    addToHistory(gameState.multiplier);
    updateStatusMessage();
    drawCurve();

    betBtn.textContent = 'Bet (Next Round)';
    betBtn.classList.remove('cashout');
    betBtn.disabled = false;
    gameState.betPlaced = false;

    setTimeout(() => startCountdown(), 3000);
}

// Add to history
function addToHistory(multiplier) {
    const category = multiplier < 2 ? 'low' : multiplier < 10 ? 'medium' : 'high';
    const pill = document.createElement('span');
    pill.className = `history-pill ${category}`;
    pill.textContent = `${multiplier.toFixed(2)}×`;
    gameHistory.insertBefore(pill, gameHistory.firstChild);
    while (gameHistory.children.length > 15) {
        gameHistory.removeChild(gameHistory.lastChild);
    }
}

// Start countdown
function startCountdown() {
    gameState.phase = 'waiting';
    gameState.countdown = 5;
    gameState.multiplier = 1.00;
    gameState.elapsedTime = 0;

    updateMultiplierDisplay();
    updateStatusMessage();
    updateYAxis(2);
    updateXAxis(0);
    drawCurve();

    const countdownInterval = setInterval(() => {
        gameState.countdown -= 0.1;
        updateStatusMessage();
        if (gameState.countdown <= 0) {
            clearInterval(countdownInterval);
            startRound();
        }
    }, 100);
}

// Start round
function startRound() {
    gameState.phase = 'running';
    gameState.startTime = Date.now();
    gameState.crashPoint = generateCrashPoint();

    if (gameState.betPlaced) {
        betBtn.textContent = `Cash Out @${gameState.multiplier.toFixed(2)}×`;
        betBtn.classList.add('cashout');
    }

    updateStatusMessage();
    gameLoop();
}

// Bet button handler
function handleBet() {
    if (gameState.phase === 'waiting') {
        const amount = parseFloat(betAmountInput.value) || 0;
        if (amount > 0) {
            gameState.betPlaced = true;
            gameState.betAmount = amount;
            betBtn.textContent = 'Cancel';
        }
    } else if (gameState.phase === 'running' && gameState.betPlaced) {
        const profit = gameState.betAmount * gameState.multiplier;
        showWinAnimation(profit);
        gameState.betPlaced = false;
        betBtn.textContent = 'Bet (Next Round)';
        betBtn.classList.remove('cashout');
    }
}

// Win animation
function showWinAnimation(amount) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        padding: 20px 40px; background: linear-gradient(135deg, #00e701, #00c700);
        border-radius: 12px; font-size: 24px; font-weight: 700; color: #000;
        z-index: 1000; animation: winPop 0.5s ease;
        box-shadow: 0 10px 40px rgba(0, 231, 1, 0.5);
    `;
    notification.textContent = `+${amount.toFixed(8)} BTC`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

// Calculate profit
function calculateProfit() {
    const amount = parseFloat(betAmountInput.value) || 0;
    const cashout = parseFloat(cashoutAtInput.value) || 2;
    profitDisplay.value = (amount * (cashout - 1)).toFixed(8);
}

// Simulate players
function simulatePlayers() {
    setInterval(() => {
        playerCount.textContent = 200 + Math.floor(Math.random() * 300);
        totalBet.textContent = '$' + (2000 + Math.random() * 3000).toFixed(2);
    }, 3000);
}

// Initialize history
function initHistory() {
    const samples = [5.84, 169, 1.06, 9.47, 5.75, 1.43, 1.22, 4.77, 1.31];
    samples.forEach(m => addToHistory(m));
}

// Event listeners
betBtn.addEventListener('click', handleBet);
betAmountInput.addEventListener('input', calculateProfit);
cashoutAtInput.addEventListener('input', calculateProfit);

document.getElementById('halfBtn').addEventListener('click', () => {
    betAmountInput.value = (parseFloat(betAmountInput.value) / 2 || 0).toFixed(8);
    calculateProfit();
});

document.getElementById('doubleBtn').addEventListener('click', () => {
    betAmountInput.value = (parseFloat(betAmountInput.value) * 2 || 0).toFixed(8);
    calculateProfit();
});

document.getElementById('cashoutUp').addEventListener('click', () => {
    cashoutAtInput.value = (parseFloat(cashoutAtInput.value) + 0.1 || 2).toFixed(2);
    calculateProfit();
});

document.getElementById('cashoutDown').addEventListener('click', () => {
    cashoutAtInput.value = Math.max(1.01, parseFloat(cashoutAtInput.value) - 0.1).toFixed(2);
    calculateProfit();
});

document.querySelectorAll('.bet-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.bet-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    });
});

document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    });
});

window.addEventListener('resize', () => { setupCanvas(); drawCurve(); });

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `@keyframes winPop { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; } 50% { transform: translate(-50%, -50%) scale(1.1); } 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }}`;
document.head.appendChild(style);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupCanvas();
    initHistory();
    updateYAxis(2);
    updateXAxis(0);
    drawCurve();
    calculateProfit();
    simulatePlayers();
    setTimeout(startCountdown, 1000);
});
