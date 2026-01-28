'use client'

import { useState, useEffect } from 'react'

interface CountdownTimerProps {
  deadline: Date | string
  onExpire?: () => void
  className?: string
  urgencyThresholds?: {
    safe: number    // > 24 hours (green)
    warning: number // 1-24 hours (orange)
    urgent: number  // < 1 hour (red)
  }
}

export function CountdownTimer({
  deadline,
  onExpire,
  className = '',
  urgencyThresholds = {
    safe: 24 * 60 * 60 * 1000,      // 24 hours
    warning: 60 * 60 * 1000,         // 1 hour
    urgent: 0
  }
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [hasExpired, setHasExpired] = useState(false)

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime()
      const target = new Date(deadline).getTime()
      const diff = target - now

      if (diff <= 0) {
        setTimeRemaining(0)
        if (!hasExpired) {
          setHasExpired(true)
          onExpire?.()
        }
      } else {
        setTimeRemaining(diff)
      }
    }

    // Initial calculation
    calculateTimeRemaining()

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000)

    return () => clearInterval(interval)
  }, [deadline, hasExpired, onExpire])

  const formatTime = (ms: number): string => {
    if (ms <= 0) return 'Expired'

    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      const remainingHours = hours % 24
      return remainingHours > 0
        ? `${days}d ${remainingHours}h`
        : `${days} day${days > 1 ? 's' : ''}`
    }

    if (hours > 0) {
      const remainingMinutes = minutes % 60
      return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours} hour${hours > 1 ? 's' : ''}`
    }

    if (minutes > 0) {
      const remainingSeconds = seconds % 60
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes} minute${minutes > 1 ? 's' : ''}`
    }

    return `${seconds} second${seconds > 1 ? 's' : ''}`
  }

  const getUrgencyColor = (): string => {
    if (timeRemaining <= 0) return 'text-red-600 dark:text-red-400 font-bold'
    if (timeRemaining < urgencyThresholds.warning) return 'text-red-600 dark:text-red-400 font-medium'
    if (timeRemaining < urgencyThresholds.safe) return 'text-orange-600 dark:text-orange-400'
    return 'text-green-600 dark:text-green-400'
  }

  return (
    <span className={`${getUrgencyColor()} ${className}`}>
      {formatTime(timeRemaining)}
    </span>
  )
}
