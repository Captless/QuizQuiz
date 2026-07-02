import { useEffect } from 'react'

export function useScrollReveal() {
  useEffect(() => {
    const MAX_OFFSET = 30

    const isAlreadyVisible = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.top < window.innerHeight && r.bottom > 0
    }

    const setOffset = (el: Element, px: number) => {
      ;(el as HTMLElement).style.setProperty('--reveal-offset', `${px}px`)
    }

    const thresholds = Array.from({ length: 21 }, (_, i) => i * 0.05)

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const offset = (1 - entry.intersectionRatio) * MAX_OFFSET
          setOffset(entry.target, offset)
          if (entry.intersectionRatio >= 0.9) {
            ;(entry.target as HTMLElement).setAttribute('data-revealed', 'true')
            observer.unobserve(entry.target)
          }
        })
      },
      { root: null, threshold: thresholds }
    )

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.querySelectorAll('.reveal-card').forEach(el => {
          if (isAlreadyVisible(el)) {
            setOffset(el, 0)
            ;(el as HTMLElement).setAttribute('data-revealed', 'true')
          } else {
            observer.observe(el)
          }
        })
      })
    })

    return () => observer.disconnect()
  }, [])
}
