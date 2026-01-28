import { MessageSquare } from 'lucide-react'
import { UnifiedMessageList } from '../Shared'
import { platformColors } from '../Shared/platformColors'

/**
 * Slack Message List - Uses unified message list with Slack purple theme
 */
export function SlackMessageList(): JSX.Element {
  return (
    <UnifiedMessageList
      api={window.slack}
      colors={platformColors.slack}
      emptyIcon={MessageSquare}
      emptyTitle="No messages yet"
      emptyDescription="Message the bot in Slack to start chatting"
    />
  )
}
