/**
 * YumiMessageInput - Chat input for sending user messages via backend IM API
 *
 * Features:
 * - Text input with Enter to send (Shift+Enter for newline)
 * - Attachment button that opens file picker and sends immediately on selection
 * - Supports text, image, and file messages
 * - Auto-resizing textarea
 */

import { Paperclip, ArrowUp, Loader2 } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'

// ============================================
// Constants
// ============================================

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml'
])

const MIN_TEXTAREA_HEIGHT = 40
const MAX_TEXTAREA_HEIGHT = 120

// ============================================
// Helpers
// ============================================

function isImageFile(file: File): boolean {
  return IMAGE_MIME_TYPES.has(file.type)
}

async function fileToBuffer(file: File): Promise<number[]> {
  const arrayBuffer = await file.arrayBuffer()
  return Array.from(new Uint8Array(arrayBuffer))
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

// ============================================
// Component
// ============================================

export function YumiMessageInput(): JSX.Element {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-resize textarea: runs on every `text` change, before browser paint
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    // Reset to auto so scrollHeight reflects the actual content height
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(MIN_TEXTAREA_HEIGHT, Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT))}px`
  }, [text])

  // Send text message
  const handleSendText = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setSending(true)
    try {
      const result = await window.yumi.sendUserMessage({
        type: 'txt',
        content: trimmed
      })
      if (result.success) {
        setText('')
      } else {
        console.error('[YumiInput] Failed to send text:', result.error)
      }
    } catch (error) {
      console.error('[YumiInput] Error sending text:', error)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }, [text, sending])

  // Send file/image message
  const handleSendFile = useCallback(async (file: File) => {
    if (sending) return

    setSending(true)
    try {
      const buffer = await fileToBuffer(file)
      const isImage = isImageFile(file)

      let width: number | undefined
      let height: number | undefined
      if (isImage) {
        try {
          const dims = await getImageDimensions(file)
          width = dims.width
          height = dims.height
        } catch {
          // Ignore dimension errors, send without dimensions
        }
      }

      const result = await window.yumi.sendUserMessage({
        type: isImage ? 'img' : 'file',
        buffer,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        width,
        height,
        fileSize: file.size
      })

      if (!result.success) {
        console.error('[YumiInput] Failed to send file:', result.error)
      }
    } catch (error) {
      console.error('[YumiInput] Error sending file:', error)
    } finally {
      setSending(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      textareaRef.current?.focus()
    }
  }, [sending])

  // Handle file selection
  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleSendFile(file)
      }
    },
    [handleSendFile]
  )

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSendText()
      }
    },
    [handleSendText]
  )

  // Handle text change
  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value)
    },
    []
  )

  // Open file picker
  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const canSend = text.trim().length > 0 && !sending

  return (
    <div className="px-4 py-3 border-t border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        {/* Attachment button */}
        <button
          type="button"
          onClick={handleAttachClick}
          disabled={sending}
          className="flex-shrink-0 w-8 h-8 mb-1 flex items-center justify-center rounded-lg
            text-[var(--text-muted)] hover:text-[var(--text-secondary)]
            hover:bg-[var(--bg-input)] transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="*/*"
        />

        {/* Text input */}
        <div className="flex-1 flex align-bottom">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={sending}
            placeholder={t('messages.typeMessage', 'Type a message...')}
            rows={1}
            className="w-full min-h-10 resize-none rounded-xl px-3.5 py-2 text-[13px]
              bg-[var(--bg-input)] border border-[var(--glass-border)]
              text-[var(--text-primary)] placeholder-[var(--text-muted)]
              focus:outline-none focus:border-[#E8A090]/50 focus:ring-1 focus:ring-[#E8A090]/25
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors leading-[1.4]"
            style={{ maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
          />
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={handleSendText}
          disabled={!canSend}
          className={`flex-shrink-0 w-8 h-8 mb-1 flex items-center justify-center rounded-full
            transition-all duration-200 ease-out
            ${canSend
              ? 'bg-[#E8A090] text-white shadow-sm hover:bg-[#D4887A] hover:shadow-md active:scale-90'
              : 'bg-transparent text-[var(--text-muted)] opacity-30 cursor-not-allowed'
            }`}
          title="Send message"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
          )}
        </button>
      </div>
    </div>
  )
}
