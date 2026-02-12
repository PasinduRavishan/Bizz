/**
 * Generate unique wallet derivation path for a user
 * Each user gets a deterministic but unique wallet based on their user ID
 */

import crypto from 'crypto'

export function getUserWalletPath(userId: string, role: 'TEACHER' | 'STUDENT'): string {
  // Generate deterministic account index from user ID
  const userIdHash = crypto.createHash('sha256').update(userId).digest('hex')
  const accountIndex = parseInt(userIdHash.substring(0, 8), 16) % 1000000

  // BIP44 path: m/purpose'/coin_type'/account'/change/address_index
  // purpose: 44 (BIP44)
  // coin_type: 1 (Testnet for all coins)
  // account: role-based (0 for teachers, 1 for students)
  // change: 0 (external chain)
  // address_index: derived from user ID

  const accountType = role === 'TEACHER' ? 0 : 1
  return `m/44'/1'/${accountType}'/0/${accountIndex}`
}
