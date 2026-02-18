import { useRef, useLayoutEffect, useState } from 'react'

/** Measures a dropdown panel on mount and flips to right-aligned if it overflows the viewport. */
export function useDropdownAlign() {
  const ref = useRef<HTMLDivElement>(null)
  const [alignRight, setAlignRight] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setAlignRight(rect.right > window.innerWidth)
  }, [])

  return { ref, alignRight }
}
