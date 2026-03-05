'use client'

/**
 * FloatingWallet
 *
 * A freely-draggable floating widget that shows real-time wallet balance.
 * - Drag it anywhere on screen; on release it snaps to the nearest corner
 * - Collapse to a small pill; expand to see address + faucet
 * - Persists corner + collapsed state in localStorage
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { apiService } from '@/services/api.service'

type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

const BALANCE_REFRESH_MS = 15_000
const STORAGE_KEY = 'floating-wallet-state'
const SNAP_MARGIN = 16 // px gap from viewport edge

/** Compute the CSS left/top for a given corner */
function cornerToXY(corner: Corner, W: number, H: number, elW: number, elH: number) {
  switch (corner) {
    case 'top-left':     return { x: SNAP_MARGIN,          y: 72 }               // 72 = below typical navbar
    case 'top-right':    return { x: W - elW - SNAP_MARGIN, y: 72 }
    case 'bottom-left':  return { x: SNAP_MARGIN,           y: H - elH - SNAP_MARGIN }
    case 'bottom-right': return { x: W - elW - SNAP_MARGIN, y: H - elH - SNAP_MARGIN }
  }
}

/** Which corner is closest to (x, y)? */
function snapCorner(x: number, y: number, W: number, H: number): Corner {
  const left = x < W / 2
  const top  = y < H / 2
  if (left  && top)  return 'top-left'
  if (!left && top)  return 'top-right'
  if (left  && !top) return 'bottom-left'
  return 'bottom-right'
}

function shortenAddress(addr?: string | null) {
  if (!addr) return 'N/A'
  return `${addr.slice(0, 6)}…${addr.slice(-5)}`
}

export function FloatingWallet() {
  const { user, token } = useAuthStore()

  const [corner, setCorner]       = useState<Corner>('bottom-right')
  const [collapsed, setCollapsed] = useState(false)
  const [pos, setPos]             = useState<{ x: number; y: number } | null>(null) // null = not yet positioned
  const [dragging, setDragging]   = useState(false)

  const [balance, setBalance]           = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(true)
  const [funding, setFunding]           = useState(false)
  const [fundMsg, setFundMsg]           = useState<string | null>(null)
  const [copied, setCopied]             = useState(false)

  const widgetRef  = useRef<HTMLDivElement>(null)
  const dragOffset = useRef({ dx: 0, dy: 0 }) // cursor offset within the widget at drag start
  const moved      = useRef(false)             // did the pointer actually move? (to distinguish click vs drag)

  // ── Persist / restore ────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { corner: c, collapsed: col } = JSON.parse(saved)
        if (c) setCorner(c as Corner)
        if (col !== undefined) setCollapsed(col)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ corner, collapsed })) } catch {}
  }, [corner, collapsed])

  // ── Set initial position once the element is in the DOM ──────────────────────
  useEffect(() => {
    if (pos !== null) return // already positioned
    if (!widgetRef.current) return
    const { offsetWidth: w, offsetHeight: h } = widgetRef.current
    setPos(cornerToXY(corner, window.innerWidth, window.innerHeight, w, h))
  })

  // Re-snap to chosen corner when window resizes
  useEffect(() => {
    const onResize = () => {
      if (!widgetRef.current) return
      const { offsetWidth: w, offsetHeight: h } = widgetRef.current
      setPos(cornerToXY(corner, window.innerWidth, window.innerHeight, w, h))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [corner])

  // ── Balance polling ───────────────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    if (!user || !token) return
    try {
      const data = await apiService.wallet.getBalance()
      setBalance(data.balance ?? data.balanceSats ?? 0)
    } catch { /* silent */ } finally {
      setBalanceLoading(false)
    }
  }, [user, token])

  useEffect(() => {
    if (!user || !token) { setBalanceLoading(false); return }
    fetchBalance()
    const id = setInterval(fetchBalance, BALANCE_REFRESH_MS)
    return () => clearInterval(id)
  }, [user, token, fetchBalance])

  // ── Mouse drag (document-level listeners for reliable tracking) ───────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag on interactive elements
    if ((e.target as HTMLElement).closest('button, a, input')) return
    e.preventDefault()

    const rect = widgetRef.current!.getBoundingClientRect()
    dragOffset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
    moved.current = false
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return

    const onMouseMove = (e: MouseEvent) => {
      moved.current = true
      const x = e.clientX - dragOffset.current.dx
      const y = e.clientY - dragOffset.current.dy
      // Clamp inside viewport
      const el = widgetRef.current
      const maxX = el ? window.innerWidth  - el.offsetWidth  : window.innerWidth
      const maxY = el ? window.innerHeight - el.offsetHeight : window.innerHeight
      setPos({
        x: Math.max(0, Math.min(x, maxX)),
        y: Math.max(0, Math.min(y, maxY)),
      })
    }

    const onMouseUp = (e: MouseEvent) => {
      setDragging(false)
      if (!moved.current) return // it was a click, not a drag

      // Snap to nearest corner
      const cx = e.clientX
      const cy = e.clientY
      const newCorner = snapCorner(cx, cy, window.innerWidth, window.innerHeight)
      setCorner(newCorner)

      // Animate to exact corner position
      const el = widgetRef.current
      if (el) {
        setPos(cornerToXY(newCorner, window.innerWidth, window.innerHeight, el.offsetWidth, el.offsetHeight))
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging])

  // ── Faucet ────────────────────────────────────────────────────────────────────
  const handleFaucet = async () => {
    try {
      setFunding(true)
      setFundMsg(null)
      const data = await apiService.wallet.faucet({ amount: 1_000_000 })
      setFundMsg(`+${(data.fundedAmount ?? 1_000_000).toLocaleString()} sats added!`)
      await fetchBalance()
      setTimeout(() => setFundMsg(null), 4000)
    } catch (err) {
      setFundMsg(err instanceof Error ? `Error: ${err.message}` : 'Faucet failed')
    } finally {
      setFunding(false)
    }
  }

  // ── Copy address ──────────────────────────────────────────────────────────────
  const handleCopyAddress = () => {
    if (!user?.address) return
    navigator.clipboard?.writeText(user.address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!user || !token) return null

  const fmt = (n: number | null) => n === null ? '—' : n.toLocaleString()
  const isLow = balance !== null && balance < 50_000

  return (
    <div
      ref={widgetRef}
      style={{
        position: 'fixed',
        zIndex: 9999,
        left: pos?.x ?? -9999, // hide offscreen until first positioned
        top:  pos?.y ?? -9999,
        // Smooth snap animation after drag ends; no transition while dragging
        transition: dragging ? 'none' : 'left 0.25s cubic-bezier(.4,0,.2,1), top 0.25s cubic-bezier(.4,0,.2,1)',
        userSelect: 'none',
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onMouseDown={onMouseDown}
    >
      {/* ── Collapsed pill ─────────────────────────────────────────────────────── */}
      {collapsed ? (
        <div
          onClick={() => { if (!moved.current) setCollapsed(false) }}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-full shadow-lg text-sm font-semibold
            transition-transform hover:scale-105 active:scale-95
            ${isLow
              ? 'bg-orange-500 text-white ring-2 ring-orange-300'
              : 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white ring-1 ring-gray-200 dark:ring-zinc-700'
            }
          `}
          title="Click to expand"
        >
          <span>{isLow ? '⚠️' : '₿'}</span>
          {balanceLoading
            ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : <span>{fmt(balance)} sats</span>
          }
          {/* drag dots */}
          <span className="opacity-40 text-xs ml-0.5">⠿</span>
        </div>
      ) : (
        /* ── Expanded card ───────────────────────────────────────────────────── */
        <div
          className={`
            w-64 rounded-2xl shadow-2xl overflow-hidden
            bg-white dark:bg-zinc-900
            border ${isLow ? 'border-orange-400 dark:border-orange-500' : 'border-gray-200 dark:border-zinc-700'}
          `}
        >
          {/* Header / drag handle */}
          <div
            className={`
              px-4 py-3 flex items-center justify-between
              ${isLow ? 'bg-orange-50 dark:bg-orange-900/30' : 'bg-gray-50 dark:bg-zinc-800'}
            `}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{isLow ? '⚠️' : '₿'}</span>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Wallet
              </span>
              {/* drag affordance dots */}
              <span className="text-gray-300 dark:text-gray-600 text-sm ml-1 select-none">⠿⠿</span>
            </div>

            <div className="flex items-center gap-1">
              {/* Refresh button */}
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()} // don't start drag
                onClick={fetchBalance}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 transition-colors text-xs"
                title="Refresh balance"
              >
                ↻
              </button>
              {/* Collapse button */}
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={() => setCollapsed(true)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 transition-colors text-xs"
                title="Collapse"
              >
                —
              </button>
            </div>
          </div>

          {/* Balance */}
          <div className="px-4 pt-3 pb-2">
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Balance</div>
            {balanceLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400">Loading…</span>
              </div>
            ) : (
              <div className={`text-2xl font-bold tabular-nums ${isLow ? 'text-orange-500' : 'text-gray-900 dark:text-white'}`}>
                {fmt(balance)}
                <span className="text-sm font-normal text-gray-400 ml-1">sats</span>
              </div>
            )}
            {isLow && (
              <p className="mt-1 text-xs text-orange-600 dark:text-orange-400 font-medium">
                Low balance — top up before transactions fail
              </p>
            )}
          </div>

          {/* Address */}
          <div className="px-4 pb-3">
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Address</div>
            <button
              type="button"
              onMouseDown={e => e.stopPropagation()}
              onClick={handleCopyAddress}
              className="flex items-center gap-1.5 text-xs font-mono text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Click to copy full address"
            >
              <span>{shortenAddress(user.address)}</span>
              <span className="opacity-50">{copied ? '✓' : '⎘'}</span>
            </button>
            {copied && <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>}
          </div>

          {/* Fund message */}
          {fundMsg && (
            <div className={`mx-4 mb-3 px-3 py-1.5 rounded-lg text-xs font-medium ${
              fundMsg.startsWith('Error')
                ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
            }`}>
              {fundMsg}
            </div>
          )}

          {/* Faucet button */}
          <div className="px-4 pb-4">
            <button
              type="button"
              onMouseDown={e => e.stopPropagation()}
              onClick={handleFaucet}
              disabled={funding}
              className={`
                w-full py-2 rounded-xl text-xs font-semibold transition-all
                disabled:opacity-60 disabled:cursor-not-allowed
                ${isLow
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-200'
                }
              `}
            >
              {funding
                ? <span className="flex items-center justify-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Adding funds…
                  </span>
                : '💰 Get 1M Test Sats'
              }
            </button>

            <p className="text-center text-xs text-gray-300 dark:text-gray-600 mt-2">
              drag to move · auto-refreshes every 15s
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
