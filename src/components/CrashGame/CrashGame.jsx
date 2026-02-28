import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
    Card,
    Button,
    Space,
    Tag,
    Tooltip,
    Typography,
    message,
    Switch,
    Modal,
    Drawer,
    Statistic,
    Row,
    Col,
    Divider,
    Radio,
    Progress,
    Input
} from 'antd'
import {
    SettingOutlined,
    ExpandOutlined,
    BarChartOutlined,
    AppstoreOutlined,
    SafetyCertificateOutlined,
    SoundOutlined,
    FullscreenOutlined,
    FullscreenExitOutlined,
    TrophyOutlined,
    FireOutlined,
    ThunderboltOutlined,
    CheckCircleOutlined,
    CopyOutlined,
    SyncOutlined,
    RightOutlined,
    StarOutlined,
    LineChartOutlined,
    CloseOutlined,
    ReloadOutlined
} from '@ant-design/icons'
import Chart from 'chart.js/auto'
import BettingPanel from './BettingPanel'
import GameChart from './GameChart'
import GameHistory from './GameHistory'
import PlayerBets from './PlayerBets'
import PlayerResults from './PlayerResults'
import ProvablyFair from '../../utils/ProvablyFair'
import { useWallet } from '../../context/WalletContext'
import './CrashGame.css'

const { Text, Title, Paragraph } = Typography

// Game phases
const PHASE = {
    WAITING: 'waiting',
    RUNNING: 'running',
    CRASHED: 'crashed'
}

function CrashGame() {
    const { balance, placeBet, addWinnings, showToast } = useWallet()
    const [phase, setPhase] = useState(PHASE.WAITING)
    const [multiplier, setMultiplier] = useState(1.00)
    const [countdown, setCountdown] = useState(5)
    const [crashPoint, setCrashPoint] = useState(0)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [history, setHistory] = useState([
        3.21, 1.47, 2.89, 5.84, 169.00, 1.06, 9.47, 5.75, 1.43, 1.22,
        4.77, 1.31, 2.15, 8.34, 1.89, 3.67, 12.45, 1.02, 6.23, 1.78,
        2.44, 4.12, 1.56, 7.89, 2.33
    ])
    const [betPlaced, setBetPlaced] = useState(false)
    const [betAmount, setBetAmount] = useState(0)
    const [userBetData, setUserBetData] = useState(null)
    const [soundEnabled, setSoundEnabled] = useState(true)

    // Settings for optional features
    const [showPlayerBets, setShowPlayerBets] = useState(true)
    const [showPlayerResults, setShowPlayerResults] = useState(true)
    const [playerCashouts, setPlayerCashouts] = useState([])

    // UI States
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [statsDrawerOpen, setStatsDrawerOpen] = useState(false)
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
    const [fairnessModalOpen, setFairnessModalOpen] = useState(false)
    const [layout, setLayout] = useState('default') // 'default', 'compact', 'wide'

    // History and Stats logic
    const [gameRecords, setGameRecords] = useState([])
    const widgetRef = useRef(null)
    const chartCanvasRef = useRef(null)
    const chartInstanceRef = useRef(null)
    const [hoveredProfitValue, setHoveredProfitValue] = useState(null)

    // Derived Stats
    const totalProfit = useMemo(() => gameRecords.reduce((sum, r) => sum + r.profit, 0), [gameRecords])
    const winsCount = useMemo(() => gameRecords.filter(r => r.profit >= 0).length, [gameRecords])
    const lossesCount = useMemo(() => gameRecords.filter(r => r.profit < 0).length, [gameRecords])
    const maxStreak = useMemo(() => {
        let max = 0
        let current = 0
        for (const record of gameRecords) {
            if (record.profit >= 0) {
                current++
                if (current > max) max = current
            } else {
                current = 0
            }
        }
        return max
    }, [gameRecords])

    // Provably Fair state
    const fairnessRef = useRef(null)
    const [fairnessData, setFairnessData] = useState({
        serverSeedHash: 'Loading...',
        clientSeed: 'Loading...',
        nonce: 0,
    })
    const [revealedSeed, setRevealedSeed] = useState(null)
    const [clientSeedInput, setClientSeedInput] = useState('')

    // Initialize ProvablyFair
    useEffect(() => {
        const pf = new ProvablyFair()
        fairnessRef.current = pf
        pf.waitReady().then(async () => {
            const data = await pf.getFairnessData()
            setFairnessData(data)
            setClientSeedInput(data.clientSeed)
        })
    }, [])

    const startTimeRef = useRef(null)
    const animationRef = useRef(null)
    const gameDisplayRef = useRef(null)
    // Performance: use refs for high-frequency values, throttle React state updates
    const multiplierRef = useRef(1.00)
    const elapsedTimeRef = useRef(0)
    const lastStateUpdateRef = useRef(0)
    const [messageApi, contextHolder] = message.useMessage()

    // Calculate statistics
    const stats = {
        totalGames: history.length,
        avgMultiplier: (history.reduce((a, b) => a + b, 0) / history.length).toFixed(2),
        maxMultiplier: Math.max(...history).toFixed(2),
        under2x: history.filter(x => x < 2).length,
        over2x: history.filter(x => x >= 2 && x < 10).length,
        over10x: history.filter(x => x >= 10).length,
        over100x: history.filter(x => x >= 100).length
    }

    // Fullscreen toggle
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            if (gameDisplayRef.current) {
                gameDisplayRef.current.requestFullscreen().then(() => {
                    setIsFullscreen(true)
                    messageApi.success('Entered fullscreen mode')
                }).catch(err => {
                    messageApi.error('Could not enter fullscreen')
                })
            }
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false)
                messageApi.info('Exited fullscreen mode')
            })
        }
    }, [messageApi])

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    // Draggable Live Stats logic
    const handleDragStart = useCallback((e) => {
        const widget = widgetRef.current
        if (!widget) return

        const startX = e.clientX
        const startY = e.clientY
        const rect = widget.getBoundingClientRect()
        const offsetX = startX - rect.left
        const offsetY = startY - rect.top

        const handleMouseMove = (moveEvent) => {
            let newX = moveEvent.clientX - offsetX
            let newY = moveEvent.clientY - offsetY

            newX = Math.max(0, Math.min(newX, window.innerWidth - rect.width))
            newY = Math.max(0, Math.min(newY, window.innerHeight - rect.height))

            widget.style.left = `${newX}px`
            widget.style.top = `${newY}px`
            widget.style.right = 'auto'
            widget.style.bottom = 'auto'
        }

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }, [])

    // Live Stats Chart Update
    useEffect(() => {
        if (!statsDrawerOpen || !chartCanvasRef.current) return

        const WIN_COLOR = 'rgb(74, 222, 128)';
        const WIN_COLOR_FILL = 'rgba(74, 222, 128, 0.3)';
        const LOSS_COLOR = 'rgb(248, 113, 113)';
        const LOSS_COLOR_FILL = 'rgba(248, 113, 113, 0.3)';
        const X_AXIS_COLOR = '#2a3f4d';
        const POINT_HOVER_COLOR = '#fff';

        let runProfit = 0;
        const profitHistory = [0, ...gameRecords.map(r => {
            runProfit += r.profit;
            return runProfit;
        })];

        if (chartInstanceRef.current) {
            // Update existing chart
            chartInstanceRef.current.data.labels = Array(profitHistory.length).fill(0);
            chartInstanceRef.current.data.datasets[0].data = profitHistory;
            chartInstanceRef.current.update('none'); // Update without animation for smooth flow
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
                            const val = profitHistory[idx];
                            setHoveredProfitValue(val !== undefined ? val : null);
                        } else {
                            setHoveredProfitValue(null);
                        }
                    },
                },
            });
        }
    }, [statsDrawerOpen, gameRecords]);

    // Generate crash point using ProvablyFair
    const generateCrashPoint = useCallback(async () => {
        const pf = fairnessRef.current
        if (!pf) return 2.00 // Fallback
        const point = await pf.generateCrashPoint()
        // Update fairness data for UI
        const data = await pf.getFairnessData()
        setFairnessData(data)
        return point
    }, [])

    // Start countdown
    const startCountdown = useCallback(() => {
        setPhase(PHASE.WAITING)
        setMultiplier(1.00)
        setElapsedTime(0)
        multiplierRef.current = 1.00
        elapsedTimeRef.current = 0
        setCountdown(5)
        setPlayerCashouts([])
        setUserBetData(null)
    }, [])

    // Handle crash
    const handleCrash = useCallback((crashMultiplier) => {
        setHistory(prev => [crashMultiplier, ...prev].slice(0, 30))

        let profit = 0;
        let didPlay = false;

        if (userBetData) {
            didPlay = true;
            if (betPlaced) {
                // User didn't cash out in time, lost bet
                profit = -userBetData.amount
                showToast('loss', 'You Lost!', `-₿${userBetData.amount.toFixed(2)} — Crashed @${crashMultiplier.toFixed(2)}×`, 4000)
            } else {
                // User cashed out
                profit = parseFloat(userBetData.profit) - userBetData.amount
            }
        }

        if (didPlay) {
            setGameRecords(prev => [...prev, {
                id: Date.now(),
                multiplier: crashMultiplier,
                cashedOutAt: betPlaced ? null : (userBetData.cashoutAt ? parseFloat(userBetData.cashoutAt) : null),
                bet: userBetData.amount,
                profit: profit
            }])
        }

        setBetPlaced(false)
        setTimeout(startCountdown, 3000)
    }, [startCountdown, userBetData, betPlaced, showToast])

    // Handle player cashout notification
    const handlePlayerCashout = useCallback((cashoutData) => {
        if (showPlayerResults) {
            setPlayerCashouts(prev => [...prev, cashoutData])
        }
    }, [showPlayerResults])

    // OPTIMIZED Game loop: use refs for high-freq updates, throttle setState to ~30fps
    useEffect(() => {
        if (phase === PHASE.RUNNING) {
            const tick = () => {
                const now = Date.now()
                const elapsed = (now - startTimeRef.current) / 1000
                const currentMultiplier = Math.pow(Math.E, 0.1 * elapsed)

                // Always update refs (used by Canvas directly)
                multiplierRef.current = currentMultiplier
                elapsedTimeRef.current = elapsed

                if (currentMultiplier >= crashPoint) {
                    // Crash! Update state immediately
                    setMultiplier(crashPoint)
                    setElapsedTime(elapsed)
                    setPhase(PHASE.CRASHED)
                    handleCrash(crashPoint)
                } else {
                    // Throttle React state updates to every ~33ms (≈30fps for UI)
                    // Canvas still renders at 60fps via requestAnimationFrame
                    if (now - lastStateUpdateRef.current >= 33) {
                        setMultiplier(currentMultiplier)
                        setElapsedTime(elapsed)
                        lastStateUpdateRef.current = now
                    }
                    animationRef.current = requestAnimationFrame(tick)
                }
            }
            lastStateUpdateRef.current = Date.now()
            animationRef.current = requestAnimationFrame(tick)

            return () => {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current)
                }
            }
        }
    }, [phase, crashPoint, handleCrash])

    // Countdown timer
    useEffect(() => {
        if (phase === PHASE.WAITING && countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(prev => prev - 0.1)
            }, 100)
            return () => clearTimeout(timer)
        } else if (phase === PHASE.WAITING && countdown <= 0) {
            // Generate crash point async with ProvablyFair
            generateCrashPoint().then(point => {
                setCrashPoint(point)
                setPhase(PHASE.RUNNING)
                startTimeRef.current = Date.now()
            })
        }
    }, [phase, countdown, generateCrashPoint])

    // Initial start
    useEffect(() => {
        const timer = setTimeout(startCountdown, 1000)
        return () => clearTimeout(timer)
    }, [startCountdown])

    const handleBet = (amount) => {
        if (amount > balance) {
            showToast('error', 'Insufficient Balance', `You need ₿${amount.toFixed(2)} but only have ₿${balance.toFixed(2)}`)
            return
        }
        placeBet(amount)
        setBetAmount(amount)
        setBetPlaced(true)
        setUserBetData({
            name: 'You',
            amount: amount,
            currency: { symbol: '₿', color: '#f7931a', name: 'BTC' },
            active: true,
            cashoutAt: null,
            profit: null
        })
        showToast('bet', 'Bet Placed', `₿${amount.toFixed(2)}`, 2500)
    }

    // Handle cashout
    const handleCashout = () => {
        if (phase === PHASE.RUNNING && betPlaced) {
            const winAmount = betAmount * multiplier
            const profit = winAmount - betAmount
            addWinnings(winAmount)
            setBetPlaced(false)
            setUserBetData(prev => prev ? {
                ...prev,
                active: false,
                cashoutAt: multiplier.toFixed(2),
                profit: winAmount.toFixed(2)
            } : null)

            showToast('win', 'You Won!', `+₿${profit.toFixed(2)} at ${multiplier.toFixed(2)}×`, 4000)
        }
    }

    // Copy to clipboard
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        messageApi.success('Copied to clipboard!')
    }

    // Handle client seed change
    const handleChangeClientSeed = useCallback(async () => {
        const pf = fairnessRef.current
        if (!pf || !clientSeedInput) return
        await pf.setClientSeed(clientSeedInput)
        const data = await pf.getFairnessData()
        setFairnessData(data)
    }, [clientSeedInput])

    // Handle seed rotation (reveals current seed)
    const handleRotateSeed = useCallback(async () => {
        const pf = fairnessRef.current
        if (!pf) return
        const revealed = await pf.rotateSeed()
        setRevealedSeed(revealed)
        const data = await pf.getFairnessData()
        setFairnessData(data)
        setClientSeedInput(data.clientSeed)
    }, [])

    return (
        <div className={`crash-game layout-${layout}`}>
            {contextHolder}

            <div className="game-container">
                {/* Betting Panel + Player Bets */}
                <div className="crash-sidebar">
                    <BettingPanel
                        phase={phase}
                        betPlaced={betPlaced}
                        multiplier={multiplier}
                        onBet={handleBet}
                        onCashout={handleCashout}
                    />

                    {/* Player Bets List */}
                    {showPlayerBets && (
                        <PlayerBets
                            phase={phase}
                            multiplier={multiplier}
                            onPlayerCashout={handlePlayerCashout}
                            userBetData={userBetData}
                        />
                    )}

                    {/* Footer */}
                    <div className="sidebar-footer">
                        <div className="footer-buttons">
                            <button
                                className={`footer-btn ${historyDrawerOpen ? 'active' : ''}`}
                                onClick={() => setHistoryDrawerOpen(true)}
                                title="Play History & Dashboard"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                                </svg>
                            </button>
                            <button
                                className={`footer-btn ${statsDrawerOpen ? 'active' : ''}`}
                                onClick={() => setStatsDrawerOpen(true)}
                                title="Live Stats"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M16 11.78l4.24-7.33 1.73 1-5.23 9.05-6.51-3.75L5.46 19H22v2H2V3h2v14.54L9.5 8z" />
                                </svg>
                            </button>
                            <button
                                className="footer-btn"
                                onClick={() => setFairnessModalOpen(true)}
                                title="Provably Fair"
                            >
                                <SafetyCertificateOutlined style={{ fontSize: 18 }} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Game Display */}
                <div className="game-display" ref={gameDisplayRef}>
                    <GameHistory history={history} />

                    <GameChart
                        phase={phase}
                        multiplier={multiplier}
                        elapsedTime={elapsedTime}
                        countdown={countdown}
                    />

                    {/* Player Results (floating on chart) */}
                    {showPlayerResults && (
                        <PlayerResults cashouts={playerCashouts} />
                    )}

                    {/* Bottom Controls */}
                    <div className="bottom-controls-antd">
                        <Space>
                            <Tooltip
                                title={
                                    <div>
                                        <div style={{ marginBottom: 8 }}>
                                            <Text style={{ color: '#fff' }}>Show Player Bets</Text>
                                            <Switch
                                                size="small"
                                                checked={showPlayerBets}
                                                onChange={setShowPlayerBets}
                                                style={{ marginLeft: 8 }}
                                            />
                                        </div>
                                        <div>
                                            <Text style={{ color: '#fff' }}>Show Player Results</Text>
                                            <Switch
                                                size="small"
                                                checked={showPlayerResults}
                                                onChange={setShowPlayerResults}
                                                style={{ marginLeft: 8 }}
                                            />
                                        </div>
                                    </div>
                                }
                                trigger="click"
                                placement="top"
                            >
                                <Button
                                    type="text"
                                    icon={<SettingOutlined />}
                                    className="control-btn-antd"
                                />
                            </Tooltip>

                            {/* Fullscreen Button */}
                            <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                                <Button
                                    type="text"
                                    icon={isFullscreen ? <FullscreenExitOutlined /> : <ExpandOutlined />}
                                    className="control-btn-antd"
                                    onClick={toggleFullscreen}
                                />
                            </Tooltip>



                            {/* Layout Button */}
                            <Tooltip
                                title={
                                    <Radio.Group
                                        value={layout}
                                        onChange={(e) => setLayout(e.target.value)}
                                        size="small"
                                    >
                                        <Radio.Button value="default">Default</Radio.Button>
                                        <Radio.Button value="compact">Compact</Radio.Button>
                                        <Radio.Button value="wide">Wide</Radio.Button>
                                    </Radio.Group>
                                }
                                trigger="click"
                                placement="top"
                            >
                                <Button
                                    type="text"
                                    icon={<AppstoreOutlined />}
                                    className="control-btn-antd"
                                />
                            </Tooltip>

                            {/* Sound Button */}
                            <Tooltip title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}>
                                <Button
                                    type="text"
                                    icon={<SoundOutlined />}
                                    className={`control-btn-antd ${!soundEnabled ? 'muted' : ''}`}
                                    onClick={() => setSoundEnabled(!soundEnabled)}
                                />
                            </Tooltip>
                        </Space>

                        <span className="logo" style={{ color: 'var(--text-primary)' }}>Stake</span>

                        {/* Fairness Button */}
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

            {/* Hot Bet Banner */}
            <div className="hot-bet-banner">
                <Tag color="purple" className="mega-tag">
                    🔥 611,100.00×
                </Tag>
                <Text type="secondary">ogicjp won big!</Text>
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
                                <button className="widget-btn-icon" onMouseDown={(e) => e.stopPropagation()} onClick={() => setGameRecords([])}>
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
                                    { id: 'first-drop', title: 'First Drop', unlocked: gameRecords.length > 0, icon: <StarOutlined /> },
                                    { id: 'big-win', title: 'Big Win 20×', unlocked: gameRecords.some(w => w.multiplier >= 20 && w.profit >= 0), icon: <TrophyOutlined /> },
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
                            {gameRecords.slice(-20).map((r, idx) => (
                                <div key={r.id || idx} className={`timeline-dot ${r.profit >= 0 ? 'win' : 'loss'}`} title={`Crash: ${r.multiplier.toFixed(2)}x ${r.cashedOutAt ? `• Cashed out: ${r.cashedOutAt.toFixed(2)}x` : ''}`} />
                            ))}
                        </div>
                    </div>

                    {/* History list */}
                    <div className="dashboard-section">
                        <div className="section-title">Recent Transactions</div>
                        <div className="history-list">
                            {gameRecords.length === 0 ? (
                                <div className="empty-state">No transaction history yet</div>
                            ) : (
                                gameRecords.slice().reverse().map((r) => {
                                    const isWin = r.profit >= 0;
                                    return (
                                        <div key={r.id} className="history-card glass-panel">
                                            <div className="history-card-icon">
                                                <div className="ball-color-circle medium" style={{ background: isWin ? 'linear-gradient(135deg, #00e701, #00a000)' : 'linear-gradient(135deg, #ff4d4f, #cf1322)' }}>
                                                    {isWin ? <TrophyOutlined style={{ color: '#fff' }} /> : <CloseOutlined style={{ color: '#fff' }} />}
                                                </div>
                                            </div>
                                            <div className="history-card-info">
                                                <div className="history-card-name">{isWin ? 'Win' : 'Loss'}</div>
                                                <div className="history-card-multiplier" style={{ color: isWin ? '#00e701' : '#ff4d4f' }}>
                                                    {r.cashedOutAt ? r.cashedOutAt.toFixed(2) : r.multiplier.toFixed(2)}×
                                                </div>
                                            </div>
                                            <div className={`history-card-profit ${isWin ? 'profit-up' : 'profit-down'}`}>
                                                {isWin ? '+' : '-'}₿{Math.abs(r.profit).toFixed(2)}
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
                className="fairness-modal"
                centered
            >
                {/* Header Card */}
                <div className="fairness-header">
                    <Title level={5}>
                        <CheckCircleOutlined style={{ marginRight: 8 }} />
                        This game is provably fair
                    </Title>
                    <Paragraph>
                        Uses HMAC-SHA256 to generate results from server seed + client seed + nonce.
                        Rotate the seed to reveal and verify past results.
                    </Paragraph>
                </div>

                {/* Active Seed Data */}
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
                        <Text style={{
                            background: 'rgba(47, 69, 83, 0.5)',
                            padding: '4px 12px',
                            borderRadius: 6,
                            color: '#fff'
                        }}>
                            {fairnessData.nonce}
                        </Text>
                    </div>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">Last Result</span>
                    <div className="fairness-value">
                        <Tag
                            color={(history[0] || 1) < 2 ? 'error' : (history[0] || 1) < 10 ? 'success' : 'gold'}
                            style={{ margin: 0, fontSize: 14, fontWeight: 600 }}
                        >
                            {(history[0] || 1).toFixed(2)}×
                        </Tag>
                    </div>
                </div>

                <Divider style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />

                {/* Revealed Seed (after rotation) */}
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

                {/* Rotate Button */}
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
    )
}

export default CrashGame
