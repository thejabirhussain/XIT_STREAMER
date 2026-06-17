import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class WebRtcOfferDto {
  @IsString()
  @IsNotEmpty({ message: 'SDP offer is required.' })
  sdp!: string;

  @IsString()
  @IsIn(['offer'], { message: 'Type must be "offer".' })
  type!: string;
}
