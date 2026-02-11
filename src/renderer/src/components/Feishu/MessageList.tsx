import { MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { UnifiedMessageList } from '../Shared'
import { platformColors } from '../Shared/platformColors'

/**
 * Feishu Message List - Uses unified message list with Feishu blue theme
 */
export function MessageList(): JSX.Element {
  const { t } = useTranslation()
  return (
    <UnifiedMessageList
      api={window.feishu}
      colors={platformColors.feishu}
      emptyIcon={MessageSquare}
      emptyTitle={t('messages.empty.title', 'No Messages Yet')}
      emptyDescription={t('messages.empty.feishu', 'Connect your bot and start chatting on Feishu.')}
      platform="feishu"
    />
  )
}
