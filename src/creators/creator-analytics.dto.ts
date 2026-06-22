import { ApiProperty } from '@nestjs/swagger';

class SubscriberGrowthPointDto {
  @ApiProperty({ example: '2026-06-01' })
  date: string;

  @ApiProperty({ example: 120 })
  count: number;
}

export class CreatorAnalyticsDto {
  @ApiProperty({ type: [SubscriberGrowthPointDto] })
  subscriberGrowth: SubscriberGrowthPointDto[];

  @ApiProperty({ description: 'Churn rate as a percentage' })
  churnRate: number;

  @ApiProperty({ description: 'Average duration of passes in days' })
  avgPassDuration: number;

  @ApiProperty({ description: 'Retention rate as a percentage' })
  retentionRate: number;
}
