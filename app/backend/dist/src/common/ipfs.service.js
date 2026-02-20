"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashAnswer = hashAnswer;
exports.hashAnswers = hashAnswers;
exports.generateSalt = generateSalt;
exports.uploadQuestionsToIPFS = uploadQuestionsToIPFS;
exports.fetchQuestionsFromIPFS = fetchQuestionsFromIPFS;
const crypto = __importStar(require("crypto"));
function hashAnswer(quizId, index, answer, salt) {
    const data = `${quizId}${index}${answer}${salt}`;
    return crypto.createHash('sha256').update(data).digest('hex');
}
function hashAnswers(answers, salt, quizId = 'quiz-temp-id') {
    return answers.map((answer, index) => hashAnswer(quizId, index, answer, salt));
}
function generateSalt() {
    return crypto.randomBytes(32).toString('hex');
}
async function uploadQuestionsToIPFS(questions) {
    const PINATA_JWT = process.env.PINATA_JWT;
    if (!PINATA_JWT) {
        console.warn('⚠️ PINATA_JWT not configured, using mock IPFS hash');
        return `QmMock${Date.now().toString(36)}`;
    }
    try {
        console.log('📤 Uploading questions to IPFS via Pinata...');
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
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Pinata upload failed: ${error}`);
        }
        const data = await response.json();
        console.log('✅ Questions uploaded to IPFS:', data.IpfsHash);
        return data.IpfsHash;
    }
    catch (error) {
        console.error('❌ IPFS upload error:', error);
        throw error;
    }
}
async function fetchQuestionsFromIPFS(ipfsHash) {
    console.log('📥 Fetching from IPFS:', ipfsHash);
    if (ipfsHash.startsWith('QmMock')) {
        console.log('⚠️ Mock IPFS hash detected, returning null');
        return null;
    }
    try {
        const gateways = [
            `https://ipfs.io/ipfs/${ipfsHash}`,
            `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
            `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
        ];
        for (const gateway of gateways) {
            try {
                const response = await fetch(gateway, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                });
                if (response.ok) {
                    const questions = await response.json();
                    console.log('✅ Fetched from IPFS gateway:', gateway);
                    return questions;
                }
            }
            catch {
                console.log('⚠️ Failed gateway:', gateway);
                continue;
            }
        }
        console.log('⚠️ All IPFS gateways failed');
        return null;
    }
    catch (error) {
        console.error('❌ Error fetching from IPFS:', error);
        return null;
    }
}
//# sourceMappingURL=ipfs.service.js.map