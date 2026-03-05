'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createComputer } from '@/lib/bitcoin-computer'

interface WalletContextType {
  connected: boolean
  address: string | null
  publicKey: string | null
  balance: bigint
  computer: typeof createComputer.prototype | null
  connect: () => Promise<void>
  disconnect: () => void
  fundWallet: () => Promise<void>
  refreshBalance: () => Promise<void>
}

const WalletContext = createContext<WalletContextType>({
  connected: false,
  address: null,
  publicKey: null,
  balance: BigInt(0),
  computer: null,
  connect: async () => {},
  disconnect: () => {},
  fundWallet: async () => {},
  refreshBalance: async () => {}
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [balance, setBalance] = useState<bigint>(BigInt(0))
  const [computer, setComputer] = useState<typeof createComputer.prototype | null>(null)

  const connect = async () => {
    try {
      // Create Bitcoin Computer instance
      const comp = createComputer()
      
      // Get wallet details
      const addr = comp.getAddress()
      const pubKey = comp.getPublicKey()
      
      setComputer(comp)
      setAddress(addr)
      setPublicKey(pubKey)
      setConnected(true)
      
      // Get initial balance
      await refreshBalance()
      
      console.log('✅ Wallet connected:', addr)
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error)
      throw error
    }
  }

  const disconnect = () => {
    setConnected(false)
    setAddress(null)
    setPublicKey(null)
    setBalance(BigInt(0))
    setComputer(null)
    console.log('👋 Wallet disconnected')
  }

  const fundWallet = async () => {
    if (!computer) throw new Error('Wallet not connected')
    
    try {
      console.log('💰 Requesting funds from faucet...')
      await computer.faucet(0.01e8) // Request 0.01 LTC
      await refreshBalance()
      console.log('✅ Wallet funded!')
    } catch (error) {
      console.error('❌ Failed to fund wallet:', error)
      throw error
    }
  }

  const refreshBalance = useCallback(async () => {
    if (!computer) return
    
    try {
      const { balance: bal } = await computer.getBalance()
      setBalance(bal)
    } catch (error) {
      console.error('❌ Failed to fetch balance:', error)
    }
  }, [computer])

  // Auto-refresh balance every 30 seconds when connected
  useEffect(() => {
    if (!connected || !computer) return
    
    const interval = setInterval(() => {
      refreshBalance()
    }, 30000)
    return () => clearInterval(interval)
  }, [connected, computer, refreshBalance])

  return (
    <WalletContext.Provider
      value={{
        connected,
        address,
        publicKey,
        balance,
        computer,
        connect,
        disconnect,
        fundWallet,
        refreshBalance
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider')
  }
  return context
}
