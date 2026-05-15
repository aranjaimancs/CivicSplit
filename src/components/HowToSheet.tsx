import { useState } from 'react'

interface Props {
  groupName: string
  onClose: () => void
}

const SLIDES = [
  {
    emoji: '👋',
    title: (groupName: string) => `Welcome to ${groupName}!`,
    body: "BudgetSplit keeps everyone even when you share expenses. It takes about 30 seconds to log a receipt — here's everything you need to know.",
  },
  {
    emoji: '🧾',
    title: () => 'Log expenses as you go',
    body: 'Tap + in the bar at the bottom to add an expense. Enter each line item, choose who splits it, and save. Everyone\'s balance updates instantly.',
  },
  {
    emoji: '💸',
    title: () => 'Pay each other back',
    body: 'The home screen shows who owes who. When money changes hands, tap Settle and mark the payment — that clears it from everyone\'s balance.',
  },
  {
    emoji: '💰',
    title: () => 'Stay on budget',
    body: 'Your stipend remaining is always shown at the top. The Budget Guide breaks it down by week, day, or month so you can plan your spending.',
  },
] as const

export function HowToSheet({ groupName, onClose }: Props) {
  const [step, setStep] = useState(0)
  const slide = SLIDES[step]
  const isLast = step === SLIDES.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-5"
      style={{
        paddingTop:    'max(1.25rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-[380px] overflow-hidden rounded-3xl bg-white shadow-2xl animate-slide-up">

        {/* Slide content */}
        <div className="px-8 pb-6 pt-8 text-center">
          {/* Emoji */}
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-50 text-5xl shadow-sm ring-1 ring-primary-100">
            {slide.emoji}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {slide.title(groupName)}
          </h2>

          {/* Body */}
          <p className="mt-2.5 text-[14px] leading-relaxed text-slate-500">
            {slide.body}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pb-5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={[
                'rounded-full transition-all duration-200',
                i === step
                  ? 'h-2 w-6 bg-primary-600'
                  : 'h-2 w-2 bg-slate-200',
              ].join(' ')}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-2 px-6 pb-7">
          <button
            type="button"
            onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
            className="w-full rounded-2xl bg-primary-600 py-3.5 text-[15px] font-bold text-white shadow-md shadow-primary-600/25 transition-all hover:bg-primary-700 active:scale-[0.98]"
          >
            {isLast ? 'Get started' : 'Next'}
          </button>

          {step > 0 && !isLast && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="w-full py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-600"
            >
              Back
            </button>
          )}

          {step === 0 && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-600"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
