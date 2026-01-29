import { User } from 'lucide-react'
import { UnifiedMessageList } from '../Shared'
import { platformColors } from '../Shared/platformColors'

/**
 * Discord Message List - Uses unified message list with Discord purple theme
 */
export function DiscordMessageList(): JSX.Element {
  return (
    <UnifiedMessageList
      api={window.discord}
      colors={platformColors.discord}
      emptyIcon={User}
      emptyTitle="No messages yet"
      emptyDescription="@mention the bot in your Discord server to start chatting"
      platform="discord"
    />
  )
}
