/**
 * IM API Endpoints
 *
 * Wraps the backend IM API (which proxies Easemob REST API).
 * Supports: upload file, send text/image/file messages.
 */

import { Blob } from 'buffer'
import type { MemuApiClient } from '../client'
import { getAuthService } from '../../auth'

// ============================================
// Types
// ============================================

export interface IMUploadResponse {
  uuid: string
  url: string
  secret: string
}

/**
 * Message params follow the Easemob REST API format:
 * { from, to, type, body: { ... } }
 */

interface IMMessageBase {
  from: string    // sender user ID
  to: string[]    // receiver user ID(s)
}

export interface IMSendTextParams extends IMMessageBase {
  type: 'txt'
  body: {
    msg: string
  },
  sync_device: boolean
}

export interface IMSendImageParams extends IMMessageBase {
  type: 'img'
  body: {
    filename: string
    secret: string
    url: string
    size?: {
      width: number
      height: number
    }
  }
  sync_device: boolean
}

export interface IMSendFileParams extends IMMessageBase {
  type: 'file'
  body: {
    filename: string
    secret: string
    url: string
  }
  sync_device: boolean
}

export type IMSendMessageParams = IMSendTextParams | IMSendImageParams | IMSendFileParams

export interface IMSendMessageResponse {
  message_id: string
}

// ============================================
// Endpoints
// ============================================

const ENDPOINTS = {
  UPLOAD: '/api/v3/yumi/upload-file',
  SEND_MESSAGE: '/api/v3/yumi/send-message'
} as const

// ============================================
// IM API Functions
// ============================================

/**
 * Upload a file to the IM backend
 * @param client The API client instance
 * @param accessToken Firebase access token
 * @param fileBuffer File content as a byte array
 * @param filename Original filename
 * @param mimeType MIME type of the file
 * @returns Upload result with uuid, url, and secret
 */
export async function uploadFile(
  client: MemuApiClient,
  accessToken: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<IMUploadResponse> {
  console.log('[MemuAPI:IM] Uploading file...', { filename, size: fileBuffer.length, mimeType })

  const formData = new FormData()
  const blob = new Blob([fileBuffer], { type: mimeType || 'application/octet-stream' })
  formData.append('file', blob as unknown as globalThis.Blob, filename)

  const response = await client.upload<IMUploadResponse>(ENDPOINTS.UPLOAD, formData, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    requiresCsrf: true
  })

  if (!response.data) {
    throw new Error('No data in upload response')
  }

  console.log('[MemuAPI:IM] File uploaded:', {
    uuid: response.data.uuid,
    url: response.data.url?.substring(0, 60) + '...'
  })

  return response.data
}

/**
 * Send a message via the IM backend
 * @param client The API client instance
 * @param accessToken Firebase access token
 * @param params Message parameters (text, image, or file)
 * @returns Send result with message_id
 */
export async function sendMessage(
  client: MemuApiClient,
  accessToken: string,
  params: IMSendMessageParams
): Promise<IMSendMessageResponse> {
  console.log('[MemuAPI:IM] Sending message...', { type: params.type })

  const response = await client.request<IMSendMessageResponse>(ENDPOINTS.SEND_MESSAGE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: params,
    requiresCsrf: true
  })

  if (!response.data) {
    throw new Error('No data in send message response')
  }

  console.log('[MemuAPI:IM] Message sent:', { messageId: response.data.message_id })

  return response.data
}
