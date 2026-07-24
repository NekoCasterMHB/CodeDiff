/**
 * Type definitions for CodeDiff application
 */

export interface DiffFile {
  id: string
  fileId: string
  leftPath: string
  rightPath: string
  leftContent: string
  rightContent: string
  language: string
  /** Monaco diff hunk count — persisted with file data */
  hunkCount?: number
}

export interface SharePayload {
  encryptedData: string
  iv: string
  salt: string
  fileCount: number
}

export interface ShareResponse {
  id: string
  url: string
}

export interface DiffRecord {
  id: string
  encryptedData: string
  iv: string
  salt: string
  fileCount: number
  createdAt: string
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'modified'
  lineNumberLeft?: number
  lineNumberRight?: number
  leftContent: string
  rightContent: string
}
