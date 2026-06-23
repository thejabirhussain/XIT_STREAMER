import { PartialType } from '@nestjs/mapped-types';
import { CreateOverlayDto } from './create-overlay.dto';

export class UpdateOverlayDto extends PartialType(CreateOverlayDto) {}
