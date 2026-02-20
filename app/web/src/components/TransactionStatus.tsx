'use client'

import { Card, CardBody } from './ui/Card'
import { Badge } from './ui/Badge'

interface Transaction {
  id: string
  type: 'quiz_creation' | 'quiz_attempt' | 'reveal' | 'payout'
  status: 'pending' | 'confirming' | 'confirmed' | 'failed'
  description: string
  timestamp: Date
  txHash?: string
}

interface TransactionStatusProps {
  transaction?: Transaction
  onClose?: () => void
}

export function TransactionStatus({ transaction, onClose }: TransactionStatusProps) {
  const tx = transaction || null

  if (!tx) return null

  const getStatusBadge = (status: Transaction['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">PENDING</Badge>
      case 'confirming':
        return <Badge variant="info">CONFIRMING</Badge>
      case 'confirmed':
        return <Badge variant="success">CONFIRMED</Badge>
      case 'failed':
        return <Badge variant="danger">FAILED</Badge>
    }
  }

  const getIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'pending':
      case 'confirming':
        return (
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        )
      case 'confirmed':
        return (
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <span className="text-2xl">✓</span>
          </div>
        )
      case 'failed':
        return (
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
            <span className="text-2xl">✕</span>
          </div>
        )
    }
  }

  const getMessage = (status: Transaction['status']) => {
    if (status === 'pending') {
      return 'Broadcasting transaction to network...'
    }
    if (status === 'confirming') {
      return 'Waiting for blockchain confirmation...'
    }
    if (status === 'confirmed') {
      return 'Transaction confirmed on blockchain!'
    }
    if (status === 'failed') {
      return 'Transaction failed. Please try again.'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardBody className="text-center py-8">
          <div className="flex justify-center mb-4">
            {getIcon(tx.status)}
          </div>

          <div className="mb-4">
            {getStatusBadge(tx.status)}
          </div>

          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {tx.description}
          </h3>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {getMessage(tx.status)}
          </p>

          {tx.txHash && (
            <div className="bg-gray-100 dark:bg-zinc-800 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Transaction Hash</p>
              <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                {tx.txHash}
              </p>
            </div>
          )}

          {(tx.status === 'confirmed' || tx.status === 'failed') && onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

// Transaction history component
interface TransactionHistoryProps {
  transactions: Transaction[]
}

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <div className="text-4xl mb-2">📜</div>
          <p className="text-gray-600 dark:text-gray-400">No transactions yet</p>
        </CardBody>
      </Card>
    )
  }

  const getTypeLabel = (type: Transaction['type']) => {
    switch (type) {
      case 'quiz_creation': return '🎓 Quiz Created'
      case 'quiz_attempt': return '📝 Quiz Attempt'
      case 'reveal': return '🔓 Answers Revealed'
      case 'payout': return '💰 Payout Received'
    }
  }

  const getStatusBadge = (status: Transaction['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">PENDING</Badge>
      case 'confirming':
        return <Badge variant="info">CONFIRMING</Badge>
      case 'confirmed':
        return <Badge variant="success">CONFIRMED</Badge>
      case 'failed':
        return <Badge variant="danger">FAILED</Badge>
    }
  }

  return (
    <Card>
      <CardBody>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Transaction History
        </h3>
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {getTypeLabel(tx.type)}
                  </span>
                  {getStatusBadge(tx.status)}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {tx.description}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {tx.timestamp.toLocaleString()}
                </p>
              </div>
              {tx.txHash && (
                <a
                  href={`https://blockexplorer.one/ltc/testnet/tx/${tx.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  View →
                </a>
              )}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
