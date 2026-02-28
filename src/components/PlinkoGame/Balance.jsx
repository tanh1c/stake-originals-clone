// Balance Component - Direct port from Balance.svelte
import { useState } from 'react';
import './Balance.css';

function Balance({ balance, onAddMoney }) {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    const balanceFormatted = balance.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const addMoneyAmounts = [100, 500, 1000];

    return (
        <div className="balance-container">
            <div className="balance-display">
                <span className="balance-symbol">₿</span>
                <span className="balance-value">{balanceFormatted}</span>
            </div>
            <div className="balance-popover-wrapper">
                <button
                    className="add-btn"
                    onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                >
                    Add
                </button>
                {isPopoverOpen && (
                    <div className="add-money-popover">
                        <p className="add-money-title">Add money</p>
                        <div className="add-money-buttons">
                            {addMoneyAmounts.map((amount) => (
                                <button
                                    key={amount}
                                    className="add-money-btn"
                                    onClick={() => {
                                        onAddMoney(amount);
                                        setIsPopoverOpen(false);
                                    }}
                                >
                                    +₿{amount}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Balance;
