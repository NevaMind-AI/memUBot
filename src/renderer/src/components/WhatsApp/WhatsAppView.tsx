import { WhatsAppMessageList } from './MessageList'

/**
 * WhatsApp View - Main view for WhatsApp chat
 */
export function WhatsAppView(): JSX.Element {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#25D366]/5 to-transparent">
      <WhatsAppMessageList />
    </div>
  )
}
