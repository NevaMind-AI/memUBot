import { Send, Settings } from 'lucide-react'

type NavItem = 'telegram' | 'settings'

interface SidebarProps {
  activeNav: NavItem
  onNavChange: (nav: NavItem) => void
}

export function Sidebar({ activeNav, onNavChange }: SidebarProps): JSX.Element {
  const navItems = [
    { id: 'telegram' as const, icon: Send, label: 'Telegram' },
    { id: 'settings' as const, icon: Settings, label: 'Settings' }
  ]

  return (
    <aside className="w-16 flex flex-col bg-white/60 backdrop-blur-xl border-r border-white/80">
      {/* Logo - Same height as header */}
      <div className="h-14 flex items-center justify-center border-b border-slate-200/50">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7DCBF7] to-[#2596D1] flex items-center justify-center shadow-lg shadow-[#2596D1]/20">
          <span className="text-white text-sm font-bold">M</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center pt-4 gap-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeNav === item.id

          return (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              title={item.label}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-br from-[#7DCBF7] to-[#2596D1] text-white shadow-lg shadow-[#2596D1]/25'
                  : 'bg-white/50 text-slate-500 hover:text-[#2596D1] hover:bg-white/80 hover:shadow-md'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
