// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib';
/**
 * Payment Smart Contract
 *
 * Represents a payment that can be claimed by a recipient.
 * Created during prize distribution or entry fee collection.
 */
export class Payment extends Contract {
    // Contract base properties
    _id;
    _rev;
    _owners;
    _satoshis;
    // Payment properties
    recipient;
    amount;
    purpose;
    reference;
    status;
    createdAt;
    claimedAt;
    constructor(recipient, amount, purpose, reference) {
        if (!recipient)
            throw new Error('Recipient required');
        if (amount < BigInt(546))
            throw new Error('Amount must be at least 546 satoshis');
        if (!purpose)
            throw new Error('Purpose required');
        super({
            // DON'T set _owners here - Let Bitcoin Computer set it to the creator
            // This allows atomic swaps where creator != recipient
            _satoshis: amount,
            recipient,
            amount,
            purpose,
            reference,
            status: 'unclaimed',
            createdAt: Date.now(),
            claimedAt: null
        });
    }
    transfer(to) {
        this._owners = [to];
    }
    claim() {
        if (this.status === 'claimed') {
            throw new Error('Payment already claimed');
        }
        this._satoshis = BigInt(546);
        this.status = 'claimed';
        this.claimedAt = Date.now();
    }
    getInfo() {
        return {
            paymentId: this._id,
            recipient: this.recipient,
            amount: this.amount,
            purpose: this.purpose,
            reference: this.reference,
            status: this.status,
            createdAt: this.createdAt,
            claimedAt: this.claimedAt,
            canClaim: this.status === 'unclaimed'
        };
    }
}
//# sourceMappingURL=Payment.js.map