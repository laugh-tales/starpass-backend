import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class TiersService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Get all active tiers for a creator
   * 
   * @param stellarAddress The Stellar public key of the creator.
   * @returns A list of active tiers for the given creator.
   * @throws {NotFoundException} If the creator is not found.
   */
  async findByCreator(stellarAddress: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress },
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    return this.prisma.tier.findMany({
      where: { creatorId: creator.id, active: true },
      orderBy: { onChainId: 'asc' },
    });
  }

  /**
   * Get a single tier by on-chain ID and creator address
   * 
   * @param stellarAddress The Stellar public key of the creator.
   * @param onChainId The on-chain ID of the tier.
   * @returns The tier record.
   * @throws {NotFoundException} If either the creator or the tier is not found.
   */
  async findOne(stellarAddress: string, onChainId: number) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress },
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const tier = await this.prisma.tier.findUnique({
      where: { creatorId_onChainId: { creatorId: creator.id, onChainId } },
    });

    if (!tier) {
      throw new NotFoundException('Tier not found');
    }

    return tier;
  }

  private contentUrlSecret() {
    return this.configService.get<string>('CONTENT_URL_SECRET') ?? 'default-content-secret';
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.contentUrlSecret()).update(payload).digest('hex');
  }

  async unlockContent(tierId: string, fanAddress: string) {
    const tier = await this.prisma.tier.findUnique({ where: { id: tierId } });
    if (!tier || !tier.active) throw new NotFoundException('Tier not found');

    const fan = await this.prisma.fan.findUnique({ where: { stellarAddress: fanAddress } });
    if (!fan) throw new ForbiddenException('Fan not found');

    const now = new Date();
    const valid = await this.prisma.pass.findFirst({
      where: { fanId: fan.id, tierId, active: true, expiresAt: { gt: now } },
    });
    if (!valid) throw new ForbiddenException('No active pass for this tier');

    const expiresAt = now.getTime() + 15 * 60 * 1000;
    const payload = `${tierId}:${fanAddress}:${expiresAt}`;
    const token = `${Buffer.from(payload).toString('base64url')}.${this.sign(payload)}`;

    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  async verifyContentToken(tierId: string, token: string) {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return { valid: false, reason: 'Malformed token' };

    let payload: string;
    try {
      payload = Buffer.from(payloadB64, 'base64url').toString();
    } catch {
      return { valid: false, reason: 'Malformed token' };
    }

    const parts = payload.split(':');
    if (parts.length < 3) return { valid: false, reason: 'Malformed token' };

    const expiresAt = parseInt(parts[parts.length - 1], 10);
    if (Date.now() > expiresAt) return { valid: false, reason: 'Token expired' };

    const expectedSig = this.sign(payload);
    if (sig !== expectedSig) return { valid: false, reason: 'Invalid signature' };

    return { valid: true };
  }

  /**
   * Upsert a tier from on-chain event data (called by indexer)
   * 
   * @param data The event data containing tier details from the blockchain.
   * @returns The upserted tier record, or null if the creator is not found.
   */
  async upsertFromChain(data: {
    onChainId: number;
    creatorAddress: string;
    name: string;
    priceUsdc: string;
    durationSeconds: number;
    maxSupply: number;
    minted: number;
    active: boolean;
  }) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: data.creatorAddress },
    });

    if (!creator) return null;

    const durationDays = Math.floor(data.durationSeconds / 86400);

    return this.prisma.tier.upsert({
      where: {
        creatorId_onChainId: {
          creatorId: creator.id,
          onChainId: data.onChainId,
        },
      },
      update: {
        name: data.name,
        priceUsdc: data.priceUsdc,
        durationDays,
        maxSupply: data.maxSupply,
        minted: data.minted,
        active: data.active,
        syncedAt: new Date(),
      },
      create: {
        onChainId: data.onChainId,
        creatorId: creator.id,
        name: data.name,
        priceUsdc: data.priceUsdc,
        durationDays,
        maxSupply: data.maxSupply,
        minted: data.minted,
        active: data.active,
        syncedAt: new Date(),
      },
    });
  }
}
