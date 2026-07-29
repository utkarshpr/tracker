import { useEffect, useState } from 'react'

export function useCountUp(target, duration = 1400, delay = 0) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    setValue(0)
    const t = setTimeout(() => {
      const start = performance.now()
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - p, 4)
        setValue(Math.round(eased * target))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, delay)
    return () => clearTimeout(t)
  }, [target, duration, delay])
  return value
}
