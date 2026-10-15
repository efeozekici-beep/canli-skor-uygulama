import { useEffect, useState } from 'react'

function readPath() {
  return window.location.hash.slice(1) || '/'
}

// Minimal hash router: "#/puan-durumu" -> "/puan-durumu".
export function useHashRoute() {
  const [path, setPath] = useState(readPath)

  useEffect(() => {
    const onChange = () => setPath(readPath())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return path
}
