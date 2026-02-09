/**
 * Charge Dialog Component
 *
 * Modal dialog for selecting top-up amount
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, DollarSign, Loader2 } from 'lucide-react'

interface ChargeDialogProps {
  open: boolean
  onClose: () => void
  onContinue: (amountCents: number) => Promise<void>
  defaultAmount?: number
  minAmount?: number
  maxAmount?: number
}

export function ChargeDialog({
  open,
  onClose,
  onContinue,
  defaultAmount = 10,
  minAmount = 5,
  maxAmount = 95
}: ChargeDialogProps): JSX.Element | null {
  const { t } = useTranslation()
  const [amount, setAmount] = useState<string>(String(defaultAmount))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset amount when dialog opens
  useEffect(() => {
    if (open) {
      setAmount(String(defaultAmount))
      setError(null)
    }
  }, [open, defaultAmount])

  const amountNum = Number.parseInt(amount, 10)
  const amountValid =
    Number.isInteger(amountNum) && amountNum >= minAmount && amountNum <= maxAmount

  const handleContinue = async (): Promise<void> => {
    if (!amountValid) return

    setLoading(true)
    setError(null)

    try {
      await onContinue(amountNum * 100) // Convert to cents
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.account.topUpError'))
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    // Only allow digits
    const next = e.target.value.replace(/[^0-9]/g, '')
    setAmount(next)
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    // Prevent non-numeric keys
    if (['e', 'E', '+', '-', '.'].includes(e.key)) {
      e.preventDefault()
    }
    // Submit on Enter
    if (e.key === 'Enter' && amountValid && !loading) {
      handleContinue()
    }
    // Close on Escape
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-sm mx-4 bg-[var(--bg-primary)] rounded-2xl shadow-xl border border-[var(--glass-border)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
            {t('settings.account.addCredits')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] transition-colors text-[var(--text-muted)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2">
              {t('settings.account.amountToAdd')}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={amount}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[16px] font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all disabled:opacity-50"
                autoFocus
              />
            </div>
          </div>

          <p className="text-[12px] text-[var(--text-muted)]">
            {t('settings.account.amountRange', {
              min: minAmount,
              max: maxAmount,
              defaultValue: `Enter an amount between $${minAmount} and $${maxAmount}`
            })}
          </p>

          {error && <p className="text-[12px] text-rose-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border-color)]">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleContinue}
            disabled={!amountValid || loading}
            className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: amountValid
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'var(--bg-input)'
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('settings.account.processing')}
              </span>
            ) : (
              t('settings.account.continue')
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
