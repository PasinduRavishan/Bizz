'use client'

interface FlowStep {
  id: string
  label: string
  description?: string
  icon?: string
}

interface FlowProgressProps {
  steps: FlowStep[]
  currentStep: string
  completedSteps: string[]
}

export function FlowProgress({ steps, currentStep, completedSteps }: FlowProgressProps) {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between relative">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700 -z-10" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-blue-600 dark:bg-blue-500 -z-10 transition-all duration-500"
          style={{
            width: `${(completedSteps.length / (steps.length - 1)) * 100}%`,
          }}
        />

        {/* Steps */}
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id)
          const isCurrent = currentStep === step.id
          const isPending = !isCompleted && !isCurrent

          return (
            <div key={step.id} className="flex flex-col items-center relative flex-1">
              {/* Step Circle */}
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                  transition-all duration-300 mb-2
                  ${isCompleted
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
                    : isCurrent
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50 ring-4 ring-blue-200 dark:ring-blue-900 animate-pulse'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }
                `}
              >
                {isCompleted ? '✓' : step.icon || index + 1}
              </div>

              {/* Step Label */}
              <div className="text-center max-w-[120px]">
                <div
                  className={`
                    text-xs font-medium mb-1
                    ${isCurrent
                      ? 'text-blue-600 dark:text-blue-400'
                      : isCompleted
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                    }
                  `}
                >
                  {step.label}
                </div>
                {step.description && isCurrent && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {step.description}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
