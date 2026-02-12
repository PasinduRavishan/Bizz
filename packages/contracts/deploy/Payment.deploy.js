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
export class PaymentHelper {
    constructor(computer, mod) {
        this.computer = computer;
        this.mod = mod;
    }
    async deploy() {
        this.mod = await this.computer.deploy(`export ${Payment}`);
        return this.mod;
    }
    validatePaymentParams(params) {
        if (!params.recipient)
            throw new Error('Recipient required');
        if (params.amount < BigInt(546))
            throw new Error('Amount must be at least 546 satoshis');
        if (!params.purpose)
            throw new Error('Purpose required');
    }
    validateClaim(payment) {
        if (payment.status === 'claimed') {
            throw new Error('Payment already claimed');
        }
    }
    async createPayment(params) {
        this.validatePaymentParams(params);
        const { tx, effect } = await this.computer.encode({
            mod: this.mod,
            exp: `new Payment("${params.recipient}", BigInt(${params.amount}), "${params.purpose}", "${params.reference}")`
        });
        return { tx, effect };
    }
    async claimPayment(payment) {
        this.validateClaim(payment);
        const { tx, effect } = await this.computer.encode({
            exp: `__bc__.claim()`,
            env: { __bc__: payment._rev },
            mod: this.mod
        });
        return { tx, effect };
    }
}
