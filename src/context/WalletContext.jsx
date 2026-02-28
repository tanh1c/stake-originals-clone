import { createContext, useContext, useState, useCallback, useRef } from 'react'

const WalletContext = createContext(null)

const INITIAL_BALANCE = 1000.00
const STORAGE_KEY = 'stake_wallet_balance'

function getStoredBalance() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored !== null) {
            const parsed = parseFloat(stored)
            return isNaN(parsed) ? INITIAL_BALANCE : parsed
        }
    } catch (e) { /* ignore */ }
    return INITIAL_BALANCE
}

export function WalletProvider({ children }) {
    const [balance, setBalance] = useState(getStoredBalance)
    const [currency, setCurrency] = useState('USD')
    const [transactions, setTransactions] = useState([])

    // Toast system
    const [toasts, setToasts] = useState([])
    const toastIdRef = useRef(0)

    const showToast = useCallback((type, title, description, duration = 3000) => {
        const id = ++toastIdRef.current
        setToasts(prev => [...prev, { id, type, title, description }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, duration)
    }, [])

    // Update balance and persist to localStorage
    const updateBalance = useCallback((newBalance) => {
        const rounded = parseFloat(newBalance.toFixed(2))
        setBalance(rounded)
        try { localStorage.setItem(STORAGE_KEY, rounded.toString()) } catch (e) { /* ignore */ }
    }, [])

    // Place a bet (deduct from balance)
    const placeBet = useCallback((amount) => {
        const amt = parseFloat(amount)
        if (isNaN(amt) || amt <= 0) return false

        setBalance(prev => {
            if (amt > prev) return prev // Can't bet more than balance
            const newBal = parseFloat((prev - amt).toFixed(2))
            try { localStorage.setItem(STORAGE_KEY, newBal.toString()) } catch (e) { /* ignore */ }

            setTransactions(txs => [{
                id: Date.now(),
                type: 'bet',
                amount: -amt,
                balance: newBal,
                timestamp: new Date(),
            }, ...txs].slice(0, 100))

            return newBal
        })
        return true
    }, [])

    // Add winnings to balance
    const addWinnings = useCallback((amount) => {
        const amt = parseFloat(amount)
        if (isNaN(amt) || amt <= 0) return

        setBalance(prev => {
            const newBal = parseFloat((prev + amt).toFixed(2))
            try { localStorage.setItem(STORAGE_KEY, newBal.toString()) } catch (e) { /* ignore */ }

            setTransactions(txs => [{
                id: Date.now(),
                type: 'win',
                amount: amt,
                balance: newBal,
                timestamp: new Date(),
            }, ...txs].slice(0, 100))

            return newBal
        })
    }, [])

    // Deposit funds
    const deposit = useCallback((amount) => {
        const amt = parseFloat(amount)
        if (isNaN(amt) || amt <= 0) return

        setBalance(prev => {
            const newBal = parseFloat((prev + amt).toFixed(2))
            try { localStorage.setItem(STORAGE_KEY, newBal.toString()) } catch (e) { /* ignore */ }

            setTransactions(txs => [{
                id: Date.now(),
                type: 'deposit',
                amount: amt,
                balance: newBal,
                timestamp: new Date(),
            }, ...txs].slice(0, 100))

            return newBal
        })
    }, [])

    // Reset balance to initial
    const resetBalance = useCallback(() => {
        updateBalance(INITIAL_BALANCE)
        setTransactions([{
            id: Date.now(),
            type: 'reset',
            amount: INITIAL_BALANCE,
            balance: INITIAL_BALANCE,
            timestamp: new Date(),
        }])
    }, [updateBalance])

    const value = {
        balance,
        currency,
        setCurrency,
        transactions,
        placeBet,
        addWinnings,
        deposit,
        resetBalance,
        updateBalance,
        toasts,
        showToast,
    }

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    )
}

export function useWallet() {
    const context = useContext(WalletContext)
    if (!context) {
        throw new Error('useWallet must be used within a WalletProvider')
    }
    return context
}

export default WalletContext
