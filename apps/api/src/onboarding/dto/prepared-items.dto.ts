import { ArrayMinSize, IsArray, IsUUID } from "class-validator";

export class PreparedItemsDto {
  @IsArray()
  @ArrayMinSize(0)
  @IsUUID(undefined, { each: true })
  itemTemplateIds!: string[];
}
