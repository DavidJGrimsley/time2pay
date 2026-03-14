import { findBestCheckingAccount } from '../utils';
import type { MercuryTransport } from '../client';
import type { MercuryAccount, MercuryStatement, MercuryTransaction } from '../types';

export function createAccountsResource(transport: MercuryTransport) {
  return {
    list(query?: Record<string, string | number | boolean | null | undefined>) {
      return transport.requestCollection<MercuryAccount>('/accounts', ['accounts'], { query });
    },
    get(accountId: string) {
      return transport.requestJson<MercuryAccount>(`/account/${encodeURIComponent(accountId)}`);
    },
    listTransactions(accountId: string, query?: Record<string, string | number | boolean | null | undefined>) {
      return transport.requestCollection<MercuryTransaction>(
        `/account/${encodeURIComponent(accountId)}/transactions`,
        ['transactions'],
        { query },
      );
    },
    listStatements(accountId: string, query?: Record<string, string | number | boolean | null | undefined>) {
      return transport.requestCollection<MercuryStatement>(
        `/account/${encodeURIComponent(accountId)}/statements`,
        ['statements'],
        { query },
      );
    },
    downloadStatementPdf(accountId: string, statementId: string) {
      return transport.requestArrayBuffer(
        `/account/${encodeURIComponent(accountId)}/statement/${encodeURIComponent(statementId)}`,
      );
    },
    async findBestCheckingAccount(query?: Record<string, string | number | boolean | null | undefined>) {
      const result = await transport.requestCollection<MercuryAccount>('/accounts', ['accounts'], { query });
      return findBestCheckingAccount(result.items);
    },
  };
}
