import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsBoolean,
  IsDateString,
  IsArray,
  MaxLength,
} from 'class-validator';

export class CreateStreamDto {
  @IsString()
  @IsNotEmpty({ message: 'Stream title is required.' })
  @MaxLength(500)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['rtmp', 'webrtc'], { message: 'Ingest type must be "rtmp" or "webrtc".' })
  ingestType?: 'rtmp' | 'webrtc';

  @IsDateString({}, { message: 'Scheduled time must be a valid ISO date string.' })
  @IsOptional()
  scheduledAt?: string;

  @IsBoolean()
  @IsOptional()
  recordingEnabled?: boolean;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  platforms?: string[];
}
