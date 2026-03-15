import { useState, useCallback } from 'react'
import Experience from './components/Experience'
import LoadingScreen from './components/LoadingScreen'

export default function App() {
  const [loaded, setLoaded] = useState(false)

  const handleLoaded = useCallback(() => {
    setTimeout(() => setLoaded(true), 400)
  }, [])

  return (
    <>
      <LoadingScreen loaded={loaded} />
      <Experience onLoaded={handleLoaded} />
    </>
  )
}
