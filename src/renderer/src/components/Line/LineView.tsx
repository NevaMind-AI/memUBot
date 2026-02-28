import { LineMessageList } from './MessageList'

/**
 * Line View - Main view for Line chat
 */
export function LineView(): JSX.Element {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#00B900]/5 to-transparent">
      <LineMessageList />
    </div>
  )
}
