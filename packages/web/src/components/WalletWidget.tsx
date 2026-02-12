'use client'

import { useState, useEffect } from 'react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function WalletWidget() {
  const [wallet, setWallet] = useState<{
    address: string
    balance: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [funding, setFunding] = useState(false)

  useEffect(() => {
    fetchBalance()
    // Refresh every 10 seconds
    const interval = setInterval(fetchBalance, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/wallet/balance')
      const data = await response.json()

      if (data.success) {
        setWallet({
          address: data.address,
          balance: data.balance
        })
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch balance')
      }
    } catch (err) {
      console.error('Error fetching balance:', err)
      setError('Failed to connect')
    } finally {
      setLoading(false)
    }
  }

  const handleFaucet = async () => {
    try {
      setFunding(true)
      setError(null)
      const response = await fetch('/api/wallet/faucet', { method: 'POST' })
      const data = await response.json()

      if (data.success) {
        setWallet({
          address: data.address,
          balance: data.balance
        })
      } else {
        setError(data.error || 'Failed to fund wallet')
      }
    } catch (err) {
      console.error('Error funding wallet:', err)
      setError('Failed to connect')
    } finally {
      setFunding(false)
    }
  }

  const formatBalance = (sats: number | null | undefined) => {
    if (sats === null || sats === undefined) return '0'
    return sats.toLocaleString()
  }

  const shortenAddress = (addr: string) => {
    if (!addr) return 'N/A'
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (loading) {
    return (
      <Card>
        <CardBody className="p-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading wallet...</span>
          </div>
        </CardBody>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardBody className="p-4">
          <div className="text-sm text-red-600">❌ {error}</div>
        </CardBody>
      </Card>
    )
  }

  if (!wallet) return null

  return (
    <Card>
      <CardBody className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Wallet Balance</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatBalance(wallet.balance)} <span className="text-sm text-gray-500">sats</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Address</div>
              <div className="text-xs font-mono text-gray-700 dark:text-gray-300">
                {shortenAddress(wallet.address)}
              </div>
            </div>
          </div>
          <Button
            onClick={handleFaucet}
            disabled={funding}
            size="sm"
            className="w-full"
            variant="secondary"
          >
            {funding ? '💰 Funding...' : '💰 Get Test Funds'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
