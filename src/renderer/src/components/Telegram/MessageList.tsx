import { MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { UnifiedMessageList } from '../Shared'
import { platformColors } from '../Shared/platformColors'

/**
 * Telegram Message List - Uses unified message list with Telegram blue theme
 */
export function MessageList(): JSX.Element {
  const { t } = useTranslation()
  return (
    <UnifiedMessageList
      api={window.telegram}
      colors={platformColors.telegram}
      emptyIcon={MessageSquare}
      emptyTitle={t('messages.empty.title', 'No Messages Yet')}
      emptyDescription={t('messages.empty.telegram', 'Connect your bot and start chatting on Telegram.')}
      platform="telegram"
    />
  )
}
