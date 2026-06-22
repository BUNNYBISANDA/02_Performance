import { Router } from "express";
import { parseQualityFilters } from "../services/qualityFilters.js";
import { getStageDetail, inspectionStages } from "../services/qualityQueries.js";

export const stageRouter = Router();

stageRouter.get("/stage-detail", async (req, res, next) => {
  try {
    const filters = parseQualityFilters(req.query as Record<string, string | string[] | undefined>);
    const stageParam = typeof req.query.stage === "string" ? req.query.stage : "Inline";
    const stage = inspectionStages.includes(stageParam as (typeof inspectionStages)[number])
      ? stageParam
      : "Inline";
    const detail = await getStageDetail(filters, stage);

    res.json(detail);
  } catch (error) {
    next(error);
  }
});
