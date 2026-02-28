import { useState, useEffect } from 'react'
import {
    InputNumber,
    Button,
    Typography,
    Card,
    Switch,
    Tooltip,
    Slider
} from 'antd'
import {
    ThunderboltOutlined,
    QuestionCircleOutlined
} from '@ant-design/icons'

const { Text } = Typography

function BettingPanel({ phase, betPlaced, multiplier, onBet, onCashout }) {
    const [activeTab, setActiveTab] = useState('manual')
    const [betAmount, setBetAmount] = useState(1)
    const [cashoutAt, setCashoutAt] = useState(2.00)
    const [autoCashout, setAutoCashout] = useState(true)

    // Calculate profit
    const profit = betAmount * (cashoutAt - 1)

    // Auto Cashout Logic
    useEffect(() => {
        if (phase === 'running' && betPlaced && autoCashout) {
            if (multiplier >= cashoutAt) {
                onCashout()
            }
        }
    }, [multiplier, phase, betPlaced, autoCashout, cashoutAt, onCashout])

    const handleBetClick = () => {
        if (phase === 'waiting') {
            if (betAmount > 0) {
                onBet(betAmount)
            }
        } else if (phase === 'running' && betPlaced) {
            onCashout()
        }
    }

    const getButtonText = () => {
        if (phase === 'waiting') {
            return betPlaced ? 'Cancel Bet' : 'Place Bet'
        }
        if (phase === 'running' && betPlaced) {
            return `Cash Out $${(betAmount * multiplier).toFixed(2)}`
        }
        return 'Place Bet'
    }

    const getButtonClass = () => {
        if (phase === 'running' && betPlaced) return 'bet-button cashout-btn'
        return 'bet-button'
    }

    return (
        <div className="betting-panel-3d">
            {/* 3D Tabs */}
            <div className="bet-mode-tabs">
                <button
                    className={`bet-mode-tab ${activeTab === 'manual' ? 'active' : ''}`}
                    onClick={() => setActiveTab('manual')}
                >
                    Manual
                </button>
                <button
                    className={`bet-mode-tab ${activeTab === 'auto' ? 'active' : ''}`}
                    onClick={() => setActiveTab('auto')}
                >
                    Auto
                </button>
            </div>

            {activeTab === 'manual' ? (
                <div className="bet-form">
                    {/* Bet Amount */}
                    <div className="form-group">
                        <div className="form-header">
                            <label className="form-label" style={{ margin: 0 }}>Bet Amount</label>
                            <Text type="secondary" style={{ margin: 0 }}>₿{Number(betAmount || 0).toFixed(2)}</Text>
                        </div>
                        <div className="input-row">
                            <InputNumber
                                value={betAmount}
                                onChange={setBetAmount}
                                min={0}
                                step={1}
                                addonBefore={
                                    <div className="btc-icon" style={{ background: 'linear-gradient(135deg, #f7931a, #ffb347)' }}>₿</div>
                                }
                                controls={false}
                                formatter={(v) => `${v}`}
                                parser={(v) => v.replace(/\$\s?|(,*)/g, '')}
                            />
                            <Button.Group>
                                <Button onClick={() => setBetAmount(prev => Math.max(0, prev / 2))}>½</Button>
                                <Button onClick={() => setBetAmount(prev => prev * 2)}>2×</Button>
                            </Button.Group>
                        </div>
                    </div>

                    {/* Cashout At */}
                    <div className="form-group">
                        <div className="form-header">
                            <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                                Auto Cashout
                                <Tooltip title="Auto cashout when multiplier reaches this value">
                                    <QuestionCircleOutlined style={{ marginLeft: 6, cursor: 'pointer', color: '#b1b6c6' }} />
                                </Tooltip>
                            </label>
                            <Switch
                                size="small"
                                checked={autoCashout}
                                onChange={setAutoCashout}
                                className="crash-switch"
                            />
                        </div>
                        <InputNumber
                            value={cashoutAt}
                            onChange={setCashoutAt}
                            min={1.01}
                            max={1000}
                            step={0.1}
                            precision={2}
                            disabled={!autoCashout}
                            style={{ width: '100%' }}
                            addonAfter={<span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>×</span>}
                        />
                    </div>

                    {/* Profit Display - 3D Card Style */}
                    <div className="profit-card-3d">
                        <div className="form-header" style={{ marginBottom: 4 }}>
                            <label className="form-label" style={{ margin: 0 }}>Profit on Win</label>
                            <Text type="secondary" style={{ margin: 0 }}>₿{profit.toFixed(2)}</Text>
                        </div>
                        <Text strong style={{ color: '#00e701', fontSize: 16, fontFamily: "'Courier New', monospace" }}>
                            +₿{profit.toFixed(2)}
                        </Text>
                    </div>

                    {/* Bet Button */}
                    <button
                        onClick={handleBetClick}
                        className={getButtonClass()}
                        disabled={phase === 'running' && !betPlaced}
                    >
                        <ThunderboltOutlined style={{ marginRight: 6 }} />
                        {getButtonText()}
                    </button>
                </div>
            ) : (
                <div className="bet-form">
                    <Card size="small" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-color)', borderRadius: 10 }}>
                        <Text type="secondary">
                            Auto betting coming soon! Configure automated betting strategies.
                        </Text>
                    </Card>
                </div>
            )}
        </div>
    )
}

export default BettingPanel

