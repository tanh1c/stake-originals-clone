import { useState, useEffect, useRef } from 'react'
import { Card, Typography, Space, Badge, Collapse, Avatar } from 'antd'
import { UserOutlined, CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons'

const { Text } = Typography

// Mock player data
const generatePlayers = () => {
    const names = [
        'Hidden', 'philly5066', 'Riyad6999', 'BA777', 'Naeem1314',
        'EnvyAdam', 'CryptoKing', 'LuckyDraw', 'MaxBet', 'HighRoller',
        'ShadowBet', 'GoldRush', 'DiamondH', 'AcePlayer', 'BetMaster'
    ]

    const currencies = [
        { symbol: '₮', color: '#26A17B', name: 'USDT' },
        { symbol: '₿', color: '#F7931A', name: 'BTC' },
        { symbol: '$', color: '#00e701', name: 'USD' },
        { symbol: 'Ξ', color: '#627EEA', name: 'ETH' },
    ]

    return names.map((name, i) => ({
        id: i,
        name: name === 'Hidden' ? 'Hidden' : name,
        isHidden: name === 'Hidden' || Math.random() > 0.6,
        betAmount: (Math.random() * 500 + 0.001).toFixed(name === 'Hidden' ? 2 : 5),
        cashoutAt: Math.random() > 0.5 ? (Math.random() * 3 + 1).toFixed(2) : null,
        currency: currencies[Math.floor(Math.random() * currencies.length)],
        profit: null
    }))
}

function PlayerBets({ multiplier, phase, onPlayerCashout, userBetData }) {
    const [players, setPlayers] = useState(generatePlayers())
    const [expanded, setExpanded] = useState(true)
    const [totalBet, setTotalBet] = useState(2913.90)
    const [playerCount, setPlayerCount] = useState(383)
    const lastCashoutCheckRef = useRef(0)

    // Update players when game phase changes
    useEffect(() => {
        if (phase === 'waiting') {
            setPlayers(generatePlayers())
            setPlayerCount(300 + Math.floor(Math.random() * 150))
            setTotalBet(1500 + Math.random() * 2000)
        }
    }, [phase])

    // OPTIMIZED: Check for cashouts every 200ms instead of every frame
    useEffect(() => {
        if (phase === 'running') {
            const now = Date.now()
            if (now - lastCashoutCheckRef.current < 200) return
            lastCashoutCheckRef.current = now

            setPlayers(prev => {
                let changed = false
                const updated = prev.map(player => {
                    if (player.cashoutAt && parseFloat(player.cashoutAt) <= multiplier && !player.profit) {
                        changed = true
                        const profit = player.betAmount * parseFloat(player.cashoutAt)
                        if (onPlayerCashout && !player.isHidden) {
                            onPlayerCashout({
                                name: player.name,
                                amount: profit.toFixed(5),
                                currency: player.currency,
                                multiplier: player.cashoutAt
                            })
                        }
                        return { ...player, profit: profit.toFixed(5) }
                    }
                    return player
                })
                // Only return new array if something actually changed
                return changed ? updated : prev
            })
        }
    }, [multiplier, phase, onPlayerCashout])

    return (
        <div className="player-bets-panel">
            {/* Header */}
            <div
                className="player-bets-header"
                onClick={() => setExpanded(!expanded)}
            >
                <Space>
                    <Badge status="processing" color="#00e701" />
                    <UserOutlined />
                    <Text strong>{playerCount + (userBetData ? 1 : 0)}</Text>
                </Space>
                <Space>
                    <span className="currency-badge usdt">₮</span>
                    <Text strong>{(totalBet + (userBetData?.amount || 0)).toFixed(2)}...</Text>
                    {expanded ? <CaretUpOutlined /> : <CaretDownOutlined />}
                </Space>
            </div>

            {/* Player List */}
            {expanded && (
                <div className="player-bets-list">
                    {(userBetData ? [userBetData, ...players] : players).slice(0, 10).map((player, i) => (
                        <div key={i} className={`player-bet-row ${player.profit ? 'cashed-out' : ''}`}>
                            <div className="player-info">
                                {player.isHidden ? (
                                    <Text type="secondary" className="hidden-name">
                                        <UserOutlined /> Hidden
                                    </Text>
                                ) : (
                                    <Text className="player-name">{player.name}</Text>
                                )}
                                {player.cashoutAt && player.profit && (
                                    <Text className="cashout-mult" type="success">
                                        {player.cashoutAt}×
                                    </Text>
                                )}
                                {player.cashoutAt && !player.profit && (
                                    <Text className="cashout-mult" type="secondary">
                                        -
                                    </Text>
                                )}
                            </div>
                            <div className="bet-amount">
                                <span
                                    className="currency-badge small"
                                    style={{ background: player.currency.color }}
                                >
                                    {player.currency.symbol}
                                </span>
                                <Text className={player.profit ? 'profit' : ''}>
                                    {player.profit || (typeof player.amount === 'number' ? player.amount.toFixed(2) : player.betAmount)}
                                </Text>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default PlayerBets
