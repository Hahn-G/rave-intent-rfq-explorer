import { getAddress } from 'viem';

export type Token = { symbol: string; address: `0x${string}`; decimals: number };
export type Chain = { id: number; name: string; slug: string; tokens: Token[] };
const token = (symbol: string, address: string, decimals: number): Token => ({
  symbol,
  address: getAddress(address),
  decimals,
});
export const CHAINS: Chain[] = [
  {
    id: 1,
    name: 'Ethereum',
    slug: 'ethereum',
    tokens: [
      token('WETH', '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', 18),
      token('USDC', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 6),
      token('USDT', '0xdac17f958d2ee523a2206206994597c13d831ec7', 6),
    ],
  },
  {
    id: 8453,
    name: 'Base',
    slug: 'base',
    tokens: [
      token('WETH', '0x4200000000000000000000000000000000000006', 18),
      token('USDC', '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 6),
    ],
  },
];
// Public example from Bebop's documentation. No wallet connection is required.
export const EXAMPLE_ADDRESS = '0x5Bad996643a924De21b6b2875c85C33F3c5bBcB6';
