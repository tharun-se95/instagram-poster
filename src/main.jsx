import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Note: React.StrictMode intentionally double-mounts components in dev to detect
// side effects. This breaks Framer Motion — StrictMode's simulated unmount aborts
// Framer Motion's useLayoutEffect animation setup, leaving cards permanently at
// opacity:0 (the initial state). StrictMode has zero effect in production builds.
ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)
