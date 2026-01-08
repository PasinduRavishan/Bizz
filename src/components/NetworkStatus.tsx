'use client'

import { useEffect, useState } from 'react'
import { getComputerConfig } from '@/lib/bitcoin-computer'

export default function NetworkStatus() {
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    const conf = getComputerConfig()
    setConfig(conf)
  }, [])

  if (!config) return null

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 shadow-lg">
      <div className="text-sm font-mono">
        <div className="font-bold text-yellow-800 mb-2">⚠️ REGTEST MODE</div>
        <div className="text-gray-700">
          <div>Network: <span className="font-semibold">{config.network}</span></div>
          <div>Chain: <span className="font-semibold">{config.chain}</span></div>
          <div className="text-xs mt-1 text-gray-600">
            Development environment - Not real blockchain
          </div>
        </div>
      </div>
    </div>
  )
}