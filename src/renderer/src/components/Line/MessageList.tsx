import { MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { UnifiedMessageList } from '../Shared'
import { platformColors } from '../Shared/platformColors'

/**
 * Line Message List - Uses unified message list with Line green theme
 */
export function LineMessageList(): JSX.Element {
  const { t } = useTranslation()
  return (
    <UnifiedMessageList
      api={window.line}
      colors={platformColors.line}
      emptyIcon={MessageCircle}
      emptyTitle={t('messages.empty.title', 'No Messages Yet')}
      emptyDescription={t('messages.empty.line', 'Connect your Line bot to start chatting.')}
      platform="line"
    />
  )
}
