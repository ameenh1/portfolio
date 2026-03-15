import { useEffect, useState } from 'react'

interface Props {
  loaded: boolean
}

export default function LoadingScreen({ loaded }: Props) {
  const [progress, setProgress] = useState(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!loaded) {
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + Math.random() * 15, 90))
      }, 200)
      return () => clearInterval(interval)
    } else {
      setProgress(100)
      setTimeout(() => setHidden(true), 800)
    }
  }, [loaded])

  if (hidden) return null

  return (
    <div className={`loading-screen ${loaded ? 'loaded' : ''}`}>
      <h1
        style={{
          fontFamily: 'Outfit, sans-serif',
          fontSize: '1.8rem',
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-0.02em',
        }}
      >
        Ameen Harandi
      </h1>
      <p
        style={{
          fontSize: '0.7rem',
          color: 'rgba(184, 168, 153, 0.5)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginTop: '8px',
        }}
      >
        Loading the mountain...
      </p>
      <div className="loading-bar-track">
        <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
