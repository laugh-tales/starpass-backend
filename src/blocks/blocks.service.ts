import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class BlocksService {
  constructor(private prisma: PrismaService) {}

  async blockFan(creatorAddress: string, fanAddress: string, reason?: string) {
    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress: creatorAddress } });
    if (!creator) throw new NotFoundException('Creator not found');

    try {
      return await this.prisma.block.create({
        data: { creatorId: creator.id, fanAddress, reason },
      });
    } catch {
      throw new ConflictException('Fan is already blocked');
    }
  }

  async unblockFan(creatorAddress: string, fanAddress: string) {
    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress: creatorAddress } });
    if (!creator) throw new NotFoundException('Creator not found');

    const block = await this.prisma.block.findUnique({
      where: { creatorId_fanAddress: { creatorId: creator.id, fanAddress } },
    });
    if (!block) throw new NotFoundException('Block not found');

    await this.prisma.block.delete({ where: { id: block.id } });
    return { unblocked: true };
  }

  async isFanBlocked(creatorId: string, fanAddress: string): Promise<boolean> {
    const block = await this.prisma.block.findUnique({
      where: { creatorId_fanAddress: { creatorId, fanAddress } },
    });
    return !!block;
  }

  async listBlocks(creatorAddress: string) {
    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress: creatorAddress } });
    if (!creator) throw new NotFoundException('Creator not found');

    return this.prisma.block.findMany({
      where: { creatorId: creator.id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
