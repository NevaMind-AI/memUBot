import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useToastStore, type Toast as ToastType } from '../../stores/toastStore'

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
}

const styleMap = {
  success: {
    icon: 'text-emerald-500',
    text: 'text-emerald-700'
  },
  error: {
    icon: 'text-red-500',
    text: 'text-red-700'
  },
  warning: {
    icon: 'text-amber-500',
    text: 'text-amber-700'
  },
  info: {
    icon: 'text-[#2596D1]',
    text: 'text-[#2596D1]'
  }
}

function ToastItem({ toast }: { toast: ToastType }): JSX.Element {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const removeToast = useToastStore((state) => state.removeToast)

  const Icon = iconMap[toast.type]
  const style = styleMap[toast.type]

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true))

    // Auto leave animation before removal
    if (toast.duration && toast.duration > 0) {
      const leaveTimer = setTimeout(() => {
        setIsLeaving(true)
      }, toast.duration - 200)

      return () => clearTimeout(leaveTimer)
    }
  }, [toast.duration])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(() => removeToast(toast.id), 200)
  }

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl bg-white backdrop-blur-xl border border-slate-200/50 shadow-lg shadow-slate-200/50 transition-all duration-200 ${
        isVisible && !isLeaving ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
      }`}
    >
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${style.icon}`} />
      <p className={`text-[13px] leading-relaxed flex-1 text-slate-700`}>{toast.message}</p>
      <button
        onClick={handleClose}
        className="p-0.5 rounded hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function ToastContainer(): JSX.Element {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div className="fixed top-[72px] right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
