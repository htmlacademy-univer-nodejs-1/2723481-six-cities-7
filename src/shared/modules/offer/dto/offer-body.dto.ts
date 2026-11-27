import {Expose, Type} from 'class-transformer';
import {City} from '../../../../types/city.type.js';
import {Location} from '../../../../types/location.type.js';
import {Facility, HousingType} from '../../../../types/offer.type.js';
import {CreateOfferDto} from './create-offer.dto.js';

export class LocationFields implements Location {
  @Expose() public latitude!: number;
  @Expose() public longitude!: number;
}

export class CityFields implements City {
  @Expose() public name!: string;
  @Expose() @Type(() => LocationFields) public location!: LocationFields;
}

export class OfferBodyDto implements Omit<CreateOfferDto, 'author'> {
  @Expose() public title!: string;
  @Expose() public description!: string;
  @Expose() @Type(() => Date) public postDate!: Date;
  @Expose() @Type(() => CityFields) public city!: CityFields;
  @Expose() public previewImage!: string;
  @Expose() public images!: string[];
  @Expose() public isPremium!: boolean;
  @Expose() public type!: HousingType;
  @Expose() public rooms!: number;
  @Expose() public guests!: number;
  @Expose() public price!: number;
  @Expose() public facilities!: Facility[];
  @Expose() @Type(() => LocationFields) public location!: LocationFields;
}

export type CreateOfferBody = Omit<OfferBodyDto, 'postDate'> & {postDate: string};
export type UpdateOfferBody = Partial<CreateOfferBody>;
