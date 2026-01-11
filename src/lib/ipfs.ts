/**
 * IPFS utilities for Quiz Platform - Production Implementation
 * Uses Pinata for reliable IPFS uploads and multiple gateways for fetching
 */

export interface QuizQuestion {
  question: string
  options: string[]
  // Note: correctAnswer is NOT stored in IPFS (only hashes on blockchain)
}

/**
 * Upload questions to IPFS via Pinata
 *
 * @param questions - Array of questions (without correct answers)
 * @returns Promise resolving to IPFS CID
 */
export async function uploadQuestionsToIPFS(questions: QuizQuestion[]): Promise<string> {
  const PINATA_JWT = process.env.PINATA_JWT
  
  if (!PINATA_JWT) {
    console.warn('⚠️ PINATA_JWT not configured, IPFS upload disabled')
    throw new Error('IPFS upload not configured. Please set PINATA_JWT environment variable.')
  }

  try {
    console.log('📤 Uploading questions to IPFS via Pinata...')
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pinataContent: questions,
        pinataMetadata: {
          name: `quiz-questions-${Date.now()}.json`
        },
        pinataOptions: {
          cidVersion: 1
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Pinata upload failed: ${error}`)
    }

    const data = await response.json()
    console.log('✅ Questions uploaded to IPFS:', data.IpfsHash)
    return data.IpfsHash
  } catch (error) {
    console.error('❌ IPFS upload error:', error)
    throw error
  }
}

/**
 * Fetch questions from IPFS (placeholder implementation)
 *
 * In production, this would fetch from IPFS gateway.
 * For now, questions would need to be stored elsewhere.
 *
 * @param ipfsHash - IPFS CID
 * @returns Promise resolving to questions array
 */
export async function fetchQuestionsFromIPFS(ipfsHash: string): Promise<QuizQuestion[] | null> {
  console.log('Fetching from IPFS:', ipfsHash)

  try {
    // Try multiple IPFS gateways
    const gateways = [
      `https://ipfs.io/ipfs/${ipfsHash}`,
      `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
      `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
    ]

    for (const gateway of gateways) {
      try {
        const response = await fetch(gateway, { 
          method: 'GET',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        })
        
        if (response.ok) {
          const questions = await response.json()
          console.log('✅ Fetched from IPFS gateway:', gateway)
          return questions
        }
      } catch {
        console.log('Failed gateway:', gateway)
        continue
      }
    }

    console.log('⚠️ All IPFS gateways failed')
    return null
  } catch (error) {
    console.error('Error fetching from IPFS:', error)
    return null
  }
}


