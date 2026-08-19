import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AIEngineerPage from './components/AIEngineerPage.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AIEngineerPage />
  </StrictMode>,
)
