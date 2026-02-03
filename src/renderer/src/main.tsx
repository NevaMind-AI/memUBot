import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import './i18n' // Initialize i18n
import { initializeAnalytics } from './services/analytics'

// Initialize analytics (Grafana Faro)
initializeAnalytics()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
