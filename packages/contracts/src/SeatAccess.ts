
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib'

// Type for SeatToken contract
interface SeatToken extends Contract {
  _owners: string[]
  _satoshis: bigint
  amount: bigint
  symbol: string
  quizRef: string
  transfer(recipient: string, amount: bigint): SeatToken
}

// Type for Payment contract
interface Payment extends Contract {
  _owners: string[]
  _satoshis: bigint
  recipient: string
  amount: bigint
  purpose: string
  reference: string
  status: string
  transfer(to: string): void
}


export class SeatAccess extends Contract {

  static exec(
    seatToken: SeatToken,
    entryFeePayment: Payment
  ): [Payment, SeatToken] {
    const [teacher] = seatToken._owners
    const [student] = entryFeePayment._owners

    // Validation: Check seat token has available balance
    if (seatToken.amount < 1n) {
      throw new Error('No available seats')
    }

    // Validation: Check payment is addressed to teacher
    if (entryFeePayment.recipient !== teacher) {
      throw new Error('Entry fee must be paid to teacher')
    }

    // Validation: Check payment purpose
    if (entryFeePayment.purpose !== 'Entry Fee') {
      throw new Error('Payment must be for entry fee')
    }

    // Atomic execution (following Sale.exec pattern):
    // 1. Transfer entry fee payment to teacher
    entryFeePayment.transfer(teacher)

    // 2. Split seat token using TBC20 pattern
    // This is the CRITICAL part - seatToken.transfer() returns NEW UTXO
    // and modifies the original seatToken's amount
    const studentSeat = seatToken.transfer(student, 1n)


    return [entryFeePayment, studentSeat]
  }
}
