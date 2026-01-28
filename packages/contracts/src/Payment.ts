// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib'

export class Payment extends Contract {
  // Contract base properties
  _id!: string
  _rev!: string
  _owners!: string[]
  _satoshis!: bigint

  // Payment properties
  recipient!: string
  amount!: bigint
  claimed!: boolean

  constructor(recipient: string, amount: bigint) {
    super({
      recipient,
      amount,
      claimed: false,
      _owners: [recipient],
      _satoshis: amount
    })
  }

  cashOut(): void {
    if (this.claimed) {
      throw new Error('Already claimed')
    }
    if (this._owners[0] !== this.recipient) {
      throw new Error('Only recipient can cash out')
    }

    this.claimed = true
    // Transfer remaining funds to recipient
    this._owners = [this.recipient]
  }
}
