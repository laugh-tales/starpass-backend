import { Injectable, NotFoundException, ConflictException, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class FansService {
  private readonly logger = new Logger(FansService.name);
  private readonly COOLING_OFF_PERIOD_DAYS = 30;
  private readonly EXPORT_COOLDOWN_HOURS = 24;

  constructor(private prisma: PrismaService) { }

  /**
   * Find a fan by their Stellar address along with pass count and active subscriptions count.
   * 
   * @param stellarAddress The Stellar public key of the fan.
   * @returns The fan record including pass count and active subscriptions count.
   * @throws {NotFoundException} If the fan is not found.
   */
  async findByAddress(stellarAddress: string) {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress },
    });

    if (!fan) throw new NotFoundException('Fan not found');

    const now = new Date();
    const activePasses = await this.prisma.pass.count({
      where: {
        fanId: fan.id,
        active: true,
        expiresAt: { gt: now },
      },
    });

    // Count distinct creators with active passes (active subscriptions)
    const activeSubscriptions = await this.prisma.pass.groupBy({
      by: ['creatorId'],
      where: {
        fanId: fan.id,
        active: true,
        expiresAt: { gt: now },
      },
    });

    return {
      id: fan.id,
      stellarAddress: fan.stellarAddress,
      displayName: fan.displayName,
      createdAt: fan.createdAt,
      updatedAt: fan.updatedAt,
      passCount: activePasses,
      activeSubscriptionsCount: activeSubscriptions.length,
    };
  }

  /**
   * Get all active subscriptions (passes) for a fan, grouped by creator.
   * 
   * @param stellarAddress The Stellar public key of the fan.
   * @param page Page number for pagination.
   * @param limit Items per page for pagination.
   * @returns Object containing data (grouped by creator), pagination info.
   * @throws {NotFoundException} If the fan is not found.
   */
  async getSubscriptions(stellarAddress: string, page = 1, limit = 20) {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress },
    });

    if (!fan) throw new NotFoundException('Fan not found');

    if (limit > 50) limit = 50;
    const now = new Date();

    // Fetch only active, non-expired passes — never include expired ones
    const passes = await this.prisma.pass.findMany({
      where: {
        fanId: fan.id,
        active: true,
        expiresAt: { gt: now },
      },
      include: { creator: true, tier: true },
      orderBy: { expiresAt: 'asc' },
    });

    // Group all active passes by creator in application code
    const creatorMap = new Map<string, { creator: any; passes: any[] }>();
    for (const pass of passes) {
      const creatorId = pass.creatorId;
      if (!creatorMap.has(creatorId)) {
        creatorMap.set(creatorId, { creator: pass.creator, passes: [] });
      }
      creatorMap.get(creatorId)!.passes.push(pass);
    }

    // total = distinct creators with at least one active pass
    const allGroups = Array.from(creatorMap.values());
    const total = allGroups.length;

    // Paginate over creator groups
    const skip = (page - 1) * limit;
    const data = allGroups.slice(skip, skip + limit);

    return { data, total, page, limit };
  }

  /**
   * Request deletion of a fan account (GDPR compliance).
   * Initiates a 30-day cooling off period and cancels all active passes.
   * 
   * @param stellarAddress The Stellar public key of the fan.
   * @returns The updated fan record with deletion request timestamp.
   * @throws {NotFoundException} If the fan is not found.
   * @throws {ConflictException} If deletion has already been requested.
   */
  async requestDeletion(stellarAddress: string) {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress },
    });

    if (!fan) throw new NotFoundException('Fan not found');

    if (fan.deletionRequestedAt) {
      throw new ConflictException('Deletion already requested for this account');
    }

    // Start a transaction to ensure data consistency
    const result = await this.prisma.$transaction(async (tx) => {
      // Cancel all active passes
      await this.cancelAllActivePasses(fan.id, tx);

      // Mark fan for deletion with 30-day cooling off period
      const updatedFan = await tx.fan.update({
        where: { id: fan.id },
        data: {
          deletionRequestedAt: new Date(),
        },
      });

      this.logger.log(
        `Deletion requested for fan ${stellarAddress}. Cooling off period starts now.`,
      );

      return updatedFan;
    });

    return result;
  }

  /**
   * Check if a fan's deletion cooling off period has elapsed.
   * 
   * @param fan The fan record to check.
   * @returns True if 30 days have passed since deletion was requested.
   */
  private canFinalizeDeletion(fan: any): boolean {
    if (!fan.deletionRequestedAt) return false;

    const coolingOffPeriodMs = this.COOLING_OFF_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();
    const requestedTime = new Date(fan.deletionRequestedAt).getTime();

    return now - requestedTime >= coolingOffPeriodMs;
  }

  /**
   * Request a data export for a fan (GDPR compliance).
   * Compiles all fan data: profile, passes, activity, favorites.
   * Rate limited to 1 export per 24 hours.
   *
   * @param stellarAddress The Stellar public key of the fan.
   * @returns The compiled fan data export.
   * @throws {NotFoundException} If the fan is not found.
   * @throws {HttpException} If export was requested within the last 24 hours.
   */
  async requestDataExport(stellarAddress: string) {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress },
      include: {
        passes: {
          include: { tier: true, creator: true },
          orderBy: { purchasedAt: 'desc' },
        },
      },
    });

    if (!fan) throw new NotFoundException('Fan not found');

    // Rate limit: 1 export per 24 hours
    if (fan.lastExportRequestedAt) {
      const cooldownMs = this.EXPORT_COOLDOWN_HOURS * 60 * 60 * 1000;
      const elapsed = Date.now() - new Date(fan.lastExportRequestedAt).getTime();
      if (elapsed < cooldownMs) {
        const retryAfter = Math.ceil((cooldownMs - elapsed) / 1000);
        throw new HttpException(
          `Data export rate limited. Retry after ${retryAfter} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Update last export timestamp
    await this.prisma.fan.update({
      where: { id: fan.id },
      data: { lastExportRequestedAt: new Date() },
    });

    // Compile all fan data
    const earningsRecords = await this.prisma.earningsRecord.findMany({
      where: { fanId: fan.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        stellarAddress: fan.stellarAddress,
        displayName: fan.displayName,
        createdAt: fan.createdAt,
      },
      passes: fan.passes.map((p) => ({
        id: p.id,
        tier: p.tier?.name || null,
        creator: p.creator?.displayName || null,
        purchasedAt: p.purchasedAt,
        expiresAt: p.expiresAt,
        active: p.active,
      })),
      earnings: earningsRecords.map((e) => ({
        id: e.id,
        amount: e.amount,
        fee: e.fee,
        netAmount: e.netAmount,
        createdAt: e.createdAt,
      })),
    };
  }

  /**
   * Anonymize a fan's personal data (called after deletion request).
   * This is typically called immediately after requestDeletion() in a scheduled job.
   *
   * @param stellarAddress The Stellar public key of the fan.
   * @returns The anonymized fan record.
   * @throws {NotFoundException} If the fan is not found.
   * @throws {BadRequestException} If deletion has not been requested.
   */
  async anonymizeFanData(stellarAddress: string) {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress },
    });

    if (!fan) throw new NotFoundException('Fan not found');

    if (!fan.deletionRequestedAt) {
      throw new BadRequestException('Deletion has not been requested for this account');
    }

    if (fan.anonymized) {
      this.logger.warn(`Fan ${stellarAddress} data is already anonymized`);
      return fan;
    }

    // Anonymize personal data
    const anonymizedFan = await this.prisma.fan.update({
      where: { id: fan.id },
      data: {
        displayName: `Deleted User ${fan.id.slice(0, 8)}`,
        anonymized: true,
      },
    });

    this.logger.log(`Fan ${stellarAddress} data anonymized`);

    return anonymizedFan;
  }

  /**
   * Permanently delete a fan account after the cooling off period has elapsed.
   * This should only be called after the 30-day cooling off period.
   * 
   * @param stellarAddress The Stellar public key of the fan.
   * @returns The permanently deleted fan record.
   * @throws {NotFoundException} If the fan is not found.
   * @throws {BadRequestException} If deletion has not been requested or cooling off period hasn't elapsed.
   */
  async permanentlyDeleteFan(stellarAddress: string) {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress },
    });

    if (!fan) throw new NotFoundException('Fan not found');

    if (!fan.deletionRequestedAt) {
      throw new BadRequestException('Deletion has not been requested for this account');
    }

    if (!this.canFinalizeDeletion(fan)) {
      const coolingOffEndDate = new Date(fan.deletionRequestedAt);
      coolingOffEndDate.setDate(coolingOffEndDate.getDate() + this.COOLING_OFF_PERIOD_DAYS);
      throw new BadRequestException(
        `Cooling off period not yet elapsed. Permanent deletion available after ${coolingOffEndDate.toISOString()}`,
      );
    }

    // Delete the fan (will cascade to sessions due to User relation)
    // Passes are NOT deleted to maintain transaction records
    const deletedFan = await this.prisma.fan.delete({
      where: { id: fan.id },
    });

    // Also delete the associated user
    await this.prisma.user.delete({
      where: { id: fan.userId },
    });

    this.logger.log(`Fan ${stellarAddress} permanently deleted`);

    return deletedFan;
  }

  /**
   * Cancel all active passes for a fan.
   * This is used when a fan requests account deletion.
   * 
   * @param fanId The ID of the fan.
   * @param tx Optional Prisma transaction client (for use within transactions).
   */
  private async cancelAllActivePasses(fanId: string, tx?: any) {
    const prismaClient = tx || this.prisma;

    const cancelledPasses = await prismaClient.pass.updateMany({
      where: {
        fanId,
        active: true,
      },
      data: {
        active: false,
      },
    });

    if (cancelledPasses.count > 0) {
      this.logger.log(`Cancelled ${cancelledPasses.count} active passes for fan ${fanId}`);
    }

    return cancelledPasses;
  }

  /**
   * Get deletion status for a fan account.
   * 
   * @param stellarAddress The Stellar public key of the fan.
   * @returns Deletion status including request date and cooling off period end date.
   * @throws {NotFoundException} If the fan is not found.
   */
  async getDeletionStatus(stellarAddress: string) {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress },
    });

    if (!fan) throw new NotFoundException('Fan not found');

    if (!fan.deletionRequestedAt) {
      return {
        deletionRequested: false,
        deletionRequestedAt: null,
        coolingOffEndDate: null,
        canFinalizeDeletion: false,
        anonymized: false,
      };
    }

    const coolingOffEndDate = new Date(fan.deletionRequestedAt);
    coolingOffEndDate.setDate(coolingOffEndDate.getDate() + this.COOLING_OFF_PERIOD_DAYS);

    return {
      deletionRequested: true,
      deletionRequestedAt: fan.deletionRequestedAt,
      coolingOffEndDate,
      canFinalizeDeletion: this.canFinalizeDeletion(fan),
      anonymized: fan.anonymized,
    };
  }
}
