'use client'

import { useWallet } from '@/contexts/WalletContext'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { useState } from 'react'

export function WalletConnect() {
  const { connected, address, balance, connect, disconnect, fundWallet } = useWallet()
  const [loading, setLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    try {
      await connect()
    } catch {
      alert('Failed to connect wallet. Make sure you have a Bitcoin Computer wallet configured.')
    } finally {
      setLoading(false)
    }
  }

  const handleFund = async () => {
    setLoading(true)
    try {
      await fundWallet()
      alert('Wallet funded successfully!')
    } catch {
      alert('Failed to fund wallet. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (connected && address) {
    const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
    const ltcBalance = Number(balance) / 1e8

    return (
      <div className="relative">
        <Card className="inline-block cursor-pointer" onClick={() => setShowMenu(!showMenu)}>
          <CardBody className="flex items-center gap-3 py-2 px-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <div className="text-left">
                <div className="text-sm font-mono text-gray-900 dark:text-white">{shortAddress}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{ltcBalance.toFixed(5)} LTC</div>
              </div>
            </div>
          </CardBody>
        </Card>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-50">
              <div className="p-4 space-y-3">
                <div className="pb-3 border-b border-gray-200 dark:border-zinc-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Address</div>
                  <div className="text-sm font-mono text-gray-900 dark:text-white break-all">{address}</div>
                </div>
                
                <div className="pb-3 border-b border-gray-200 dark:border-zinc-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Balance</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{ltcBalance.toFixed(8)} LTC</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{balance.toString()} sats</div>
                </div>

                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full"
                  onClick={handleFund}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : '💰 Fund from Faucet'}
                </Button>
                
                <Button 
                  size="sm" 
                  variant="danger" 
                  className="w-full"
                  onClick={disconnect}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <Button onClick={handleConnect} disabled={loading}>
      {loading ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  )
}
