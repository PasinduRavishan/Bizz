'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { apiService } from '@/services/api.service'

/**
 * WalletWidget Component
 *
 * Fetches live wallet balance from GET /wallet/balance (NestJS backend,
 * which reads balance directly from the Bitcoin Computer node).
 * Each user has their own wallet — balance is real, not a placeholder.
 */
export function WalletWidget() {
  const { user, token } = useAuthStore()
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [funding, setFunding] = useState(false)
  const [fundMsg, setFundMsg] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    try {
      const data = await apiService.wallet.getBalance()
      setBalance(data.balance ?? data.balanceSats ?? 0)
      setError(null)
    } catch (err) {
      console.error('Error fetching balance:', err)
      setError('Could not load balance')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user && token) {
      fetchBalance()
      // Refresh every 15 seconds
      const interval = setInterval(fetchBalance, 15000)
      return () => clearInterval(interval)
    } else {
      setLoading(false)
    }
  }, [user, token, fetchBalance])

  const handleFaucet = async () => {
    try {
      setFunding(true)
      setFundMsg(null)
      setError(null)

      const data = await apiService.wallet.faucet({ amount: 1000000 })
      setFundMsg(`✅ Funded! +${(data.fundedAmount ?? 1000000).toLocaleString()} sats`)
      // Refresh balance after funding
      await fetchBalance()
    } catch (err) {
      console.error('Error funding wallet:', err)
      setError(err instanceof Error ? err.message : 'Failed to fund wallet')
    } finally {
      setFunding(false)
    }
  }

  const formatBalance = (sats: number | null) => {
    if (sats === null || sats === undefined) return '—'
    return sats.toLocaleString()
  }

  const shortenAddress = (addr: string | null | undefined) => {
    if (!addr) return 'N/A'
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`
  }

  // Not logged in
  if (!user) {
    return (
      <Card>
        <CardBody className="p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Please log in to view your wallet
          </div>
        </CardBody>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardBody className="p-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading wallet…</span>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody className="p-4">
        <div className="space-y-3">
          {/* Balance + address row */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Wallet Balance</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {error ? (
                  <span className="text-base text-orange-500">⚠️ {error}</span>
                ) : (
                  <>
                    {formatBalance(balance)}
                    <span className="text-sm font-normal text-gray-500 ml-1">sats</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Address</div>
              <div
                className="text-xs font-mono text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 transition-colors"
                title={`${user.address} — click to copy`}
                onClick={() => navigator.clipboard?.writeText(user.address)}
              >
                {shortenAddress(user.address)}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">click to copy</div>
            </div>
          </div>

          {/* Success message after faucet */}
          {fundMsg && (
            <div className="text-xs text-green-600 dark:text-green-400 font-medium">{fundMsg}</div>
          )}

          {/* Faucet button */}
          <Button
            onClick={handleFaucet}
            disabled={funding}
            size="sm"
            className="w-full"
            variant="secondary"
          >
            {funding ? '⏳ Funding…' : '💰 Get Test Funds (1M sats)'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
