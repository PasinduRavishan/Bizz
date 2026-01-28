'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface RefundableAttempt {
  id: string
  quiz: {
    id: string
    title: string | null
    entryFee: string
    status: string
  }
  refundReason?: string
}

interface RefundClaimModalProps {
  refundableAttempts: RefundableAttempt[]
  onClose: () => void
  onSuccess: () => void
}

export function RefundClaimModal({
  refundableAttempts,
  onClose,
  onSuccess
}: RefundClaimModalProps) {
  const [selectedAttempts, setSelectedAttempts] = useState<Set<string>>(
    new Set(refundableAttempts.map(a => a.id))
  )
  const [processing, setProcessing] = useState(false)
  const [step, setStep] = useState<'select' | 'confirming' | 'processing' | 'success' | 'error'>('select')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any>(null)

  const formatSatoshis = (sats: string | number) => {
    const amount = typeof sats === 'string' ? parseInt(sats) : sats
    return amount.toLocaleString()
  }

  const toggleAttempt = (attemptId: string) => {
    const newSelected = new Set(selectedAttempts)
    if (newSelected.has(attemptId)) {
      newSelected.delete(attemptId)
    } else {
      newSelected.add(attemptId)
    }
    setSelectedAttempts(newSelected)
  }

  const toggleAll = () => {
    if (selectedAttempts.size === refundableAttempts.length) {
      setSelectedAttempts(new Set())
    } else {
      setSelectedAttempts(new Set(refundableAttempts.map(a => a.id)))
    }
  }

  const calculateTotal = () => {
    return refundableAttempts
      .filter(a => selectedAttempts.has(a.id))
      .reduce((sum, a) => sum + parseInt(a.quiz.entryFee), 0)
  }

  const estimatedGasFee = selectedAttempts.size * 1000 // ~1000 sats per refund

  const handleConfirm = () => {
    if (selectedAttempts.size === 0) return
    setStep('confirming')
  }

  const handleProcessRefunds = async () => {
    try {
      setProcessing(true)
      setStep('processing')
      setError(null)

      const attemptIds = Array.from(selectedAttempts)

      // Process refunds in parallel
      const refundPromises = attemptIds.map(async (attemptId) => {
        const response = await fetch(`/api/attempts/${attemptId}/refund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        const result = await response.json()
        return { attemptId, success: response.ok && result.success, error: result.error }
      })

      const refundResults = await Promise.all(refundPromises)

      const successCount = refundResults.filter(r => r.success).length
      const failedRefunds = refundResults.filter(r => !r.success)

      setResults({
        total: attemptIds.length,
        successful: successCount,
        failed: failedRefunds.length,
        failedAttempts: failedRefunds
      })

      if (successCount > 0) {
        setStep('success')
        // Call onSuccess after a short delay to allow user to see results
        setTimeout(() => {
          onSuccess()
        }, 3000)
      } else {
        setStep('error')
        setError('All refund claims failed. Please try again.')
      }
    } catch (err) {
      console.error('Refund processing error:', err)
      setStep('error')
      setError('Failed to process refunds. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            💸 Claim Refunds
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
            disabled={processing}
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Select Attempts */}
          {step === 'select' && (
            <>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Select the quiz attempts you want to claim refunds for:
              </p>

              <div className="mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAll}
                >
                  {selectedAttempts.size === refundableAttempts.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="space-y-3 mb-6">
                {refundableAttempts.map((attempt) => (
                  <Card
                    key={attempt.id}
                    className={`cursor-pointer transition-all ${
                      selectedAttempts.has(attempt.id)
                        ? 'ring-2 ring-purple-500 dark:ring-purple-400'
                        : ''
                    }`}
                    onClick={() => toggleAttempt(attempt.id)}
                  >
                    <CardBody>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedAttempts.has(attempt.id)}
                            onChange={() => toggleAttempt(attempt.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                              {attempt.quiz.title || 'Untitled Quiz'}
                            </h4>
                            {attempt.refundReason && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                {attempt.refundReason}
                              </p>
                            )}
                            <Badge variant="abandoned">{attempt.quiz.status}</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                            {formatSatoshis(attempt.quiz.entryFee)} sats
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-700 dark:text-gray-300">Total Refund:</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatSatoshis(calculateTotal())} sats
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Estimated Gas Fees:</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    ~{formatSatoshis(estimatedGasFee)} sats
                  </span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2 flex justify-between items-center">
                  <span className="font-medium text-gray-900 dark:text-white">Net Amount:</span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    ~{formatSatoshis(calculateTotal() - estimatedGasFee)} sats
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleConfirm}
                  disabled={selectedAttempts.size === 0}
                  className="flex-1"
                >
                  Continue ({selectedAttempts.size} selected)
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {/* Step 2: Confirmation */}
          {step === 'confirming' && (
            <>
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Confirm Refund Claims
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  You are about to claim refunds for {selectedAttempts.size} quiz attempt{selectedAttempts.size > 1 ? 's' : ''}.
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-6">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Attempts:</span>
                    <span className="font-medium">{selectedAttempts.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Total Refund:</span>
                    <span className="font-medium">{formatSatoshis(calculateTotal())} sats</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Est. Gas Fees:</span>
                    <span className="font-medium">~{formatSatoshis(estimatedGasFee)} sats</span>
                  </div>
                  <div className="border-t border-purple-300 dark:border-purple-700 pt-2 flex justify-between">
                    <span className="font-bold text-gray-900 dark:text-white">Net Amount:</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      ~{formatSatoshis(calculateTotal() - estimatedGasFee)} sats
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleProcessRefunds}
                  disabled={processing}
                  className="flex-1"
                >
                  {processing ? 'Processing...' : 'Confirm & Claim Refunds'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep('select')}
                  disabled={processing}
                >
                  Back
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Processing */}
          {step === 'processing' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Processing Refunds...
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Claiming refunds on the blockchain. This may take 30-60 seconds.
              </p>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && results && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Refunds Claimed Successfully!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {results.successful} of {results.total} refund{results.total > 1 ? 's' : ''} processed successfully.
              </p>

              {results.failed > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
                  <p className="text-sm text-orange-900 dark:text-orange-100">
                    {results.failed} refund{results.failed > 1 ? 's' : ''} failed. You can try claiming them again later.
                  </p>
                </div>
              )}

              <Button onClick={onClose}>Close</Button>
            </div>
          )}

          {/* Step 5: Error */}
          {step === 'error' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">❌</div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Refund Claim Failed
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {error || 'An error occurred while processing refunds.'}
              </p>

              <div className="flex gap-2 justify-center">
                <Button onClick={() => setStep('select')}>Try Again</Button>
                <Button variant="outline" onClick={onClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
