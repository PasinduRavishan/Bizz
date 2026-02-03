// Deployment-ready Payment contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/Payment.ts instead

/**
 * Payment Smart Contract
 *
 * Represents a payment that can be claimed by a recipient.
 * Created during prize distribution or entry fee collection.
 */
export class Payment extends Contract {
    constructor(recipient, amount, purpose, reference) {
        if (!recipient)
            throw new Error('Recipient required');
        if (amount < BigInt(546))
            throw new Error('Amount must be at least 546 satoshis');
        if (!purpose)
            throw new Error('Purpose required');
        super({
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
