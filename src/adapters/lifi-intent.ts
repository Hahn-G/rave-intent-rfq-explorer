import { z } from 'zod';
import { getAddress, isAddress, maxUint256, parseUnits } from 'viem';
import { CHAINS, type Chain, type Token } from '@/config/chains';
import { QuoteError } from '@/lib/errors';

const address = z
  .string()
  .refine((v) => isAddress(v) && !/^0x0{40}$/i.test(v), 'Use a valid, nonzero EVM address.');
export const intentSchema = z
  .object({
    fromChain: z.number().int().positive(),
    toChain: z.number().int().positive(),
    fromToken: z.string().min(1).max(42),
    toToken: z.string().min(1).max(42),
    amountIn: z
      .string()
      .max(100)
      .regex(
        /^(0|[1-9]\d*)(\.\d+)?$/,
        'Amount must be a positive decimal string, without exponent notation.',
      ),
    userAddress: address,
    receiverAddress: address,
  })
  .strict();
export type SimplifiedIntent = z.infer<typeof intentSchema>;
export type QuoteRequest = {
  chain: Chain;
  sellToken: Token;
  buyToken: Token;
  sellAmount: string;
  taker: `0x${string}`;
  receiver: `0x${string}`;
};

export class LiFiIntentAdapter {
  normalize(input: unknown): QuoteRequest {
    const result = intentSchema.safeParse(input);
    if (!result.success)
      throw new QuoteError(
        'INVALID_INPUT',
        result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' '),
      );
    const i = result.data;
    const chain = CHAINS.find((c) => c.id === i.fromChain);
    if (!chain || i.fromChain !== i.toChain)
      throw new QuoteError(
        'UNSUPPORTED_ROUTE',
        'Only same-chain swaps on Ethereum (1) and Base (8453) are supported.',
        422,
      );
    const resolve = (value: string) =>
      chain.tokens.find(
        (t) =>
          t.symbol.toLowerCase() === value.toLowerCase() ||
          t.address.toLowerCase() === value.toLowerCase(),
      );
    const sellToken = resolve(i.fromToken),
      buyToken = resolve(i.toToken);
    if (!sellToken || !buyToken || sellToken.address === buyToken.address)
      throw new QuoteError(
        'UNSUPPORTED_ROUTE',
        'Choose two different tokens from the supported chain token list.',
        422,
      );
    if ((i.amountIn.split('.')[1]?.length ?? 0) > sellToken.decimals)
      throw new QuoteError(
        'INVALID_INPUT',
        `${sellToken.symbol} supports at most ${sellToken.decimals} decimal places; amounts are never rounded.`,
      );
    const amount = parseUnits(i.amountIn, sellToken.decimals);
    if (amount <= 0n || amount > maxUint256)
      throw new QuoteError('INVALID_INPUT', 'Amount must be greater than zero and fit in uint256.');
    return {
      chain,
      sellToken,
      buyToken,
      sellAmount: amount.toString(),
      taker: getAddress(i.userAddress),
      receiver: getAddress(i.receiverAddress),
    };
  }
}
