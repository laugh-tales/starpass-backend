import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class CreatorMembersService {
  constructor(private prisma: PrismaService) {}

  private async requireOwner(creatorId: string, callerAddress: string) {
    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');

    const isOriginalOwner = creator.stellarAddress === callerAddress;
    if (isOriginalOwner) return creator;

    const member = await this.prisma.creatorMember.findUnique({
      where: { creatorId_address: { creatorId, address: callerAddress } },
    });
    if (!member || member.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can manage members');
    }
    return creator;
  }

  async addMember(creatorId: string, callerAddress: string, address: string, role: 'OWNER' | 'EDITOR') {
    await this.requireOwner(creatorId, callerAddress);

    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (creator!.stellarAddress === address) {
      throw new BadRequestException('Cannot add the original creator as a member');
    }

    try {
      return await this.prisma.creatorMember.create({ data: { creatorId, address, role } });
    } catch {
      throw new ConflictException('Member already exists');
    }
  }

  async removeMember(creatorId: string, callerAddress: string, address: string) {
    await this.requireOwner(creatorId, callerAddress);

    const member = await this.prisma.creatorMember.findUnique({
      where: { creatorId_address: { creatorId, address } },
    });
    if (!member) throw new NotFoundException('Member not found');

    await this.prisma.creatorMember.delete({ where: { id: member.id } });
    return { removed: true };
  }

  async listMembers(creatorId: string) {
    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');

    return this.prisma.creatorMember.findMany({
      where: { creatorId },
      orderBy: { addedAt: 'asc' },
    });
  }
}
