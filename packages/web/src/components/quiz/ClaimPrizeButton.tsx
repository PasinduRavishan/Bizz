'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface ClaimPrizeButtonProps {
  attemptId: string
  prizeAmount: string
  onSuccess?: () => void
}

export function ClaimPrizeButton({ attemptId, prizeAmount, onSuccess }: ClaimPrizeButtonProps) {
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const formatSatoshis = (satoshis: string) => {
    const sats = parseInt(satoshis)
    return sats.toLocaleString()
  }

  const handleClaim = async () => {
    try {
      setClaiming(true)
      setError(null)

      console.log('Claiming prize for attempt:', attemptId)

      const response = await fetch('/api/prizes/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ attemptId })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        console.log('Prize claimed successfully:', result)
        setSuccess(true)
        if (onSuccess) {
          onSuccess()
        }
      } else {
        throw new Error(result.error || 'Failed to claim prize')
      }
    } catch (err) {
      console.error('Error claiming prize:', err)
      setError(err instanceof Error ? err.message : 'Failed to claim prize')
    } finally {
      setClaiming(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
              Prize Claimed!
            </h3>
            <div className="mt-1 text-sm text-green-700 dark:text-green-300">
              <p>Funds have been released to your wallet.</p>
              <p className="font-mono mt-1">{formatSatoshis(prizeAmount)} sats</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <Button
        onClick={handleClaim}
        disabled={claiming}
        className="w-full"
        size="lg"
      >
        {claiming ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Claiming Prize...
          </>
        ) : (
          <>
            🎁 Claim Prize ({formatSatoshis(prizeAmount)} sats)
          </>
        )}
      </Button>

      <p className="text-xs text-center text-gray-500 dark:text-gray-400">
        This will release the funds from the Payment contract to your wallet
      </p>
    </div>
  )
}
