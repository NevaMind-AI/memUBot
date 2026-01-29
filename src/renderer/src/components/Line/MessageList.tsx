import { MessageCircle } from 'lucide-react'
import { UnifiedMessageList } from '../Shared'
import { platformColors } from '../Shared/platformColors'

/**
 * Line Message List - Uses unified message list with Line green theme
 */
export function LineMessageList(): JSX.Element {
  return (
    <UnifiedMessageList
      api={window.line}
      colors={platformColors.line}
      emptyIcon={MessageCircle}
      emptyTitle="No Messages Yet"
      emptyDescription="Connect your Line bot to start chatting."
      platform="line"
    />
  )
}
