import { MessageSquare } from 'lucide-react'
import { UnifiedMessageList } from '../Shared'
import { platformColors } from '../Shared/platformColors'

/**
 * Telegram Message List - Uses unified message list with Telegram blue theme
 */
export function MessageList(): JSX.Element {
  return (
    <UnifiedMessageList
      api={window.telegram}
      colors={platformColors.telegram}
      emptyIcon={MessageSquare}
      emptyTitle="No Messages Yet"
      emptyDescription="Connect your bot and start chatting on Telegram."
    />
  )
}
