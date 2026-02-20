'use client'

interface TimelinePhase {
  label: string
  date: Date | string
  status: 'complete' | 'active' | 'pending'
}

interface DeadlineTimelineProps {
  phases: TimelinePhase[]
  className?: string
}

export function DeadlineTimeline({ phases, className = '' }: DeadlineTimelineProps) {
  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPhaseColor = (status: string): string => {
    switch (status) {
      case 'complete':
        return 'bg-green-600 border-green-600'
      case 'active':
        return 'bg-blue-600 border-blue-600 ring-4 ring-blue-200 dark:ring-blue-900'
      case 'pending':
        return 'bg-gray-300 border-gray-300 dark:bg-gray-600 dark:border-gray-600'
      default:
        return 'bg-gray-300 border-gray-300'
    }
  }

  const getLineColor = (currentStatus: string, nextStatus: string): string => {
    if (currentStatus === 'complete' && (nextStatus === 'complete' || nextStatus === 'active')) {
      return 'bg-green-600'
    }
    return 'bg-gray-300 dark:bg-gray-600'
  }

  return (
    <div className={`py-4 ${className}`}>
      {/* Desktop: Horizontal Timeline */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between">
          {phases.map((phase, index) => (
            <div key={index} className="flex items-center flex-1">
              {/* Phase Marker */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-4 h-4 rounded-full border-2 ${getPhaseColor(phase.status)} transition-all duration-300`}
                  title={formatDate(phase.date)}
                />
                <div className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-300 text-center whitespace-nowrap">
                  {phase.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center whitespace-nowrap">
                  {formatDate(phase.date)}
                </div>
              </div>

              {/* Connecting Line */}
              {index < phases.length - 1 && (
                <div className="flex-1 mx-2">
                  <div
                    className={`h-1 ${getLineColor(phase.status, phases[index + 1].status)} transition-all duration-300`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: Vertical Timeline */}
      <div className="md:hidden space-y-4">
        {phases.map((phase, index) => (
          <div key={index} className="flex items-start gap-3">
            {/* Vertical Line and Marker */}
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full border-2 ${getPhaseColor(phase.status)} transition-all duration-300`}
              />
              {index < phases.length - 1 && (
                <div
                  className={`w-1 h-12 ${getLineColor(phase.status, phases[index + 1].status)} transition-all duration-300`}
                />
              )}
            </div>

            {/* Phase Info */}
            <div className="flex-1 pb-4">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {phase.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(phase.date)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
