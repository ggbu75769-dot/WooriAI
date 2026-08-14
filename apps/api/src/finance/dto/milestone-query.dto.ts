import { IsIn } from "class-validator";

/**
 * REP-103: GET /children/:childId/reports/milestone required `type` selector.
 * Lives in its own file (rather than extending query.dto.ts's CategoryReportQueryDto)
 * so the REP-104 DTO stays untouched by this ticket.
 */
export const MILESTONE_REPORT_TYPES = ["d100", "first-birthday"] as const;

export type MilestoneReportType = (typeof MILESTONE_REPORT_TYPES)[number];

export class MilestoneReportQueryDto {
  @IsIn(MILESTONE_REPORT_TYPES)
  type!: MilestoneReportType;
}
