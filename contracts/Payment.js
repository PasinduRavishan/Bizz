// import { Contract } from '@bitcoin-computer/lib'

// /**
//  * Payment Smart Contract
//  * 
//  * Represents a payment that can be claimed by a recipient.
//  * Created during prize distribution or entry fee collection.
//  */
// class Payment extends Contract {
//   /**
//    * Constructor - Creates a payment for a recipient
//    * 
//    * @param {string} recipient - Recipient's public key/address
//    * @param {bigint} amount - Amount in satoshis
//    * @param {string} purpose - Purpose of payment (e.g., "Quiz Prize", "Entry Fee")
//    * @param {string} reference - Reference to source (quizId, attemptId, etc.)
//    */
//   constructor(recipient, amount, purpose, reference) {
//     if (!recipient) throw new Error('Recipient required')
//     if (amount < 546n) throw new Error('Amount must be at least 546 satoshis (dust limit)')
//     if (!purpose) throw new Error('Purpose required')

//     super({
//       _owners: [recipient],      // Recipient owns this payment
//       _satoshis: amount,         // Lock payment amount in contract
      
//       recipient,
//       amount,
//       purpose,
//       reference,
//       status: 'unclaimed',       // unclaimed | claimed
//       createdAt: Date.now(),
//       claimedAt: null
//     })
//   }

//   /**
//    * Claim payment - reduces satoshis to dust and marks as claimed
//    * Can only be called by recipient
//    * 
//    * @returns {Payment} Returns this for chaining
//    */
//   claim() {
//     if (this.status === 'claimed') {
//       throw new Error('Payment already claimed')
//     }

//     // Reduce to dust limit (546 sats) to release funds to wallet
//     this._satoshis = 546n
//     this.status = 'claimed'
//     this.claimedAt = Date.now()

//     return this
//   }

//   /**
//    * Get payment info
//    * @returns {Object} Payment information
//    */
//   getInfo() {
//     return {
//       paymentId: this._id,
//       recipient: this.recipient,
//       amount: this.amount,
//       purpose: this.purpose,
//       reference: this.reference,
//       status: this.status,
//       createdAt: this.createdAt,
//       claimedAt: this.claimedAt,
//       canClaim: this.status === 'unclaimed'
//     }
//   }
// }

// export default Payment
