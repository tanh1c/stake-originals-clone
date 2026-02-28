import { NavLink } from 'react-router-dom'

const navItems = [
    { icon: 'star', label: 'Favourites', path: '/favourites' },
    { icon: 'clock', label: 'Recent', path: '/recent' },
    { icon: 'trophy', label: 'Challenges', path: '/challenges' },
    { icon: 'check', label: 'My Bets', path: '/my-bets' },
]

const gameItems = [
    { icon: 'original', label: 'Crash', path: '/crash', active: true },
    { icon: 'plinko', label: 'Plinko', path: '/plinko' },
    { icon: 'dino', label: 'Dino Run', path: '/dino' },
    { icon: 'mines', label: 'Mines', path: '/mines' }
]

// SVG Icons
const icons = {
    star: <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />,
    clock: <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />,
    trophy: <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z" />,
    check: <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z" />,
    gamepad: <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2z" />,
    new: <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm-8 11H4v-2h8v2z" />,
    slot: <path d="M19.5 12c.93 0 1.78.28 2.5.76V8c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h9.74c-.48-.72-.76-1.57-.76-2.5 0-2.49 2.01-4.5 4.5-4.5z" />,
    original: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />,
    live: <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />,
    show: <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z" />,
    burst: <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2z" />,
    chart: <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />,
    poker: <path d="M11.5 9C10.12 9 9 10.12 9 11.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5S12.88 9 11.5 9z" />,
    gift: <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" />,
    cards: <path d="M21.71 7.29l-5-5A1 1 0 0016 2H8a1 1 0 00-.71.29l-5 5A1 1 0 002 8v8a1 1 0 00.29.71l5 5A1 1 0 008 22h8a1 1 0 00.71-.29l5-5A1 1 0 0022 16V8a1 1 0 00-.29-.71z" />,
    circle: <><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /><circle cx="12" cy="12" r="5" /></>,
    roulette: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-5.5 15.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5z" />,
    plinko: <path d="M12 2L2 20h20L12 2zm0 4l6.5 12h-13L12 6z" />,
    dino: <path d="M22 16V8c0-1.1-.9-2-2-2h-3V4c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v2H8C6.9 6 6 6.9 6 8v2H4v2h2v4c0 1.1.9 2 2 2h1v2h2v-2h6v2h2v-2h1c1.1 0 2-.9 2-2zm-6-6h-2V8h2v2z" />,
    mines: <path d="M12 2L2 20h20L12 2zm0 3.84l7.02 12.16H4.98L12 5.84zm0 3.16L8.5 15h7L12 9z" />
}

function Sidebar({ isOpen, toggleSidebar }) {
    return (
        <aside className={`app-sidebar ${!isOpen ? 'app-sidebar-hidden' : ''}`}>
            <div className="sidebar-header">
                <button className="icon-btn sidebar-toggle" onClick={toggleSidebar}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2z"></path></svg>
                </button>
                <div className="sidebar-switcher">
                    <button className="switch-btn active" style={{ backgroundColor: 'var(--accent-green)', color: '#fff' }}>
                        Casino
                    </button>
                    <button className="switch-btn">
                        Sports
                    </button>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="nav-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor">{icons[item.icon]}</svg>
                            </span>
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </div>

                <div className="nav-section">
                    <h3 className="nav-title">Games</h3>
                    {gameItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="nav-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor">{icons[item.icon]}</svg>
                            </span>
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </aside>
    )
}

export default Sidebar
