import { MessageSquare } from 'lucide-react'
import { UnifiedMessageList } from '../Shared'
import { platformColors } from '../Shared/platformColors'

/**
 * WhatsApp Message List - Uses unified message list with WhatsApp green theme
 */
export function WhatsAppMessageList(): JSX.Element {
  return (
    <UnifiedMessageList
      api={window.whatsapp}
      colors={platformColors.whatsapp}
      emptyIcon={MessageSquare}
      emptyTitle="No Messages Yet"
      emptyDescription="Connect to WhatsApp to start chatting."
    />
  )
}
