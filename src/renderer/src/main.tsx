import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import './i18n' // Initialize i18n
import { initializeAnalytics } from './services/analytics'

// Set document title based on app mode
const appMode = import.meta.env.VITE_APP_MODE || 'memu'
document.title = appMode === 'yumi' ? 'Yumi' : 'memU bot'

// Initialize analytics (Grafana Faro)
initializeAnalytics()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
