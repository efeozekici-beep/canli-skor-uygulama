import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useLang } from './i18n'

// Dil değişince bütün uygulama yeniden kurulur: her metin t() ile seçili dilde çizilir
function Root() {
  const lang = useLang()
  return <App key={lang} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
