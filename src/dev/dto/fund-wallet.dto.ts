import { IsNotEmpty, IsString } from 'class-validator';

export class FundWalletDto {
  @IsString()
  @IsNotEmpty()
  address: string;
}
