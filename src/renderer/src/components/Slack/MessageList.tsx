import { MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { UnifiedMessageList } from '../Shared'
import { platformColors } from '../Shared/platformColors'

/**
 * Slack Message List - Uses unified message list with Slack purple theme
 */
export function SlackMessageList(): JSX.Element {
  const { t } = useTranslation()
  return (
    <UnifiedMessageList
      api={window.slack}
      colors={platformColors.slack}
      emptyIcon={MessageSquare}
      emptyTitle={t('messages.empty.title', 'No Messages Yet')}
      emptyDescription={t('messages.empty.slack', 'Message the bot in Slack to start chatting.')}
      platform="slack"
    />
  )
}
