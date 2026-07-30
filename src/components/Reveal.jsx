import { useEffect, useRef, useState } from 'react'

/** Fade/slide section into view once when scrolled near viewport. */
export default function Reveal({ children, className = '', delay = 0, style }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return undefined
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`dash-reveal ${visible ? 'is-visible' : ''} ${className}`.trim()}
      style={{
        ...(delay ? { transitionDelay: `${delay}ms` } : null),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
