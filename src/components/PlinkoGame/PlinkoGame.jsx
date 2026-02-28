// Main PlinkoGame - Enhanced with Special Balls & Colorful UI
import { useState, useRef, useCallback, useEffect } from 'react';
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
    notification,
    Badge
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
    RightOutlined,
    BugOutlined,
    CloseOutlined,
    ReloadOutlined,
    LineChartOutlined
} from '@ant-design/icons';
import Chart from 'chart.js/auto';
import Plinko from './Plinko';
import Sidebar from './Sidebar';
import { DEFAULT_BALANCE, getBinColors, BIN_PAYOUTS } from './constants';
import { ProvablyFair } from '../../utils/ProvablyFair';
import { useWallet } from '../../context/WalletContext';
import './PlinkoGame.css';

const { Text, Title, Paragraph } = Typography;

// Ball types with special effects
const BALL_TYPES = {
    normal: {
        id: 'normal',
        name: 'Basic Coin',
        color: '#ff4d4f',
        multiplierBonus: 1,
        icon: '🪙',
        image: '/images/coins/coin_original.svg',
        description: 'Standard payout (1x)',
        cost: 1
    },
    bronze: {
        id: 'bronze',
        name: 'Bronze Coin',
        color: '#cd7f32',
        multiplierBonus: 2,
        icon: '🟤',
        image: '/images/coins/coin_bronze.svg',
        description: 'All payouts multiplied by 2x',
        cost: 2
    },
    silver: {
        id: 'silver',
        name: 'Silver Coin',
        color: '#bdc3c7',
        multiplierBonus: 3,
        icon: '⚪',
        image: '/images/coins/coin_silver.svg',
        description: 'All payouts multiplied by 3x',
        cost: 3
    },
    emerald: {
        id: 'emerald',
        name: 'Emerald Coin',
        color: '#2ecc71',
        multiplierBonus: 5,
        icon: '🟢',
        image: '/images/coins/coin_emerald.svg',
        description: 'All payouts multiplied by 5x',
        cost: 5
    },
    ruby: {
        id: 'ruby',
        name: 'Ruby Coin',
        color: '#e74c3c',
        multiplierBonus: 10,
        icon: '🔴',
        image: '/images/coins/coin_ruby.svg',
        description: 'All payouts multiplied by 10x',
        cost: 10
    },
    sapphire: {
        id: 'sapphire',
        name: 'Sapphire Coin',
        color: '#3498db',
        multiplierBonus: 20,
        icon: '🔵',
        image: '/images/coins/coin_sapphire.svg',
        description: 'All payouts multiplied by 20x',
        cost: 20
    }
};

function PlinkoGame() {
    // Shared Wallet
    const { balance, placeBet, addWinnings } = useWallet()
    // State
    const [betAmount, setBetAmount] = useState(1);
    const [rowCount, setRowCount] = useState(16);
    const [riskLevel, setRiskLevel] = useState('medium');
    const [winRecords, setWinRecords] = useState([]);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [selectedBallType, setSelectedBallType] = useState('normal');

    // Provably Fair System
    const [provablyFair] = useState(() => new ProvablyFair());

    // Streak tracking
    const [currentStreak, setCurrentStreak] = useState(0);
    const [maxStreak, setMaxStreak] = useState(0);

    // UI States
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [statsDrawerOpen, setStatsDrawerOpen] = useState(false);
    const [fairnessModalOpen, setFairnessModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

    // Debug State
    const [isDebugMode, setIsDebugMode] = useState(false);
    const [debugData, setDebugData] = useState(null);

    const engineRef = useRef(null);
    const gameDisplayRef = useRef(null);
    const chartCanvasRef = useRef(null);
    const chartInstanceRef = useRef(null);

    // Drag refs (Live Stats)
    const widgetRef = useRef(null);
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const profitHistoryRef = useRef([0]);

    // Drag refs (Debug Widget)
    const debugWidgetRef = useRef(null);
    const isDebugDragging = useRef(false);
    const debugDragOffset = useRef({ x: 0, y: 0 });

    // Chart.js State
    const [hoveredProfitValue, setHoveredProfitValue] = useState(null);

    // Calculate statistics
    const winsCount = winRecords.filter(r => r.profit >= 0).length;
    const lossesCount = winRecords.filter(r => r.profit < 0).length;
    const stats = {
        totalDrops: winRecords.length,
        totalWagered: winRecords.reduce((sum, r) => sum + r.betAmount, 0),
        totalProfit: winRecords.reduce((sum, r) => sum + r.profit, 0),
        biggestWin: winRecords.length > 0 ? Math.max(...winRecords.map(r => r.payout.multiplier)) : 0,
        avgMultiplier: winRecords.length > 0
            ? (winRecords.reduce((sum, r) => sum + r.payout.multiplier, 0) / winRecords.length).toFixed(2)
            : 0,
        rubyBalls: winRecords.filter(r => r.ballType === 'ruby').length,
        sapphireBalls: winRecords.filter(r => r.ballType === 'sapphire').length,
    };

    // Last win
    const lastWin = winRecords.length > 0 ? winRecords[winRecords.length - 1] : null;

    // Current ball type
    const currentBall = BALL_TYPES[selectedBallType];
    const effectiveBetCost = betAmount * currentBall.cost;

    // Chart Data for Live Stats
    const chartData = winRecords.slice(-40);
    const maxProfit = chartData.length > 0 ? Math.max(0, ...chartData.map(r => r.profit)) : 1;
    const minProfit = chartData.length > 0 ? Math.min(0, ...chartData.map(r => r.profit)) : -1;
    const profitRangeMax = Math.max(maxProfit, 1);
    const profitRangeMin = Math.abs(Math.min(minProfit, -1));

    // Handle balance change
    const handleBalanceChange = useCallback((amount) => {
        if (amount > 0) {
            addWinnings(amount);
        }
        // Negative amounts (bets) are handled by placeBet in handleDropBall
    }, [addWinnings]);

    // Calculate bonus multiplier for special balls
    const calculateBonusMultiplier = useCallback((ballType) => {
        const ball = BALL_TYPES[ballType];
        return ball.multiplierBonus || 1;
    }, []);

    // Handle ball enter bin
    const handleBallEnterBin = useCallback((data) => {
        const ballType = data.ballType || selectedBallType;
        const actualBall = BALL_TYPES[ballType] || BALL_TYPES.normal;

        const bonusMultiplier = calculateBonusMultiplier(ballType);
        const finalMultiplier = data.payout.multiplier * bonusMultiplier;
        const finalPayout = data.betAmount * finalMultiplier;
        const profit = finalPayout - (data.betAmount * actualBall.cost);

        const newRecord = {
            id: Date.now() + Math.random(),
            ...data,
            ballType: ballType,
            bonusMultiplier,
            payout: {
                ...data.payout,
                multiplier: finalMultiplier,
                value: finalPayout,
                originalMultiplier: data.payout.multiplier
            },
            profit
        };

        setWinRecords(prev => [...prev, newRecord]);

        // Track streak
        if (profit > 0) {
            setCurrentStreak(prev => {
                const newStreak = prev + 1;
                if (newStreak > maxStreak) setMaxStreak(newStreak);
                return newStreak;
            });
        } else {
            setCurrentStreak(0);
        }

        // Adjust balance for special ball cost difference
        const costAdjustment = data.betAmount * (actualBall.cost - 1);
        if (costAdjustment !== 0) {
            handleBalanceChange(-costAdjustment);
        }
    }, [selectedBallType, calculateBonusMultiplier, handleBalanceChange, maxStreak]);

    // Drag handler for widget
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
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, []);

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

    // Destroy chart when window closes
    useEffect(() => {
        if (!statsDrawerOpen) {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        }
    }, [statsDrawerOpen]);

    // Setup Chart.js after canvas mounts and when winRecords change
    useEffect(() => {
        if (!statsDrawerOpen || !chartCanvasRef.current) return;

        const WIN_COLOR = 'rgb(74, 222, 128)';
        const WIN_COLOR_FILL = 'rgba(74, 222, 128, 0.3)';
        const LOSS_COLOR = 'rgb(248, 113, 113)';
        const LOSS_COLOR_FILL = 'rgba(248, 113, 113, 0.3)';
        const X_AXIS_COLOR = '#2a3f4d';
        const POINT_HOVER_COLOR = '#fff';

        // Profit history starting from 0
        const profitHistory = [0];
        let runningTotal = 0;
        winRecords.forEach(r => {
            runningTotal += r.profit;
            profitHistory.push(runningTotal);
        });
        profitHistoryRef.current = profitHistory;

        if (chartInstanceRef.current) {
            // Update existing chart
            chartInstanceRef.current.data.labels = Array(profitHistory.length).fill(0);
            chartInstanceRef.current.data.datasets[0].data = profitHistory;
            chartInstanceRef.current.update();
        } else {
            // Initialize new chart
            chartInstanceRef.current = new Chart(chartCanvasRef.current, {
                type: 'line',
                data: {
                    labels: Array(profitHistory.length).fill(0),
                    datasets: [
                        {
                            label: 'Profit',
                            data: profitHistory,
                            fill: {
                                target: 'origin',
                                above: WIN_COLOR_FILL,
                                below: LOSS_COLOR_FILL,
                            },
                            cubicInterpolationMode: 'monotone',
                            segment: {
                                borderColor: (ctx) => {
                                    if (!ctx.p0 || !ctx.p1) return WIN_COLOR;
                                    const y0 = ctx.p0.parsed.y;
                                    const y1 = ctx.p1.parsed.y;
                                    if (y1 === 0) {
                                        return y0 < 0 ? LOSS_COLOR : WIN_COLOR;
                                    }
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
                    animations: {
                        y: {
                            duration: 0,
                        },
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index',
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false },
                    },
                    scales: {
                        x: {
                            border: { display: false },
                            grid: { display: false },
                            ticks: { display: false },
                        },
                        y: {
                            border: { display: false },
                            grid: {
                                color: (ctx) => (ctx.tick.value === 0 ? X_AXIS_COLOR : 'transparent'),
                                lineWidth: 2,
                            },
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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
        };
    }, []);

    // Update debug info whenever ready or after a drop
    useEffect(() => {
        if (isDebugMode && provablyFair) {
            provablyFair.peekPlinkoPath(rowCount).then(res => {
                setDebugData(res);
            });
        }
    }, [isDebugMode, rowCount, provablyFair, winRecords]);

    // Drop ball
    const handleDropBall = useCallback(async () => {
        if (engineRef.current && provablyFair) {
            // Deduct bet from wallet
            if (betAmount > balance) return;
            placeBet(betAmount);

            engineRef.current.updateBallStyle(currentBall.color, currentBall.image);

            // Get provably fair path result BEFORE physics drops it
            const fairnessResult = await provablyFair.generatePlinkoPath(rowCount);

            // Count rights in path = bin index (deterministic outcome)
            // e.g. path [0,1,1,0,1,...] → binIndex = sum of 1s
            const binIndex = fairnessResult.path.reduce((sum, dir) => sum + dir, 0);

            // Physics will naturally guide it to the correct bucket
            engineRef.current.dropBall(binIndex, selectedBallType);
        }
    }, [currentBall, rowCount, provablyFair, selectedBallType, betAmount, balance, placeBet]);

    // Fullscreen toggle
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            if (gameDisplayRef.current) {
                gameDisplayRef.current.requestFullscreen().then(() => {
                    setIsFullscreen(true);
                });
            }
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            });
        }
    }, []);

    // Check for outstanding balls
    const hasOutstandingBalls = engineRef.current?.hasOutstandingBalls?.() || false;

    return (
        <div className="plinko-page">
            <div className="plinko-main" ref={gameDisplayRef}>
                {/* Hot Streak Banner removed - streak shown in History & Statistics */}

                <div className="plinko-container">
                    {/* Sidebar - LEFT */}
                    <div className="plinko-sidebar-wrapper">
                        <Sidebar
                            balance={balance}
                            betAmount={betAmount}
                            setBetAmount={setBetAmount}
                            rowCount={rowCount}
                            setRowCount={setRowCount}
                            riskLevel={riskLevel}
                            setRiskLevel={setRiskLevel}
                            hasOutstandingBalls={hasOutstandingBalls}
                            onDropBall={handleDropBall}
                            onSettingsClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            onStatsClick={() => setStatsDrawerOpen(true)}
                            isSettingsOpen={isSettingsOpen}
                            isStatsOpen={statsDrawerOpen}
                            selectedBallType={selectedBallType}
                            setSelectedBallType={setSelectedBallType}
                            ballTypes={BALL_TYPES}
                            currentBall={currentBall}
                            lastWin={lastWin}
                            winRecords={winRecords}
                            currentStreak={currentStreak}
                            maxStreak={maxStreak}
                            effectiveBetCost={effectiveBetCost}
                        />
                    </div>

                    {/* Plinko Game Area */}
                    <div className="plinko-game-wrapper">
                        <Plinko
                            rowCount={rowCount}
                            riskLevel={riskLevel}
                            betAmount={betAmount}
                            winRecords={winRecords}
                            onBallEnterBin={handleBallEnterBin}
                            onBalanceChange={handleBalanceChange}
                            engineRef={engineRef}
                            ballColor={currentBall.color}
                        />

                        {/* Debug Overlay */}
                        {isDebugMode && debugData && (
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
                                        <span className="debug-value">{debugData.hash.substring(0, 16)}...</span>
                                    </div>
                                    <div className="debug-row">
                                        <span className="debug-label">Next Nonce:</span>
                                        <span className="debug-value">{debugData.nonce}</span>
                                    </div>
                                    <div className="debug-target">
                                        TARGET BIN: <span className="target-bin">#{debugData.binIndex}</span>
                                        {' → '}
                                        <span className="target-payout">
                                            {BIN_PAYOUTS[rowCount]?.[riskLevel]?.[debugData.binIndex] ?? '?'}×
                                        </span>
                                    </div>
                                    <div className="debug-path-row">
                                        {debugData.path.map((dir, i) => (
                                            <span key={i} className={`debug-path-dot ${dir === 0 ? 'left' : 'right'}`}>
                                                {dir === 0 ? 'L' : 'R'}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bottom Controls */}
                        <div className="plinko-controls">
                            <Space>
                                <Tooltip title="Game Settings">
                                    <Button
                                        type="text"
                                        icon={<SettingOutlined />}
                                        className="control-btn"
                                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                    />
                                </Tooltip>
                                <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                                    <Button
                                        type="text"
                                        icon={isFullscreen ? <FullscreenExitOutlined /> : <ExpandOutlined />}
                                        className="control-btn"
                                        onClick={toggleFullscreen}
                                    />
                                </Tooltip>
                                <Tooltip title="Statistics">
                                    <Button
                                        type="text"
                                        icon={<BarChartOutlined />}
                                        className="control-btn"
                                        onClick={() => setStatsDrawerOpen(true)}
                                    />
                                </Tooltip>
                                <Tooltip title={soundEnabled ? "Mute" : "Unmute"}>
                                    <Button
                                        type="text"
                                        icon={<SoundOutlined />}
                                        className={`control-btn ${soundEnabled ? '' : 'muted'}`}
                                        onClick={() => setSoundEnabled(!soundEnabled)}
                                    />
                                </Tooltip>
                                <Tooltip title={isDebugMode ? "Disable Debug" : "Enable Debug (Peek Fairness)"}>
                                    <Button
                                        type="text"
                                        icon={<BugOutlined />}
                                        className={`control-btn ${isDebugMode ? 'active-debug' : ''}`}
                                        style={{ color: isDebugMode ? '#00e701' : undefined }}
                                        onClick={() => setIsDebugMode(!isDebugMode)}
                                    />
                                </Tooltip>
                            </Space>

                            <span className="logo" style={{ color: 'var(--text-primary)' }}>Stake</span>

                            <Button
                                type="text"
                                icon={<SafetyCertificateOutlined />}
                                className="fairness-btn"
                                onClick={() => setFairnessModalOpen(true)}
                            >
                                Fairness
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Recent Plays (always visible) */}
                <div className="recent-plays">
                    <div className="recent-plays-header">
                        <ThunderboltOutlined />
                        <span>Recent Plays</span>
                        <span className="total-plays">{winRecords.length} drops</span>
                    </div>
                    <div className="recent-plays-bar">
                        <div className="recent-plays-list">
                            {winRecords.length === 0 ? (
                                <div className="recent-plays-empty">No drops yet</div>
                            ) : (
                                winRecords.slice(-30).reverse().map((record) => {
                                    const colors = getBinColors(record.rowCount);
                                    const actualBall = BALL_TYPES[record.ballType] || BALL_TYPES.normal;
                                    const isSpecial = actualBall.id !== 'normal';
                                    return (
                                        <Tooltip
                                            key={record.id}
                                            title={
                                                <div>
                                                    <div>{actualBall.name}</div>
                                                    <div>Payout: ₿{record.payout.value.toFixed(2)}</div>
                                                    {isSpecial && <div>Bonus: {record.bonusMultiplier.toFixed(2)}×</div>}
                                                </div>
                                            }
                                        >
                                            <Tag
                                                className="play-tag"
                                                style={{
                                                    backgroundColor: colors.background[record.binIndex],
                                                    color: '#000'
                                                }}
                                            >
                                                {isSpecial && (
                                                    <div
                                                        className="ball-color-circle small"
                                                        style={{ backgroundImage: `url(${actualBall.image})`, backgroundSize: 'cover', backgroundColor: 'transparent' }}
                                                    ></div>
                                                )}
                                                {record.payout.multiplier.toFixed(1)}{record.payout.multiplier < 100 ? '×' : ''}
                                            </Tag>
                                        </Tooltip>
                                    );
                                })
                            )}
                        </div>
                        <div className="recent-plays-actions">
                            <Button
                                type="text"
                                className="view-all-btn"
                                onClick={() => setHistoryDrawerOpen(true)}
                                icon={<RightOutlined />}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Statistics Mini Window / Profit Chart */}
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
                                <p className="value" style={{ color: stats.totalProfit >= 0 ? '#4ade80' : '#f87171' }}>
                                    ₿{stats.totalProfit.toFixed(2)}
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

            {/* History Window - sleek modern dashboard style */}
            <Modal
                title={
                    <Space className="history-window-header-title">
                        <div className="icon-wrapper"><ThunderboltOutlined /></div>
                        <span>Play History & Dashboard</span>
                    </Space>
                }
                centered
                footer={null}
                onCancel={() => setHistoryDrawerOpen(false)}
                open={historyDrawerOpen}
                width={460}
                className="history-window box-modal-3d"
                closeIcon={<CloseOutlined style={{ color: '#94a3b8' }} />}
            >
                <div className="history-window-content">
                    {/* Achievements */}
                    <div className="dashboard-section">
                        <div className="section-title">Milestones</div>
                        <div className="achievements-row">
                            {(() => {
                                const achievements = [
                                    { id: 'first-drop', title: 'First Drop', unlocked: winRecords.length > 0, icon: <StarOutlined /> },
                                    { id: 'ruby-used', title: 'Used Ruby Coin', unlocked: stats.rubyBalls > 0, icon: <ThunderboltOutlined /> },
                                    { id: 'sapphire-used', title: 'Used Sapphire Coin', unlocked: stats.sapphireBalls > 0, icon: <StarOutlined /> },
                                    { id: 'big-win', title: 'Big Win 20×', unlocked: winRecords.some(w => w.payout.multiplier >= 20), icon: <TrophyOutlined /> },
                                    { id: 'hot-streak', title: 'Hot streak 5+', unlocked: maxStreak >= 5, icon: <FireOutlined /> },
                                ];
                                return achievements.map(a => (
                                    <div key={a.id} className={`achievement-badge ${a.unlocked ? 'unlocked' : 'locked'}`}>
                                        <div className="achievement-icon">{a.icon}</div>
                                        <div className="achievement-title">{a.title}</div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>

                    {/* Streak timeline (last 20 results) */}
                    <div className="dashboard-section">
                        <div className="section-title">Streak Timeline (Last 20)</div>
                        <div className="streak-timeline glass-panel">
                            {winRecords.slice(-20).map((r, idx) => {
                                const actualBall = BALL_TYPES[r.ballType] || BALL_TYPES.normal;
                                return (
                                    <div key={r.id || idx} className={`timeline-dot ${r.profit > 0 ? 'win' : 'loss'}`} title={`${actualBall.name} • ${r.payout.multiplier.toFixed(2)}×`} />
                                );
                            })}
                        </div>
                    </div>

                    {/* History list */}
                    <div className="dashboard-section">
                        <div className="section-title">Recent Transactions</div>
                        <div className="history-list">
                            {winRecords.length === 0 ? (
                                <div className="empty-state">No transaction history yet</div>
                            ) : (
                                winRecords.slice().reverse().map((r) => {
                                    const colors = getBinColors(r.rowCount);
                                    const actualBall = BALL_TYPES[r.ballType] || BALL_TYPES.normal;
                                    const isWin = r.profit >= 0;
                                    return (
                                        <div key={r.id} className="history-card glass-panel">
                                            <div className="history-card-icon">
                                                <div className="ball-color-circle medium" style={{ backgroundImage: `url(${actualBall.image})`, backgroundSize: 'cover', backgroundColor: 'transparent' }}></div>
                                            </div>
                                            <div className="history-card-info">
                                                <div className="history-card-name">{actualBall.name}</div>
                                                <div className="history-card-multiplier" style={{ color: colors.background[r.binIndex] || '#fff' }}>{r.payout.multiplier.toFixed(2)}×</div>
                                            </div>
                                            <div className={`history-card-profit ${isWin ? 'profit-up' : 'profit-down'}`}>
                                                {isWin ? '+' : ''}₿{Math.abs(r.profit).toFixed(2)}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
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
                    <Paragraph>
                        Plinko uses a provably fair algorithm with physics simulation.
                        Each ball drop is determined by initial position and realistic physics.
                    </Paragraph>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">Game</span>
                    <Text className="fairness-value">Plinko</Text>
                </div>
                <div className="fairness-item">
                    <span className="fairness-label">Total Drops</span>
                    <Text className="fairness-value">{winRecords.length}</Text>
                </div>
                <div className="fairness-item">
                    <span className="fairness-label">Current Rows</span>
                    <Text className="fairness-value">{rowCount}</Text>
                </div>
                <div className="fairness-item">
                    <span className="fairness-label">Current Ball</span>
                    <Text className="fairness-value">
                        <div className="ball-color-circle small" style={{ backgroundImage: `url(${currentBall.image})`, backgroundSize: 'cover', backgroundColor: 'transparent', marginRight: 6 }}></div>
                        {currentBall.name}
                    </Text>
                </div>

                <Button
                    type="primary"
                    block
                    className="fairness-verify-btn"
                    icon={<CheckCircleOutlined />}
                >
                    Verify Game
                </Button>
            </Modal>
        </div>
    );
}

export default PlinkoGame;
