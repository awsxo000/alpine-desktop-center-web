import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './light-accessibility.css'
import './modules-layout.css'
import './workspace-enhancements.css'
import './density.css'
import './theme-balance.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
