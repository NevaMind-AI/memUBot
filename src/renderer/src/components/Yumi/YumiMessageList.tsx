/**
 * Yumi Message List - Uses UnifiedMessageList with window.yumi API
 *
 * Follows the same pattern as other platforms:
 * - Telegram: api={window.telegram}
 * - Discord:  api={window.discord}
 * - Yumi:     api={window.yumi}
 *
 * The window.yumi API is exposed via preload IPC (same as other platforms).
 * Messages are persisted in main process and broadcast via IPC events.
 */

import { MessageSquare } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import yumiSleepVideo from '../../assets/yumi-sleep.webm'
import { UnifiedMessageList } from '../Shared/UnifiedMessageList'
import { platformColors } from '../Shared/platformColors'
import './YumiView.css'

const yumiColors = platformColors.yumi

/**
 * Custom empty state for Yumi with three modes:
 * - Connecting: spinner
 * - Connected, no messages: Yumi sleep animation
 * - Not connected: prompt to login
 */
function YumiEmptyState(): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center">
        <div
          className="absolute w-[280px] h-[280px] rounded-full cloud-outer"
          style={{ filter: 'blur(8px)', transform: 'scale(1.2)' }}
        />
        <div
          className="absolute w-[220px] h-[200px] rounded-full cloud-inner"
          style={{ filter: 'blur(4px)' }}
        />
        <video
          className="relative z-10 w-48 h-48 object-contain yumi-video"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src={yumiSleepVideo} type="video/webm" />
        </video>
      </div>
      <p className="mt-4 text-[13px] text-[var(--text-muted)]">
        {t('yumi.noMessages', 'No messages yet')}
      </p>
    </div>
  )
}

export function YumiMessageList(): JSX.Element {
  const { t } = useTranslation()
  const renderEmpty = useCallback(() => <YumiEmptyState />, [])

  return (
    <UnifiedMessageList
      api={window.yumi}
      colors={yumiColors}
      emptyIcon={MessageSquare}
      emptyTitle={t('messages.empty.title', 'No Messages Yet')}
      emptyDescription={t('messages.empty.yumi', 'Waiting for conversation to start.')}
      renderEmpty={renderEmpty}
    />
  )
}
