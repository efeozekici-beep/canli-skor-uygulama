import { useEffect, useRef } from 'react'

// Yatay kaydırılan bir şeridi fareyle sürükleyerek kaydırma (masaüstü).
// - Basılı tut + sürükle: şerit kayar; sürükleme bitince bırakılan butona tıklanmış sayılmaz.
// - Fare tekerleği: şerit üzerindeyken yatay kaydırır; şeridin ucuna gelince sayfa normal kayar.
// Dokunmatik ekranlara dokunmaz: orada tarayıcının kendi parmakla kaydırması çalışır.
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let pointerId: number | null = null
    let startX = 0
    let startScroll = 0
    let dragged = false

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      pointerId = e.pointerId
      startX = e.clientX
      startScroll = el.scrollLeft
      dragged = false
    }

    const onPointerMove = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return
      const dx = e.clientX - startX
      // 5 px'ten az hareket tıklama sayılır, sürükleme başlamaz
      if (!dragged && Math.abs(dx) > 5) {
        dragged = true
        el.setPointerCapture(e.pointerId)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
      }
      if (dragged) el.scrollLeft = startScroll - dx
    }

    const onPointerUp = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return
      pointerId = null
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    // Sürüklemenin hemen ardından gelen tıklamayı yut (yoksa sekme değişirdi)
    const onClickCapture = (e: MouseEvent) => {
      if (!dragged) return
      e.preventDefault()
      e.stopPropagation()
      dragged = false
    }

    // Dikey tekerleği yatay kaydırmaya çevir
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0
      if (atStart || atEnd) return // uçtaysa sayfa kaysın
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('click', onClickCapture, true)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('click', onClickCapture, true)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  return ref
}
