// DinoGame - React Wrapper integrating original Phaser game with betting
import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import {
    Button,
    Space,
    Tooltip,
    Typography,
    Modal,
    Drawer,
    Statistic,
    Row,
    Col,
    Card,
    Tag,
    App,
    Progress,
    InputNumber,
    Radio,
    Input,
    Divider,
    Popover,
    Switch
} from 'antd';
import {
    SettingOutlined,
    ExpandOutlined,
    BarChartOutlined,
    SafetyCertificateOutlined,
    SoundOutlined,
    FullscreenExitOutlined,
    TrophyOutlined,
    ThunderboltOutlined,
    CheckCircleOutlined,
    FireOutlined,
    StarOutlined,
    PlayCircleOutlined,
    StopOutlined,
    SyncOutlined,
    BugOutlined,
    CloseOutlined,
    BulbOutlined,
    LineChartOutlined,
    ReloadOutlined,
    RightOutlined
} from '@ant-design/icons';
import Chart from 'chart.js/auto';

// Import game config and scenes from original source
import CONFIG from './core/config/game';
import BootScene from './core/scenes/boot/BootScene';
import GameScene from './core/scenes/game/GameScene';
import ProvablyFair from '../../utils/ProvablyFair';

import { useWallet } from '../../context/WalletContext';
import './DinoGame.css';

const { Text, Title, Paragraph } = Typography;

// Difficulty presets
const DIFFICULTIES = {
    easy: { label: 'Easy', survivalChance: 0.85, multiplierPerJump: 1.15, color: '#00e701' },
    medium: { label: 'Medium', survivalChance: 0.65, multiplierPerJump: 1.40, color: '#f7931a' },
    hard: { label: 'Hard', survivalChance: 0.45, multiplierPerJump: 1.90, color: '#ed4245' },
};

const DEFAULT_BALANCE = 200;

// Create the extended Game class
class DinoGameInstance extends Phaser.Game {
    static CONFIG = CONFIG.GAME;

    constructor(config, callbacks) {
        super(config);
        this.callbacks = callbacks;
        this.registerResizeHandler();
        this.addScenes();
        this.startScene();
    }

    registerResizeHandler() {
        this.scale.on('resize', () => {
            const { parentSize } = this.scale;
            const { width, height } = parentSize;

            if (width === this.prevParentWidth && height === this.prevParentHeight) {
                return;
            }

            this.prevParentWidth = width;
            this.prevParentHeight = height;
            this.resize(parentSize);
        });
    }

    addScenes() {
        this.scene.add(BootScene.CONFIG.NAME, BootScene);
        this.scene.add(GameScene.CONFIG.NAME, GameScene);
    }

    startScene() {
        this.scene.start(BootScene.CONFIG.NAME);
    }

    resize(parentSize) {
        const { width: parentWidth, height: parentHeight } = parentSize;
        const gameWidth = parentWidth < parentHeight
            ? DinoGameInstance.CONFIG.WIDTH.PORTRAIT
            : DinoGameInstance.CONFIG.WIDTH.LANDSCAPE;
        const gameHeight = DinoGameInstance.CONFIG.HEIGHT;

        this.canvas.style.width = `${parentWidth}px`;
        this.canvas.style.height = `${gameHeight * (parentWidth / gameWidth)}px`;
        this.scale.resize(gameWidth, gameHeight);
    }
}

function DinoGame() {
    App.useApp();
    const { balance, placeBet: walletPlaceBet, addWinnings, showToast } = useWallet();
    const [betAmount, setBetAmount] = useState(1);
    const [difficulty, setDifficulty] = useState('medium');
    const [gamePhase, setGamePhase] = useState('idle'); // idle | betting | running | waiting | crashed | cashed_out
    const [obstaclesCleared, setObstaclesCleared] = useState(0);
    const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
    const [potentialWin, setPotentialWin] = useState(0);
    const [lastResult, setLastResult] = useState(null);

    // Stats
    const [gamesPlayed, setGamesPlayed] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [totalWagered, setTotalWagered] = useState(0);
    const [totalProfit, setTotalProfit] = useState(0);

    // UI
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [statsDrawerOpen, setStatsDrawerOpen] = useState(false);
    const [fairnessModalOpen, setFairnessModalOpen] = useState(false);
    const [isDebugMode, setIsDebugMode] = useState(false);
    const [debugData, setDebugData] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [winRecords, setWinRecords] = useState([]);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [hoveredProfitValue, setHoveredProfitValue] = useState(null);

    const gameContainerRef = useRef(null);
    const phaserContainerRef = useRef(null);
    const gameRef = useRef(null);
    const gameSceneRef = useRef(null);
    const betAmountRef = useRef(1);
    const difficultyRef = useRef('medium');
    const gamePhaseRef = useRef('idle');
    const placeBetRef = useRef(null);

    const widgetRef = useRef(null);
    const chartCanvasRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const profitHistoryRef = useRef([0]);
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // Provably Fair
    const fairnessRef = useRef(null);
    const [fairnessData, setFairnessData] = useState({
        serverSeedHash: 'Loading...',
        clientSeed: 'Loading...',
        nonce: 0,
    });
    const [revealedSeed, setRevealedSeed] = useState(null);
    const [clientSeedInput, setClientSeedInput] = useState('');

    // Debug Widget Refs
    const debugWidgetRef = useRef(null);
    const isDebugDragging = useRef(false);
    const debugDragOffset = useRef({ x: 0, y: 0 });

    // Initialize ProvablyFair
    useEffect(() => {
        const pf = new ProvablyFair();
        fairnessRef.current = pf;
        pf.waitReady().then(async () => {
            const data = await pf.getFairnessData();
            setFairnessData(data);
            setClientSeedInput(data.clientSeed);
        });
    }, []);

    // Keep refs in sync
    useEffect(() => { betAmountRef.current = betAmount; }, [betAmount]);
    useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);
    useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);

    // Force Dark Mode on game canvas when setting changes
    useEffect(() => {
        if (gameSceneRef.current && gameRef.current) {
            gameSceneRef.current.events.emit('FORCE_DARK_MODE', isDarkMode);
        }
    }, [isDarkMode]);

    // Fetch peek data for Fairness Debug whenever conditions change
    useEffect(() => {
        const pf = fairnessRef.current;
        if (isDebugMode && pf && pf._hashReady) {
            const diff = DIFFICULTIES[difficulty];
            pf.peekDinoStep(diff.survivalChance).then(data => {
                setDebugData(data);
            }).catch(err => console.error("Peek info error:", err));
        }
    }, [isDebugMode, fairnessData, difficulty, gamePhase]);

    // Calculate multiplier from obstacles cleared with precise 99% RTP
    const getMultiplierForCleared = useCallback((cleared) => {
        if (cleared <= 0) return 1.00;
        const diff = DIFFICULTIES[difficulty];

        // Survivor probability for 'cleared' hurdles
        const probability = Math.pow(diff.survivalChance, cleared);

        // 0.99 is 99% RTP (Return To Player) -> 1% house edge
        const pureMultiplier = 0.99 / probability;

        // Floor to 2 decimals like Stake
        return parseFloat((Math.floor(pureMultiplier * 100) / 100).toFixed(2));
    }, [difficulty]);

    // Initialize Phaser game
    useEffect(() => {
        if (!phaserContainerRef.current || gameRef.current) return;

        const config = {
            type: Phaser.AUTO,
            parent: phaserContainerRef.current,
            backgroundColor: '#fff',
            render: { antialias: false },
            scale: {
                width: CONFIG.GAME.WIDTH.LANDSCAPE,
                height: CONFIG.GAME.HEIGHT,
                mode: Phaser.Scale.ScaleModes.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH,
            },
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0 },
                    debug: false,
                },
            },
        };

        gameRef.current = new DinoGameInstance(config, {});

        // Wait for GameScene to be ready and hook into events
        const checkGame = setInterval(() => {
            const game = gameRef.current;
            if (game?.scene?.scenes?.length > 1) {
                const gameScene = game.scene.getScene('SCENE_GAME');
                if (gameScene && gameScene.events) {
                    gameSceneRef.current = gameScene;

                    // Hook into GAME_START and GAME_RESTART events
                    const onGameStartOrRestart = () => {
                        if (gamePhaseRef.current === 'betting') {
                            setGamePhase('running');
                            // Enable betting mode in Phaser
                            gameScene.events.emit(CONFIG.EVENTS.BETTING_MODE_ON);
                        }
                    };

                    gameScene.events.on(CONFIG.EVENTS.GAME_START, onGameStartOrRestart);
                    gameScene.events.on(CONFIG.EVENTS.GAME_RESTART, onGameStartOrRestart);

                    // Hook into WAITING_FOR_JUMP event (Phaser detected obstacle)
                    gameScene.events.on(CONFIG.EVENTS.WAITING_FOR_JUMP, (cleared) => {
                        setGamePhase('waiting');
                        setObstaclesCleared(cleared);
                    });

                    // Sync dark mode once scene is ready
                    gameScene.events.emit('FORCE_DARK_MODE', isDarkMode);

                    // Hook into GAME_OVER event
                    gameScene.events.on(CONFIG.EVENTS.GAME_OVER, (finalScore, hi) => {
                        if (gamePhaseRef.current === 'running' || gamePhaseRef.current === 'waiting') {
                            setGamePhase('crashed');
                            gamePhaseRef.current = 'crashed'; // Immediate sync to prevent multiple triggers
                            setTotalProfit(prev => prev - betAmountRef.current);
                            setWinRecords(prev => [...prev, -betAmountRef.current]);
                            setLastResult({
                                type: 'loss',
                                obstaclesCleared: gameSceneRef.current?.obstaclesCleared || 0,
                                amount: betAmountRef.current,
                            });

                            showToast('loss', 'Dino Crashed!', `-₿${betAmountRef.current.toFixed(2)}`, 3000);
                        }
                    });

                    // Listen to UI restart from Phaser canvas
                    gameScene.events.on('UI_RESTART_REQUEST', () => {
                        if (placeBetRef.current) {
                            placeBetRef.current();
                        }
                    });

                    clearInterval(checkGame);
                }
            }
        }, 100);

        return () => {
            clearInterval(checkGame);
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
                gameSceneRef.current = null;
            }
        };
    }, []);

    // Place bet
    const placeBet = useCallback(() => {
        if (betAmount <= 0 || betAmount > balance) return;

        walletPlaceBet(betAmount);
        setTotalWagered(prev => prev + betAmount);
        setGamesPlayed(prev => prev + 1);
        setGamePhase('betting');
        setObstaclesCleared(0);
        setCurrentMultiplier(1.00);
        setPotentialWin(betAmount);
        setLastResult(null);

        showToast('bet', 'Game Started', `₿${betAmount.toFixed(2)} — ${DIFFICULTIES[difficulty].label}`, 2500);

        // Trigger game start immediately without spacebar
        if (gameSceneRef.current) {
            // Need to update ref synchronously so the listener catches it this tick
            gamePhaseRef.current = 'betting';

            const scene = gameSceneRef.current;
            if (scene.isInitialStart) {
                scene.events.emit(CONFIG.EVENTS.GAME_START);
            } else {
                scene.events.emit(CONFIG.EVENTS.GAME_RESTART);
            }
        }
    }, [betAmount, balance, difficulty, showToast, walletPlaceBet]);

    // Keep placeBet ref updated for Phaser to call
    useEffect(() => {
        placeBetRef.current = placeBet;
    }, [placeBet]);

    // Jump (gamble for next obstacle) - uses ProvablyFair
    const handleJump = useCallback(async () => {
        if (gamePhase !== 'waiting') return;
        const gameScene = gameSceneRef.current;
        if (!gameScene) return;

        const diff = DIFFICULTIES[difficultyRef.current];
        const pf = fairnessRef.current;

        let survived;
        if (pf) {
            // Use ProvablyFair HMAC-SHA256
            const result = await pf.generateDinoStep(diff.survivalChance);
            survived = result.survived;
            console.log(`[DINO FAIR] roll=${result.roll.toFixed(4)}, survivalChance=${diff.survivalChance}, survived=${survived}, nonce=${pf.nonce}`);
            // Update fairness data
            const data = await pf.getFairnessData();
            setFairnessData(data);
        } else {
            // Fallback
            survived = Math.random() < diff.survivalChance;
            console.log(`[DINO FAIR] fallback, survived=${survived}`);
        }

        if (survived) {
            // RNG says survive!
            gameScene.events.emit(CONFIG.EVENTS.JUMP_SUCCESS);
            const newCleared = obstaclesCleared + 1;
            const newMult = getMultiplierForCleared(newCleared);
            setObstaclesCleared(newCleared);
            setCurrentMultiplier(newMult);
            setPotentialWin(betAmountRef.current * newMult);
            // Keep gamePhase as 'running' - the next WAITING_FOR_JUMP event
            // will set it to 'waiting' when the next obstacle approaches
            setGamePhase('running');

            if (newCleared > highScore) setHighScore(newCleared);

            showToast('win', 'Obstacle Cleared!', `Jump ${newCleared} — ${newMult.toFixed(2)}×`, 1500);
        } else {
            // RNG says die!
            gameScene.events.emit(CONFIG.EVENTS.JUMP_FAIL);
            // Don't change gamePhase here - GAME_OVER event from Phaser will handle it
        }
    }, [gamePhase, obstaclesCleared, getMultiplierForCleared, highScore, showToast]);

    // Cash out
    const cashOut = useCallback(() => {
        if (gamePhase !== 'waiting' && gamePhase !== 'running') return;
        const gameScene = gameSceneRef.current;

        const winAmount = betAmountRef.current * currentMultiplier;
        addWinnings(winAmount);
        const profit = winAmount - betAmountRef.current;
        setTotalProfit(prev => prev + profit);
        setWinRecords(prev => [...prev, profit]);
        setLastResult({
            type: 'win',
            obstaclesCleared,
            multiplier: currentMultiplier,
            amount: winAmount,
        });
        setGamePhase('cashed_out');
        gamePhaseRef.current = 'cashed_out'; // Immediate sync to prevent GAME_OVER listener from logging a loss

        // Disable betting mode and trigger game over to reset
        if (gameScene) {
            gameScene.events.emit(CONFIG.EVENTS.BETTING_MODE_OFF);
            gameScene.events.emit(CONFIG.EVENTS.GAME_OVER, gameScene.score, gameScene.highScore);
        }

        showToast('win', 'Cashed Out!', `+₿${(winAmount - betAmountRef.current).toFixed(2)} at ${currentMultiplier.toFixed(2)}×`, 4000);
    }, [gamePhase, currentMultiplier, obstaclesCleared, showToast]);

    // Fullscreen
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            gameContainerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    // Handle client seed change
    const handleChangeClientSeed = useCallback(async () => {
        const pf = fairnessRef.current;
        if (!pf || !clientSeedInput) return;
        await pf.setClientSeed(clientSeedInput);
        const data = await pf.getFairnessData();
        setFairnessData(data);
    }, [clientSeedInput]);

    // Handle seed rotation (reveals current seed)
    const handleRotateSeed = useCallback(async () => {
        const pf = fairnessRef.current;
        if (!pf) return;
        const revealed = await pf.rotateSeed();
        setRevealedSeed(revealed);
        const data = await pf.getFairnessData();
        setFairnessData(data);
        setClientSeedInput(data.clientSeed);
    }, []);

    // Destroy chart when window closes
    useEffect(() => {
        if (!statsDrawerOpen) {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        }
    }, [statsDrawerOpen]);

    // Setup Chart.js
    useEffect(() => {
        if (!statsDrawerOpen || !chartCanvasRef.current) return;

        const WIN_COLOR = 'rgb(74, 222, 128)';
        const WIN_COLOR_FILL = 'rgba(74, 222, 128, 0.3)';
        const LOSS_COLOR = 'rgb(248, 113, 113)';
        const LOSS_COLOR_FILL = 'rgba(248, 113, 113, 0.3)';
        const X_AXIS_COLOR = '#2a3f4d';
        const POINT_HOVER_COLOR = '#fff';

        const profitHistory = [0];
        let runningTotal = 0;
        winRecords.forEach(profit => {
            runningTotal += profit;
            profitHistory.push(runningTotal);
        });
        profitHistoryRef.current = profitHistory;

        if (chartInstanceRef.current) {
            chartInstanceRef.current.data.labels = Array(profitHistory.length).fill(0);
            chartInstanceRef.current.data.datasets[0].data = profitHistory;
            chartInstanceRef.current.update();
        } else {
            chartInstanceRef.current = new Chart(chartCanvasRef.current, {
                type: 'line',
                data: {
                    labels: Array(profitHistory.length).fill(0),
                    datasets: [
                        {
                            label: 'Profit',
                            data: profitHistory,
                            fill: { target: 'origin', above: WIN_COLOR_FILL, below: LOSS_COLOR_FILL },
                            cubicInterpolationMode: 'monotone',
                            segment: {
                                borderColor: (ctx) => {
                                    if (!ctx.p0 || !ctx.p1) return WIN_COLOR;
                                    const y0 = ctx.p0.parsed.y;
                                    const y1 = ctx.p1.parsed.y;
                                    if (y1 === 0) return y0 < 0 ? LOSS_COLOR : WIN_COLOR;
                                    return y1 < 0 ? LOSS_COLOR : WIN_COLOR;
                                },
                            },
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointHoverBackgroundColor: POINT_HOVER_COLOR,
                            pointHoverBorderColor: POINT_HOVER_COLOR,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animations: { y: { duration: 0 } },
                    interaction: { intersect: false, mode: 'index' },
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                    scales: {
                        x: { display: false },
                        y: {
                            border: { display: false },
                            grid: { color: (ctx) => (ctx.tick.value === 0 ? X_AXIS_COLOR : 'transparent'), lineWidth: 2 },
                            ticks: { display: false },
                            grace: '1%',
                        },
                    },
                    onHover: (_, elements) => {
                        if (elements.length) {
                            const idx = elements[0].index;
                            const val = profitHistoryRef.current[idx];
                            setHoveredProfitValue(val !== undefined ? val : null);
                        } else {
                            setHoveredProfitValue(null);
                        }
                    },
                },
            });
        }
    }, [statsDrawerOpen, winRecords]);

    // Drag handler for debug widget
    const handleDebugDragStart = useCallback((e) => {
        if (!debugWidgetRef.current) return;
        isDebugDragging.current = true;
        const rect = debugWidgetRef.current.getBoundingClientRect();
        debugDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        const handleMouseMove = (moveEvt) => {
            if (!isDebugDragging.current || !debugWidgetRef.current) return;
            const newX = moveEvt.clientX - debugDragOffset.current.x;
            const newY = moveEvt.clientY - debugDragOffset.current.y;
            // Clamp to viewport
            const maxX = window.innerWidth - debugWidgetRef.current.offsetWidth;
            const maxY = window.innerHeight - debugWidgetRef.current.offsetHeight;
            debugWidgetRef.current.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
            debugWidgetRef.current.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
            debugWidgetRef.current.style.right = 'auto';
            debugWidgetRef.current.style.bottom = 'auto';
            debugWidgetRef.current.style.transform = 'none'; // Prevents centering transform from messing up
        };

        const handleMouseUp = () => {
            isDebugDragging.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, []);

    // Drag handler for Live Stats widget
    const handleDragStart = useCallback((e) => {
        if (!widgetRef.current) return;
        isDragging.current = true;
        const rect = widgetRef.current.getBoundingClientRect();
        dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        const handleMouseMove = (moveEvt) => {
            if (!isDragging.current || !widgetRef.current) return;
            const newX = moveEvt.clientX - dragOffset.current.x;
            const newY = moveEvt.clientY - dragOffset.current.y;
            // Clamp to viewport
            const maxX = window.innerWidth - widgetRef.current.offsetWidth;
            const maxY = window.innerHeight - widgetRef.current.offsetHeight;
            widgetRef.current.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
            widgetRef.current.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
            widgetRef.current.style.right = 'auto';
            widgetRef.current.style.bottom = 'auto';
            widgetRef.current.style.transform = 'none'; // Clear any residual transform
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, []);

    const diffConfig = DIFFICULTIES[difficulty];
    const isPlaying = gamePhase === 'running' || gamePhase === 'waiting';
    const canBet = gamePhase === 'idle' || gamePhase === 'crashed' || gamePhase === 'cashed_out';

    const winsCount = winRecords.filter(r => r > 0).length;
    const lossesCount = winRecords.filter(r => r < 0).length;

    return (
        <div className="dino-game-page" ref={gameContainerRef}>
            <div className="dino-main">
                <div className="dino-container">
                    {/* Betting Sidebar */}
                    <div className="dino-sidebar">
                        {/* Bet Mode Tabs */}
                        <div className="bet-mode-tabs">
                            <button className="bet-mode-tab active">Manual</button>
                            <button className="bet-mode-tab" disabled>Auto</button>
                        </div>

                        {/* Bet Amount */}
                        <div className="form-group">
                            <div className="form-header">
                                <label className="form-label" style={{ margin: 0 }}>Bet Amount</label>
                                <Text type="secondary" style={{ margin: 0 }}>₿{(betAmount ?? 0).toFixed(2)}</Text>
                            </div>
                            <div className="input-row">
                                <InputNumber
                                    value={betAmount}
                                    onChange={(val) => setBetAmount(Math.max(0.1, isNaN(Number(val)) ? 0.1 : Number(val)))}
                                    min={0.1}
                                    step={0.1}
                                    disabled={!canBet}
                                    style={{ flex: 1 }}
                                    controls={false}
                                    formatter={(v) => `${v}`}
                                    parser={(v) => v.replace(/\$\s?|(,*)/g, '')}
                                    addonBefore={
                                        <div className="dino-currency-icon">₿</div>
                                    }
                                />
                                <Button.Group className="dino-btn-group">
                                    <Button
                                        onClick={() => setBetAmount(prev => Math.max(0.1, parseFloat((Number(prev || 0.1) / 2).toFixed(2))))}
                                        disabled={!canBet}
                                    >
                                        ½
                                    </Button>
                                    <Button
                                        onClick={() => setBetAmount(prev => Math.min(balance, parseFloat((Number(prev || 0.1) * 2).toFixed(2))))}
                                        disabled={!canBet}
                                    >
                                        2×
                                    </Button>
                                </Button.Group>
                            </div>
                            {betAmount > balance && (
                                <p className="error-text">Can't bet more than your balance!</p>
                            )}
                        </div>

                        {/* Difficulty Selector */}
                        <div className="form-group difficulty-section">
                            <div className="form-header" style={{ marginBottom: 12 }}>
                                <label className="form-label" style={{ margin: 0 }}>Difficulty</label>
                                <div
                                    className="survive-badge"
                                    style={{ '--diff-color': diffConfig.color }}
                                >
                                    <div className="survive-indicator"></div>
                                    {Math.round(diffConfig.survivalChance * 100)}% Survive
                                </div>
                            </div>
                            <div className="difficulty-tabs">
                                {Object.entries(DIFFICULTIES).map(([key, val]) => (
                                    <button
                                        key={key}
                                        className={`diff-tab ${difficulty === key ? 'active' : ''}`}
                                        onClick={() => setDifficulty(key)}
                                        disabled={!canBet}
                                        style={{ '--diff-color': val.color }}
                                    >
                                        {val.label}
                                    </button>
                                ))}
                            </div>
                            <div className="difficulty-info">
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    Provable Fairness: <span style={{ color: '#00e701', fontWeight: 'bold' }}>99.00%</span> RTP
                                </Text>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        {canBet && (
                            <button
                                className="bet-button"
                                onClick={placeBet}
                                disabled={betAmount <= 0 || betAmount > balance}
                            >
                                <PlayCircleOutlined /> {gamePhase === 'idle' ? 'Place Bet' : 'Play Again'}
                            </button>
                        )}

                        {(gamePhase === 'running' || gamePhase === 'waiting') && (
                            <div className="jump-decision">
                                <button
                                    className="bet-button jump-btn"
                                    style={{ marginBottom: '12px' }}
                                    onClick={handleJump}
                                    disabled={gamePhase !== 'waiting'}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <ThunderboltOutlined /> JUMP!
                                        </div>
                                        <div style={{ fontSize: '12px', fontWeight: '500', color: gamePhase === 'waiting' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)', textTransform: 'none', marginTop: '4px' }}>
                                            Risk for {getMultiplierForCleared(obstaclesCleared + 1).toFixed(2)}×
                                        </div>
                                    </div>
                                </button>
                                <button
                                    className="bet-button"
                                    onClick={cashOut}
                                    disabled={!(gamePhase === 'waiting' || (gamePhase === 'running' && obstaclesCleared > 0))}
                                >
                                    <TrophyOutlined /> Cash Out ₿{(betAmount * currentMultiplier).toFixed(2)}
                                </button>
                            </div>
                        )}

                        {/* Current Status Card */}
                        {isPlaying && (
                            <div className="last-win-card current">
                                <div className="last-win-header">
                                    <FireOutlined className="fire-icon" />
                                    <span>Current Run</span>
                                </div>
                                <div className="last-win-multiplier" style={{ '--run-color': diffConfig.color }}>
                                    {currentMultiplier.toFixed(2)}×
                                </div>
                                <div className="last-win-amount">
                                    +₿{(betAmount * currentMultiplier).toFixed(2)}
                                </div>
                                <div className="last-win-score">
                                    Cleared {obstaclesCleared} obstacles
                                </div>
                            </div>
                        )}



                        {/* Last Result Card */}
                        {lastResult && (
                            <div className={`last-win-card ${lastResult.type === 'loss' ? 'lost' : 'won'}`}>
                                <div className="last-win-header">
                                    <TrophyOutlined />
                                    <span>Last Game</span>
                                </div>
                                {lastResult.type === 'loss' ? (
                                    <>
                                        <div className="last-win-result lost">💀 Crashed!</div>
                                        <div className="last-win-score">Cleared {lastResult.obstaclesCleared} obstacles</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="last-win-multiplier">{lastResult.multiplier.toFixed(2)}×</div>
                                        <div className="last-win-amount">+₿{lastResult.amount.toFixed(2)}</div>
                                        <div className="last-win-score">Cleared {lastResult.obstaclesCleared} obstacles</div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="sidebar-footer">
                            <Tooltip title="Live Stats">
                                <Button type="text" icon={<LineChartOutlined />} className="footer-btn" onClick={() => setStatsDrawerOpen(true)} />
                            </Tooltip>
                            <Tooltip title="Dashboard">
                                <Button type="text" icon={<BarChartOutlined />} className="footer-btn" onClick={() => setHistoryModalOpen(true)} />
                            </Tooltip>
                            <Tooltip title="Fairness">
                                <Button type="text" icon={<SafetyCertificateOutlined />} className="footer-btn" onClick={() => setFairnessModalOpen(true)} />
                            </Tooltip>
                        </div>
                    </div>

                    {/* Game Area */}
                    <div className="dino-game-area">
                        <div className="game-hud">
                            <div className="hud-item score">
                                <span className="hud-label">Jumps</span>
                                <span className="hud-value">{obstaclesCleared}</span>
                            </div>
                            <div className="hud-item highscore">
                                <span className="hud-label">Best</span>
                                <span className="hud-value">{highScore}</span>
                            </div>
                            {isPlaying && (
                                <div className="hud-item multiplier">
                                    <span className="hud-value multiplier-glow" style={{ color: diffConfig.color }}>
                                        {currentMultiplier.toFixed(2)}×
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Phaser Game Container */}
                        <div ref={phaserContainerRef} className="phaser-container" />

                        {gamePhase === 'idle' && (
                            <div className="bet-overlay">
                                <div className="bet-overlay-content">
                                    <div className="dino-icon">🦖</div>
                                    <div className="overlay-title">Dino Gamble</div>
                                    <div className="overlay-subtitle">Place your bet to start the run!</div>
                                </div>
                            </div>
                        )}

                        {gamePhase === 'waiting' && (
                            <div className="obstacle-warning">
                                <div className="warning-pulse">⚠️ OBSTACLE AHEAD!</div>
                                <div className="warning-sub">Jump or Cash Out?</div>
                            </div>
                        )}

                        {/* Debug Overlay */}
                        {isDebugMode && fairnessData && (
                            <div className="fixed-widget debug-widget fade-in-scale" ref={debugWidgetRef}>
                                <div className="widget-header debug-widget-header" onMouseDown={handleDebugDragStart}>
                                    <div className="widget-title">
                                        <BugOutlined style={{ color: '#00e701', fontSize: 18 }} />
                                        <span style={{ color: '#00e701' }}>FAIRNESS DEBUG</span>
                                    </div>
                                    <div className="widget-actions">
                                        <button className="widget-btn-icon" onMouseDown={(e) => e.stopPropagation()} onClick={() => setIsDebugMode(false)}>
                                            <CloseOutlined />
                                        </button>
                                    </div>
                                </div>
                                <div className="widget-content debug-widget-content">
                                    <div className="debug-row">
                                        <span className="debug-label">Next Hash:</span>
                                        <span className="debug-value">{fairnessData.serverSeedHash?.substring(0, 16) || fairnessData.serverSeed?.substring(0, 16)}...</span>
                                    </div>
                                    <div className="debug-row">
                                        <span className="debug-label">Client Seed:</span>
                                        <span className="debug-value">{fairnessData.clientSeed?.substring(0, 10)}...</span>
                                    </div>
                                    <div className="debug-row">
                                        <span className="debug-label">Next Nonce:</span>
                                        <span className="debug-value">{fairnessData.nonce}</span>
                                    </div>
                                    <div className="debug-target">
                                        DIFFICULTY: <span className="target-bin">{DIFFICULTIES[difficulty].label}</span>
                                        <div style={{ fontSize: 13, color: '#fff', marginTop: 4, textShadow: 'none' }}>
                                            Survival Chance: <span style={{ color: '#00e701' }}>{Math.round(DIFFICULTIES[difficulty].survivalChance * 100)}%</span>
                                        </div>
                                    </div>

                                    {debugData && (
                                        <div className="debug-path-row" style={{ marginTop: 12 }}>
                                            <div style={{ color: '#b1bad3', fontSize: 11, width: '100%', textAlign: 'center', marginBottom: 4 }}>NEXT ROLL PREDICTION</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                <span style={{ color: '#fff', fontSize: 16 }}>
                                                    Roll: <span style={{ color: '#00b4d8' }}>{(debugData.roll * 100).toFixed(2)}</span>
                                                </span>
                                                <span style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                                                    Status: <span style={{ color: debugData.survived ? '#00e701' : '#ff4d4f' }}>
                                                        {debugData.survived ? 'SURVIVE' : 'CRASH'}
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Bottom Controls */}
                        <div className="game-controls">
                            <Space>
                                <Popover
                                    content={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 8px' }}>
                                            <BulbOutlined style={{ fontSize: 16, color: isDarkMode ? '#f7931a' : '#8c9bac' }} />
                                            <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>Canvas Dark Mode</span>
                                            <Switch size="small" checked={isDarkMode} onChange={setIsDarkMode} />
                                        </div>
                                    }
                                    title={null}
                                    trigger="click"
                                    placement="topLeft"
                                    overlayInnerStyle={{ background: '#1a2c38', border: '1px solid #2a3f4d', borderRadius: 8 }}
                                >
                                    <Tooltip title="Settings">
                                        <Button type="text" icon={<SettingOutlined />} className="control-btn" />
                                    </Tooltip>
                                </Popover>
                                <Tooltip title="Fullscreen">
                                    <Button type="text" icon={isFullscreen ? <FullscreenExitOutlined /> : <ExpandOutlined />} className="control-btn" onClick={toggleFullscreen} />
                                </Tooltip>
                                <Tooltip title={soundEnabled ? "Mute" : "Unmute"}>
                                    <Button type="text" icon={<SoundOutlined />} className={`control-btn ${!soundEnabled ? 'muted' : ''}`} onClick={() => setSoundEnabled(!soundEnabled)} />
                                </Tooltip>
                                <Tooltip title="Fairness Debug">
                                    <Button type="text" icon={<BugOutlined style={{ color: isDebugMode ? '#00e701' : undefined }} />} className={`control-btn ${isDebugMode ? 'active' : ''}`} onClick={() => setIsDebugMode(!isDebugMode)} />
                                </Tooltip>
                            </Space>
                            <span className="logo" style={{ color: 'var(--text-primary)' }}>Stake</span>
                            <Button type="text" icon={<SafetyCertificateOutlined />} className="fairness-btn" onClick={() => setFairnessModalOpen(true)}>
                                Fairness
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Multiplier Track */}
                <div className="milestones-bar">
                    <div className="milestones-header">
                        <ThunderboltOutlined />
                        <span>Multiplier Track ({DIFFICULTIES[difficulty].label})</span>
                    </div>
                    <div className="milestones-list">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((jump) => {
                            const mult = getMultiplierForCleared(jump);
                            return (
                                <Tag
                                    key={jump}
                                    className={`milestone-tag ${obstaclesCleared >= jump ? 'achieved' : ''} ${obstaclesCleared + 1 === jump ? 'next' : ''}`}
                                >
                                    Jump {jump}: {mult.toFixed(2)}×
                                </Tag>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Live Stats Draggable Widget */}
            {statsDrawerOpen && (
                <div className="fixed-widget fade-in-scale" ref={widgetRef}>
                    <div className="widget-header" onMouseDown={handleDragStart}>
                        <div className="widget-title">
                            <LineChartOutlined style={{ fontSize: 20, color: '#94a3b8' }} />
                            <span>Live Stats</span>
                        </div>
                        <div className="widget-actions">
                            <Tooltip title="Reset Live Stats" placement="topRight">
                                <button className="widget-btn-icon" onMouseDown={(e) => e.stopPropagation()} onClick={() => setWinRecords([])}>
                                    <ReloadOutlined />
                                </button>
                            </Tooltip>
                            <Tooltip title="View History" placement="topRight">
                                <button className="widget-btn-icon" onMouseDown={(e) => e.stopPropagation()} onClick={() => { setHistoryModalOpen(true); setStatsDrawerOpen(false); }}>
                                    <RightOutlined />
                                </button>
                            </Tooltip>
                            <button className="widget-btn-icon" onMouseDown={(e) => e.stopPropagation()} onClick={() => setStatsDrawerOpen(false)}>
                                <CloseOutlined />
                            </button>
                        </div>
                    </div>

                    <div className="widget-content">
                        {/* Profit Overview */}
                        <div className="profit-box">
                            <div className="profit-main">
                                <p className="label">Profit</p>
                                <p className="value" style={{ color: totalProfit >= 0 ? '#4ade80' : '#f87171' }}>
                                    ₿{totalProfit.toFixed(2)}
                                </p>
                            </div>
                            <div className="profit-divider"></div>
                            <div className="profit-stats">
                                <div className="stat-row">
                                    <p className="label">Wins</p>
                                    <p className="value" style={{ color: '#4ade80' }}>{winsCount.toLocaleString()}</p>
                                </div>
                                <div className="stat-row">
                                    <p className="label">Losses</p>
                                    <p className="value" style={{ color: '#f87171' }}>{lossesCount.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Chart.js Container */}
                        <div className="chart-box" onMouseLeave={() => setHoveredProfitValue(null)}>
                            <p className="label">Profit History</p>
                            {hoveredProfitValue !== null && (
                                <p className="hovered-value" style={{ color: hoveredProfitValue >= 0 ? '#4ade80' : '#f87171' }}>
                                    {hoveredProfitValue >= 0 ? '' : '-'}₿{Math.abs(hoveredProfitValue).toFixed(2)}
                                </p>
                            )}
                            <div className="canvas-wrapper">
                                <canvas ref={chartCanvasRef}></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Statistics Dashboard */}
            <Modal
                title={
                    <Space className="history-window-header-title">
                        <div className="icon-wrapper"><ThunderboltOutlined /></div>
                        <span>Play History & Dashboard</span>
                    </Space>
                }
                centered
                footer={null}
                onCancel={() => setHistoryModalOpen(false)}
                open={historyModalOpen}
                width={460}
                className="history-window box-modal-3d"
                closeIcon={<CloseOutlined style={{ color: '#94a3b8' }} />}
            >
                <div className="history-window-content">
                    {/* Achievements Summary Style */}
                    <div className="dashboard-section">
                        <div className="section-title">Lifetime Stats</div>
                        <div className="profit-box" style={{ background: 'transparent', padding: 0, border: 'none' }}>
                            <div className="profit-main" style={{ marginBottom: 12 }}>
                                <p className="label">Total Profit</p>
                                <p className="value" style={{ color: totalProfit >= 0 ? '#4ade80' : '#f87171' }}>
                                    {totalProfit >= 0 ? '+' : ''}₿{totalProfit.toFixed(2)}
                                </p>
                            </div>
                            <div className="profit-divider" style={{ background: 'rgba(255,255,255,0.05)' }}></div>
                            <div className="profit-stats" style={{ marginTop: 12 }}>
                                <div className="stat-row">
                                    <p className="label">Total Wagered</p>
                                    <p className="value" style={{ color: '#00b4d8' }}>₿{totalWagered.toFixed(2)}</p>
                                </div>
                                <div className="stat-row">
                                    <p className="label">Best Run</p>
                                    <p className="value" style={{ color: '#ffd700' }}>{highScore} jumps</p>
                                </div>
                                <div className="stat-row">
                                    <p className="label">Games Played</p>
                                    <p className="value" style={{ color: '#fff' }}>{gamesPlayed.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="dashboard-section">
                        <div className="section-title">Achievements</div>
                        <div className="achievements-row">
                            <div className={`achievement-badge ${gamesPlayed > 0 ? 'unlocked' : 'locked'}`}>
                                <div className="achievement-icon"><StarOutlined /></div>
                                <div className="achievement-title">First Run</div>
                            </div>
                            <div className={`achievement-badge ${highScore >= 5 ? 'unlocked' : 'locked'}`}>
                                <div className="achievement-icon"><FireOutlined /></div>
                                <div className="achievement-title">Survivor 5</div>
                            </div>
                            <div className={`achievement-badge ${totalProfit > 0 ? 'unlocked' : 'locked'}`}>
                                <div className="achievement-icon"><TrophyOutlined /></div>
                                <div className="achievement-title">In Profit</div>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Fairness Modal */}
            <Modal
                title={
                    <Space>
                        <SafetyCertificateOutlined style={{ color: '#00e701' }} />
                        <span>Provably Fair</span>
                    </Space>
                }
                open={fairnessModalOpen}
                onCancel={() => setFairnessModalOpen(false)}
                footer={null}
                width={480}
                className="fairness-modal box-modal-3d"
                centered
                styles={{
                    content: { background: '#1a2c38', padding: 0 }
                }}
            >
                <div className="fairness-header">
                    <Title level={5}>
                        <CheckCircleOutlined style={{ marginRight: 8 }} />
                        This game is provably fair
                    </Title>
                    <Paragraph>Uses HMAC-SHA256 to generate each jump result from server seed + client seed + nonce.</Paragraph>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">Server Seed (Hash)</span>
                    <div className="fairness-value">
                        <Text copyable={{ text: fairnessData.serverSeedHash }} style={{ fontSize: 11, wordBreak: 'break-all' }}>
                            {fairnessData.serverSeedHash?.slice(0, 24)}...
                        </Text>
                    </div>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">Client Seed</span>
                    <div className="fairness-value" style={{ display: 'flex', gap: 6 }}>
                        <Input
                            size="small"
                            value={clientSeedInput}
                            onChange={e => setClientSeedInput(e.target.value)}
                            style={{ background: '#2f4553', border: 'none', color: '#fff', flex: 1, fontSize: 12 }}
                        />
                        <Button size="small" onClick={handleChangeClientSeed} icon={<CheckCircleOutlined />} />
                    </div>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">Nonce</span>
                    <div className="fairness-value">
                        <Text style={{ background: 'rgba(47, 69, 83, 0.5)', padding: '4px 12px', borderRadius: 6, color: '#fff' }}>
                            {fairnessData.nonce}
                        </Text>
                    </div>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">Difficulty</span>
                    <div className="fairness-value">
                        <Tag color={DIFFICULTIES[difficulty].color === '#00e701' ? 'success' : DIFFICULTIES[difficulty].color === '#f7931a' ? 'warning' : 'error'}>
                            {DIFFICULTIES[difficulty].label} ({Math.round(DIFFICULTIES[difficulty].survivalChance * 100)}%)
                        </Tag>
                    </div>
                </div>

                <Divider style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />

                {revealedSeed && (
                    <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Previous Server Seed (Revealed)
                        </Text>
                        <div className="fairness-item" style={{ marginTop: 6 }}>
                            <span className="fairness-label">Seed</span>
                            <div className="fairness-value">
                                <Text copyable={{ text: revealedSeed.serverSeed }} style={{ fontSize: 10, wordBreak: 'break-all' }}>
                                    {revealedSeed.serverSeed.slice(0, 20)}...
                                </Text>
                            </div>
                        </div>
                        <div className="fairness-item">
                            <span className="fairness-label">Hash</span>
                            <div className="fairness-value">
                                <Text style={{ fontSize: 10, wordBreak: 'break-all', color: '#00e701' }}>
                                    {revealedSeed.serverSeedHash?.slice(0, 20)}...
                                </Text>
                            </div>
                        </div>
                    </div>
                )}

                <Button
                    type="primary"
                    block
                    className="fairness-verify-btn"
                    icon={<SyncOutlined />}
                    onClick={handleRotateSeed}
                >
                    Rotate Seed (Reveal Current)
                </Button>
            </Modal>
        </div>
    );
}

export default DinoGame;
