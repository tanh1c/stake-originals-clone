import { Routes, Route } from 'react-router-dom'
import { App as AntApp } from 'antd'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import CrashPage from './pages/CrashPage'
import PlinkoPage from './pages/PlinkoPage'
import DinoPage from './pages/DinoPage'
import MinesPage from './pages/MinesPage'

function App() {
    return (
        <AntApp>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<HomePage />} />
                    <Route path="crash" element={<CrashPage />} />
                    <Route path="plinko" element={<PlinkoPage />} />
                    <Route path="dino" element={<DinoPage />} />
                    <Route path="mines" element={<MinesPage />} />
                </Route>
            </Routes>
        </AntApp>
    )
}

export default App


