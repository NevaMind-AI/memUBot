import { YumiHeader } from './YumiHeader'

export function YumiView(): JSX.Element {
  return (
    <div className="flex-1 flex flex-col">
      {/* Yumi has its own header */}
      <YumiHeader />
      
      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-secondary)]">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#F4A89A] to-[#FBCEB1] flex items-center justify-center shadow-lg shadow-[#F4A89A]/25">
            <span className="text-3xl font-bold text-white">Y</span>
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            Yumi
          </h2>
        </div>
      </div>
    </div>
  )
}
