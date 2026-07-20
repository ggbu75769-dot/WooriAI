import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListNotificationsDto {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}

export class MarkNotificationsReadDto {
  @IsArray() @ArrayMaxSize(100) @IsUUID("4", { each: true }) ids!: string[];
}
