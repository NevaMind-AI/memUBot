import { MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { UnifiedMessageList } from '../Shared'
import { platformColors } from '../Shared/platformColors'

/**
 * WhatsApp Message List - Uses unified message list with WhatsApp green theme
 */
export function WhatsAppMessageList(): JSX.Element {
  const { t } = useTranslation()
  return (
    <UnifiedMessageList
      api={window.whatsapp}
      colors={platformColors.whatsapp}
      emptyIcon={MessageSquare}
      emptyTitle={t('messages.empty.title', 'No Messages Yet')}
      emptyDescription={t('messages.empty.whatsapp', 'Connect to WhatsApp to start chatting.')}
      platform="whatsapp"
    />
  )
}
