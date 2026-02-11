import { User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { UnifiedMessageList } from '../Shared'
import { platformColors } from '../Shared/platformColors'

/**
 * Discord Message List - Uses unified message list with Discord purple theme
 */
export function DiscordMessageList(): JSX.Element {
  const { t } = useTranslation()
  return (
    <UnifiedMessageList
      api={window.discord}
      colors={platformColors.discord}
      emptyIcon={User}
      emptyTitle={t('messages.empty.title', 'No Messages Yet')}
      emptyDescription={t('messages.empty.discord', '@mention the bot in your Discord server to start chatting.')}
      platform="discord"
    />
  )
}
