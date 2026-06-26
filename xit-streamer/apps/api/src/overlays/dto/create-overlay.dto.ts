import { IsString, IsEnum, IsNumber, IsBoolean, IsObject, IsOptional, Min, Max } from 'class-validator';
import { OverlayAnimation, OverlayType } from '../../entities/overlay.entity';

export class CreateOverlayDto {
  @IsEnum(['product', 'flash_sale', 'qr_code', 'text', 'image', 'website', 'cta', 'announcement_banner', 'coupon_banner', 'limited_stock', 'brand_logo', 'comment_highlight'])
  type: OverlayType;

  @IsString()
  name: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  x?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  y?: number;

  @IsNumber()
  @IsOptional()
  @Min(5)
  @Max(100)
  width?: number;

  @IsNumber()
  @IsOptional()
  @Min(5)
  @Max(100)
  height?: number;

  @IsNumber()
  @IsOptional()
  zIndex?: number;

  @IsNumber()
  @IsOptional()
  @Min(-360)
  @Max(360)
  rotation?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  opacity?: number;

  @IsBoolean()
  @IsOptional()
  visible?: boolean;

  @IsEnum(['none', 'fade', 'slide_left', 'slide_right', 'slide_bottom', 'zoom', 'bounce', 'pulse'])
  @IsOptional()
  animation?: OverlayAnimation;

  @IsObject()
  @IsOptional()
  styleOverrides?: Record<string, unknown>;
}
