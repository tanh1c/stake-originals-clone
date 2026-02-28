import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import { WalletProvider } from './context/WalletContext'
import App from './App'
import './styles/index.css'

// Custom dark theme for Stake
const stakeTheme = {
    algorithm: theme.darkAlgorithm,
    token: {
        colorPrimary: '#00e701',
        colorBgBase: '#0f212e',
        colorBgContainer: '#1a2c38',
        colorBgElevated: '#2f4553',
        colorBorder: '#2f4553',
        colorText: '#ffffff',
        colorTextSecondary: '#b1bad3',
        colorSuccess: '#00e701',
        colorWarning: '#f7931a',
        colorError: '#ed4245',
        colorInfo: '#1475e1',
        borderRadius: 8,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    components: {
        Button: {
            primaryColor: '#000000',
            colorPrimaryHover: '#00c700',
        },
        Input: {
            colorBgContainer: '#0f212e',
            colorBorder: '#2f4553',
            activeBorderColor: '#1475e1',
        },
        InputNumber: {
            colorBgContainer: '#0f212e',
            colorBorder: '#2f4553',
        },
        Tabs: {
            colorBgContainer: '#0f212e',
            itemSelectedColor: '#ffffff',
            itemColor: '#b1bad3',
        },
        Card: {
            colorBgContainer: '#1a2c38',
            colorBorderSecondary: '#2f4553',
        },
        Slider: {
            colorPrimaryBorderHover: '#00e701',
            handleColor: '#00e701',
            trackBg: '#00e701',
            trackHoverBg: '#00c700',
        },
        Tooltip: {
            colorBgSpotlight: '#2f4553',
        },
    },
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ConfigProvider theme={stakeTheme}>
            <BrowserRouter>
                <WalletProvider>
                    <App />
                </WalletProvider>
            </BrowserRouter>
        </ConfigProvider>
    </React.StrictMode>
)
