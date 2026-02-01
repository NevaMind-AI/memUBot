import { MessageSquare } from 'lucide-react'
import { UnifiedMessageList } from '../Shared'
import { platformColors } from '../Shared/platformColors'

/**
 * Feishu Message List - Uses unified message list with Feishu blue theme
 */
export function MessageList(): JSX.Element {
  return (
    <UnifiedMessageList
      api={window.feishu}
      colors={platformColors.feishu}
      emptyIcon={MessageSquare}
      emptyTitle="No Messages Yet"
      emptyDescription="Connect your bot and start chatting on Feishu."
      platform="feishu"
    />
  )
}
