'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Wallet, RefreshCw, Copy, CheckCircle2 } from 'lucide-react'

interface WalletInfo {
  address: string
  balance: number
  lastBalanceCheck: string | null
  walletType: string
}

export function WalletBalance() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWalletInfo = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/wallet/info')
      const data = await response.json()

      if (data.success) {
        setWallet(data.wallet)
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch wallet info')
      }
    } catch (err) {
      console.error('Failed to fetch wallet info:', err)
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const refreshBalance = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/wallet/balance', { method: 'POST' })
      const data = await response.json()

      if (data.success) {
        setWallet(prev => prev ? { ...prev, balance: data.balance, lastBalanceCheck: new Date().toISOString() } : null)
        setError(null)
      } else {
        setError(data.error || 'Failed to refresh balance')
      }
    } catch (err) {
      console.error('Failed to refresh balance:', err)
      setError('Failed to connect to server')
    } finally {
      setRefreshing(false)
    }
  }

  const copyAddress = () => {
    if (wallet?.address) {
      navigator.clipboard.writeText(wallet.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  useEffect(() => {
    fetchWalletInfo()
    
    // Auto-refresh when user returns to the page
    const handleFocus = () => {
      fetchWalletInfo()
    }
    
    window.addEventListener('focus', handleFocus)
    
    // Also refresh every 30 seconds if page is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchWalletInfo()
      }
    }, 30000)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Wallet</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardBody>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Wallet</h3>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-red-600">{error}</p>
          <Button onClick={fetchWalletInfo} size="sm" className="mt-2">
            Retry
          </Button>
        </CardBody>
      </Card>
    )
  }

  if (!wallet) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Wallet</h3>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-600">No wallet found</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Your Wallet</h3>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {wallet.walletType === 'CUSTODIAL' ? 'Managed custodial wallet' : 'Connected wallet'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Balance */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Balance</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">
                {(wallet.balance / 100000000).toFixed(8)} LTC
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {wallet.balance.toLocaleString()} satoshis
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshBalance}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Address */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Address</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {wallet.address}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={copyAddress}
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Last Check */}
        {wallet.lastBalanceCheck && (
          <div>
            <p className="text-xs text-gray-500">
              Last updated: {new Date(wallet.lastBalanceCheck).toLocaleString()}
            </p>
          </div>
        )}

        {/* Low Balance Warning */}
        {wallet.balance < 100000 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ Low balance! You may not have enough funds for transactions. Contact support to add funds.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
