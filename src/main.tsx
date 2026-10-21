import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { getLang } from './lib/i18n'
import { loadMermaid } from './lib/mermaid'

document.documentElement.lang = getLang()
// start fetching the (large) mermaid bundle while React mounts
void loadMermaid()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
