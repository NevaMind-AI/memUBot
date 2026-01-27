import { useState, useEffect, useRef } from 'react'
import { Shield, Key, Copy, RefreshCw, Loader2, Check } from 'lucide-react'
import { toast } from '../../stores/toastStore'

interface SecurityCodeInfo {
  active: boolean
  expiresAt?: number
  remainingSeconds?: number
}

export function SecuritySettings(): JSX.Element {
  const [codeInfo, setCodeInfo] = useState<SecurityCodeInfo | null>(null)
  const [currentCode, setCurrentCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Countdown timer
  useEffect(() => {
    if (codeInfo?.active && codeInfo.remainingSeconds && codeInfo.remainingSeconds > 0) {
      timerRef.current = setInterval(() => {
        setCodeInfo((prev) => {
          if (!prev || !prev.remainingSeconds) return prev
          const newSeconds = prev.remainingSeconds - 1
          if (newSeconds <= 0) {
            setCurrentCode(null)
            return { active: false }
          }
          return { ...prev, remainingSeconds: newSeconds }
        })
      }, 1000)

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
      }
    }
  }, [codeInfo?.active])

  const generateCode = async () => {
    setLoading(true)
    try {
      const result = await window.security.generateCode()
      if (result.success && result.data) {
        setCurrentCode(result.data.code)
        setCodeInfo({
          active: true,
          remainingSeconds: 180 // 3 minutes
        })
        toast.success('Security code generated')
      } else {
        toast.error(result.error || 'Failed to generate code')
      }
    } catch (error) {
      toast.error('Failed to generate security code')
    }
    setLoading(false)
  }

  const copyCode = async () => {
    if (!currentCode) return
    try {
      await navigator.clipboard.writeText(currentCode)
      setCopied(true)
      toast.success('Code copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy code')
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Security</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
          Manage device binding and access control
        </p>
      </div>

      <div className="space-y-3">
        {/* Security Code Section */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7DCBF7]/20 to-[#2596D1]/20 flex items-center justify-center">
              <Key className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">Security Code</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Generate a code to bind Telegram accounts
              </p>
            </div>
          </div>

          {/* Code Display */}
          {currentCode && codeInfo?.active ? (
            <div className="mb-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-mono font-bold tracking-widest text-[var(--text-primary)]">
                    {currentCode}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-2 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="text-right">
                  <span className="text-[12px] text-[var(--text-muted)]">Expires in</span>
                  <div className="text-[14px] font-mono font-medium text-amber-500">
                    {formatTime(codeInfo.remainingSeconds || 0)}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-2 text-center">
                Send <code className="px-1 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-secondary)]">/bind {currentCode}</code> to your bot in Telegram
              </p>
            </div>
          ) : (
            <div className="mb-4 p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-center">
              <Shield className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
              <p className="text-[12px] text-[var(--text-muted)]">
                Generate a security code to bind a new Telegram account
              </p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={generateCode}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#7DCBF7] to-[#2596D1] text-white text-[13px] font-medium shadow-lg shadow-[#2596D1]/25 hover:shadow-xl hover:shadow-[#2596D1]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating...</span>
              </>
            ) : currentCode && codeInfo?.active ? (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Generate New Code</span>
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>Generate Security Code</span>
              </>
            )}
          </button>
        </div>

        {/* Security Notes */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            <strong>Note:</strong> Security codes expire after 3 minutes and can only be used once.
            Only bound accounts can interact with your bot.
          </p>
        </div>
      </div>
    </div>
  )
}
