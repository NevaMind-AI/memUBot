import { YumiHeader } from './YumiHeader'
import { YumiMessageInput } from './YumiMessageInput'
import { YumiMessageList } from './YumiMessageList'
import './YumiView.css'

interface YumiViewProps {
  onShowActivity?: () => void
}

export function YumiView({ onShowActivity }: YumiViewProps): JSX.Element {
  return (
    <div className="flex-1 flex flex-col">
      {/* Yumi has its own header */}
      <YumiHeader onShowActivity={onShowActivity} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex bg-[var(--bg-secondary)] overflow-hidden">
        <YumiMessageList />
      </div>

      {/* Message Input */}
      <YumiMessageInput />
    </div>
  )
}
