import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useWallet } from '../context/WalletContext'

const GAME_PATHS = ['/crash', '/plinko', '/dino', '/mines']

// Reusable Bitcoin icon component (matches btc-icon in game sidebars)
const BtcIcon = ({ size = 20, fontSize = 12 }) => (
    <div style={{
        width: size,
        height: size,
        minWidth: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #f7931a, #ffb347)',
        color: '#fff',
        fontWeight: 800,
        fontSize: fontSize,
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
        lineHeight: 1,
    }}>₿</div>
)

function Header() {
    const location = useLocation()
    const { balance, deposit, resetBalance, transactions, toasts } = useWallet()
    const [showWalletDropdown, setShowWalletDropdown] = useState(false)
    const [depositAmount, setDepositAmount] = useState('')
    const dropdownRef = useRef(null)

    const isGamePage = GAME_PATHS.some(p => location.pathname.startsWith(p))

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowWalletDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleDeposit = () => {
        const amt = parseFloat(depositAmount)
        if (!isNaN(amt) && amt > 0) {
            deposit(amt)
            setDepositAmount('')
        }
    }

    const formattedBalance = balance.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

    return (
        <header className="header">
            <div className="header-left">
                <Link to="/" className="logo-link">
                    <span className="logo" style={{ color: 'var(--text-primary)' }}>Stake</span>
                </Link>
            </div>

            <div className="header-center">
                {isGamePage ? (
                    /* Wallet Display on Game Pages */
                    <div className="header-wallet">
                        <div className="wallet-balance-display">
                            <BtcIcon size={18} fontSize={11} />
                            <span className="wallet-balance-amount">{formattedBalance}</span>
                            <button
                                className="wallet-dropdown-toggle"
                                onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                            >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                                    <path d="M7 10l5 5 5-5z" />
                                </svg>
                            </button>
                        </div>
                        <button className="wallet-btn" onClick={() => setShowWalletDropdown(!showWalletDropdown)}>
                            Wallet
                        </button>

                        {/* Wallet Dropdown */}
                        {showWalletDropdown && (
                            <div className="wallet-dropdown" ref={dropdownRef}>
                                <div className="wallet-dropdown-header">
                                    <h4>Wallet</h4>
                                    <button className="wallet-close-btn" onClick={() => setShowWalletDropdown(false)}>
                                        ✕
                                    </button>
                                </div>

                                <div className="wallet-balance-section">
                                    <div className="wallet-balance-label">Total Balance</div>
                                    <div className="wallet-balance-big">
                                        <BtcIcon size={28} fontSize={16} />
                                        {formattedBalance}
                                    </div>
                                </div>

                                <div className="wallet-actions">
                                    <div className="wallet-deposit-row">
                                        <input
                                            type="number"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            placeholder="Enter amount..."
                                            className="wallet-deposit-input"
                                            min="0"
                                            step="0.01"
                                        />
                                        <button className="wallet-deposit-btn" onClick={handleDeposit}>
                                            Deposit
                                        </button>
                                    </div>
                                    <div className="wallet-quick-amounts">
                                        {[100, 500, 1000, 5000].map(amt => (
                                            <button key={amt} className="wallet-quick-btn" onClick={() => deposit(amt)}>
                                                +₿{amt}
                                            </button>
                                        ))}
                                    </div>
                                    <button className="wallet-reset-btn" onClick={resetBalance}>
                                        Reset to ₿1,000.00
                                    </button>
                                </div>

                                {/* Recent Transactions */}
                                <div className="wallet-transactions">
                                    <h5>Recent Activity</h5>
                                    {transactions.length === 0 ? (
                                        <div className="wallet-no-tx">No transactions yet</div>
                                    ) : (
                                        <div className="wallet-tx-list">
                                            {transactions.slice(0, 8).map(tx => (
                                                <div key={tx.id} className={`wallet-tx-item ${tx.type}`}>
                                                    <div className="wallet-tx-info">
                                                        <span className="wallet-tx-type">
                                                            {tx.type === 'bet' && '🎲 Bet'}
                                                            {tx.type === 'win' && '🏆 Win'}
                                                            {tx.type === 'deposit' && '💰 Deposit'}
                                                            {tx.type === 'reset' && '🔄 Reset'}
                                                        </span>
                                                        <span className="wallet-tx-time">
                                                            {tx.timestamp.toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                    <span className={`wallet-tx-amount ${tx.amount >= 0 ? 'positive' : 'negative'}`}>
                                                        {tx.amount >= 0 ? '+' : ''}₿{Math.abs(tx.amount).toFixed(2)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Game Toasts — below wallet */}
                        {toasts.length > 0 && (
                            <div className="wallet-toast-container">
                                {toasts.map(toast => (
                                    <div key={toast.id} className={`wallet-toast wallet-toast-${toast.type}`}>
                                        <div className="wallet-toast-icon">
                                            {toast.type === 'bet' && (
                                                <BtcIcon size={20} fontSize={11} />
                                            )}
                                            {toast.type === 'win' && (
                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#00e701" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                            {toast.type === 'loss' && (
                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ed4245" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            )}
                                            {toast.type === 'error' && (
                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f7931a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="8" x2="12" y2="12" />
                                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="wallet-toast-content">
                                            <span className="wallet-toast-title">{toast.title}</span>
                                            <span className="wallet-toast-desc">{toast.description}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Search on Non-Game Pages */
                    <div className="search-input-wrapper">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--text-secondary)" className="search-icon"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path></svg>
                        <input type="text" placeholder="Search your game" className="search-input" />
                    </div>
                )}
            </div>

            <div className="header-right">
                {isGamePage ? (
                    /* Icons when on game page */
                    <>
                        <button className="header-icon-btn" title="Search">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path></svg>
                        </button>
                        <button className="header-icon-btn" title="Profile">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>
                        </button>
                        <button className="header-icon-btn" title="Notifications">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"></path></svg>
                        </button>
                        <button className="header-icon-btn" title="Chat">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"></path></svg>
                        </button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-login">Sign In</button>
                        <button className="btn btn-register">Register</button>
                    </>
                )}
            </div>
        </header>
    )
}

export default Header
