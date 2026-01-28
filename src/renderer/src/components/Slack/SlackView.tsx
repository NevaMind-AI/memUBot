import { SlackMessageList } from './MessageList'

/**
 * Slack View - Main view for Slack chat
 */
export function SlackView(): JSX.Element {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#4A154B]/5 to-transparent">
      <SlackMessageList />
    </div>
  )
}
