import { useState, useEffect } from 'react'
import { Typography } from 'antd'

const { Text } = Typography

function PlayerResults({ cashouts }) {
    const [visibleCashouts, setVisibleCashouts] = useState([])

    // Add new cashouts and remove old ones
    useEffect(() => {
        if (cashouts.length > 0) {
            const latest = cashouts[cashouts.length - 1]
            const newCashout = {
                ...latest,
                id: Date.now(),
                visible: true
            }

            setVisibleCashouts(prev => [...prev, newCashout].slice(-5))

            // Auto-remove after 10 seconds (longer for better visibility)
            setTimeout(() => {
                setVisibleCashouts(prev =>
                    prev.filter(c => c.id !== newCashout.id)
                )
            }, 10000)
        }
    }, [cashouts.length])

    if (visibleCashouts.length === 0) return null

    return (
        <div className="player-results">
            {visibleCashouts.map((cashout, index) => (
                <div
                    key={cashout.id}
                    className="player-result-item"
                    style={{
                        animationDelay: `${index * 0.1}s`,
                        top: `${80 + index * 45}px`
                    }}
                >
                    <Text className="result-name">{cashout.name}</Text>
                    <span
                        className="currency-badge"
                        style={{ background: cashout.currency.color }}
                    >
                        {cashout.currency.symbol}
                    </span>
                    <Text className="result-amount" style={{ color: '#00e701' }}>
                        {cashout.amount}
                    </Text>
                </div>
            ))}
        </div>
    )
}

export default PlayerResults
