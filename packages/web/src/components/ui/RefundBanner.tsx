'use client'

import { useState } from 'react'
import { Button } from './Button'

interface RefundBannerProps {
  reason: string
  eligibleAmount: number
  attemptId: string
  onRefundClaimed?: () => void
  className?: string
}

export function RefundBanner({
  reason,
  eligibleAmount,
  attemptId,
  onRefundClaimed,
  className = ''
}: RefundBannerProps) {
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatSatoshis = (sats: number) => {
    return sats.toLocaleString()
  }

  const handleClaimRefund = async () => {
    try {
      setClaiming(true)
      setError(null)

      const response = await fetch(`/api/attempts/${attemptId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const result = await response.json()

      if (response.ok && result.success) {
        onRefundClaimed?.()
      } else {
        setError(result.error || 'Failed to claim refund')
      }
    } catch (err) {
      console.error('Refund claim error:', err)
      setError('Failed to process refund claim')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className={`mt-3 p-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg text-white ${className}`}>
      <div className="flex items-start gap-3">
        <span className="text-3xl">💸</span>
        <div className="flex-1">
          <h4 className="font-bold text-lg mb-1">Refund Available</h4>
          <p className="text-sm text-white/90 mb-3">{reason}</p>

          <div className="bg-white/20 rounded-lg p-3 mb-3">
            <div className="text-xs text-white/80 mb-1">Refund Amount</div>
            <div className="text-2xl font-bold">{formatSatoshis(eligibleAmount)} sats</div>
            <div className="text-xs text-white/70 mt-1">
              (minus estimated gas fee: ~1,000 sats)
            </div>
          </div>

          {error && (
            <div className="mb-3 p-2 bg-red-500/20 border border-red-300/30 rounded text-sm">
              {error}
            </div>
          )}

          <Button
            size="sm"
            className="bg-white text-purple-600 hover:bg-gray-100 dark:bg-white dark:text-purple-600 dark:hover:bg-gray-100"
            onClick={handleClaimRefund}
            disabled={claiming}
          >
            {claiming ? 'Claiming Refund...' : '💰 Claim Refund'}
          </Button>
        </div>
      </div>
    </div>
  )
}
