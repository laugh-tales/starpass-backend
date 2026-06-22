import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ContentSchedulesService {
  constructor(private prisma: PrismaService) {}

  async create(
    creatorAddress: string,
    tierId: string,
    data: { contentUrl: string; title: string; availableAt: Date },
  ) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: creatorAddress },
    });
    if (!creator) throw new NotFoundException('Creator not found');

    const tier = await this.prisma.tier.findUnique({ where: { id: tierId } });
    if (!tier) throw new NotFoundException('Tier not found');
    if (tier.creatorId !== creator.id) throw new ForbiddenException('Tier does not belong to this creator');

    return this.prisma.contentSchedule.create({
      data: { creatorId: creator.id, tierId, ...data, active: false },
    });
  }

  async findByCreator(creatorAddress: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: creatorAddress },
    });
    if (!creator) throw new NotFoundException('Creator not found');

    return this.prisma.contentSchedule.findMany({
      where: { creatorId: creator.id },
      orderBy: { availableAt: 'asc' },
    });
  }

  async activateDue() {
    const now = new Date();
    return this.prisma.contentSchedule.updateMany({
      where: { active: false, availableAt: { lte: now } },
      data: { active: true },
    });
  }
}
