import { IsString, IsOptional, IsDateString, IsBoolean, MaxLength } from 'class-validator';

export class UpdateStreamDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsBoolean()
  @IsOptional()
  recordingEnabled?: boolean;
}
