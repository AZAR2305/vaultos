/**
 * Verify wallet address from private key
 */

import { privateKeyToAccount } from 'viem/accounts';

const pk = '0x251c2ccc0f55d5837809c93c9e775c8a7cd315a517fabbd52c794902a8a8bc36' as `0x${string}`;
const account = privateKeyToAccount(pk);

console.log('Private key:', pk);
console.log('Address:', account.address);
console.log('');
console.log('Expected:', '0x2B5c206516c34896D41DB511BAB9E878F8C1C109');
console.log('Match:', account.address.toLowerCase() === '0x2B5c206516c34896D41DB511BAB9E878F8C1C109'.toLowerCase());
