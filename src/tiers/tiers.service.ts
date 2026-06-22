import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class TiersService {
  constructor(private prisma: PrismaService) {}

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
      orderBy: [{ sortOrder: 'asc' }, { onChainId: 'asc' }],
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

  async reorderTiers(creatorAddress: string, tierIds: string[]) {
    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress: creatorAddress } });
    if (!creator) throw new NotFoundException('Creator not found');

    const tiers = await this.prisma.tier.findMany({ where: { creatorId: creator.id } });
    const ownedIds = new Set(tiers.map((t) => t.id));

    for (const id of tierIds) {
      if (!ownedIds.has(id)) {
        throw new BadRequestException(`Tier ${id} does not belong to this creator`);
      }
    }

    await Promise.all(
      tierIds.map((id, index) =>
        this.prisma.tier.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );

    return this.prisma.tier.findMany({
      where: { creatorId: creator.id, active: true },
      orderBy: [{ sortOrder: 'asc' }, { onChainId: 'asc' }],
    });
  }
}
