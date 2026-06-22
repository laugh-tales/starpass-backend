import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

const MAX_RETRIES = 3;
const CIRCUIT_BREAK_THRESHOLD = 5;
const BASE_DELAY_MS = 300;

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private server: StellarSdk.rpc.Server;
  private contractId: string;
  private consecutiveFailures = 0;
  private circuitOpen = false;

  constructor(private config: ConfigService) {
    const rpcUrl = this.config.get('STELLAR_RPC_URL') || 'https://soroban-testnet.stellar.org';
    this.server = new StellarSdk.rpc.Server(rpcUrl);
    this.contractId = this.config.get('STARPASS_CONTRACT_ID') || '';
  }

  private async withRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
    if (this.circuitOpen) {
      throw new ServiceUnavailableException(`Stellar RPC circuit open — too many consecutive failures`);
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await operation();
        this.consecutiveFailures = 0;
        this.circuitOpen = false;
        return result;
      } catch (err) {
        lastError = err;
        this.consecutiveFailures += 1;
        this.logger.warn(`${label}: attempt ${attempt}/${MAX_RETRIES} failed — ${(err as Error).message}`);

        if (this.consecutiveFailures >= CIRCUIT_BREAK_THRESHOLD) {
          this.circuitOpen = true;
          this.logger.error(`${label}: circuit breaker opened after ${this.consecutiveFailures} consecutive failures`);
          throw new ServiceUnavailableException('Stellar RPC circuit breaker open');
        }

        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** (attempt - 1)));
        }
      }
    }
    throw lastError;
  }

  async checkRpcHealth(): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.server.getLatestLedger();
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { healthy: false, error: (err as Error).message };
    }
  }

  async hasValidPassOnChain(fanAddress: string, tierId: number): Promise<boolean> {
    try {
      return await this.withRetry(async () => {
        const contract = new StellarSdk.Contract(this.contractId);
        const result = await this.server.simulateTransaction(
          new StellarSdk.TransactionBuilder(
            await this.server.getAccount(fanAddress),
            { fee: '100', networkPassphrase: StellarSdk.Networks.TESTNET },
          )
            .addOperation(
              contract.call(
                'has_valid_pass',
                StellarSdk.nativeToScVal(fanAddress, { type: 'address' }),
                StellarSdk.nativeToScVal(tierId, { type: 'u32' }),
              ),
            )
            .setTimeout(30)
            .build(),
        );

        if ('error' in result) return false;
        return StellarSdk.scValToNative(result.result?.retval) as boolean;
      }, 'hasValidPassOnChain');
    } catch (error) {
      this.logger.error(`Error checking pass on-chain: ${(error as Error).message}`);
      return false;
    }
  }

  async getContractEvents(startLedger: number) {
    try {
      return await this.withRetry(async () => {
        const response = await this.server.getEvents({
          startLedger,
          filters: [{ type: 'contract', contractIds: [this.contractId] }],
          limit: 100,
        });
        return response.events || [];
      }, 'getContractEvents');
    } catch (error) {
      this.logger.error(`Error fetching events: ${(error as Error).message}`);
      return [];
    }
  }

  async getLatestLedger(): Promise<number> {
    const response = await this.withRetry(
      () => this.server.getLatestLedger(),
      'getLatestLedger',
    );
    return response.sequence;
  }
}
