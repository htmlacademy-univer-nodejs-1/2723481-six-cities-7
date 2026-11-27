import {Expose, Type} from 'class-transformer';
import {Facility, HousingType} from '../../../types/offer.type.js';
import {toResponse} from '../../libs/http/response-object.js';
import {UserResponse} from '../user/user.response.js';
import {CityFields, LocationFields} from './dto/offer-body.dto.js';
import {OfferView} from './offer-service.interface.js';

export class OfferSummaryResponse {
  @Expose() public id!: string;
  @Expose() public title!: string;
  @Expose() public postDate!: Date;
  @Expose() @Type(() => CityFields) public city!: CityFields;
  @Expose() public previewImage!: string;
  @Expose() public isPremium!: boolean;
  @Expose() public isFavorite!: boolean;
  @Expose() public rating!: number;
  @Expose() public type!: HousingType;
  @Expose() public price!: number;
  @Expose() public commentsCount!: number;
  @Expose() @Type(() => LocationFields) public location!: LocationFields;
}

export class OfferResponse extends OfferSummaryResponse {
  @Expose() public description!: string;
  @Expose() public images!: string[];
  @Expose() public rooms!: number;
  @Expose() public guests!: number;
  @Expose() public facilities!: Facility[];
  @Expose() @Type(() => UserResponse) public author!: UserResponse;
}

export function toOfferSummary(offer: OfferView): OfferSummaryResponse {
  return toResponse(OfferSummaryResponse, {...offer, id: offer._id.toString()});
}

export function toOfferResponse(offer: OfferView, author: UserResponse): OfferResponse {
  return toResponse(OfferResponse, {...offer, id: offer._id.toString(), author});
}
