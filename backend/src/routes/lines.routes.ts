import { Router } from "express";
import { parseQualityFilters } from "../services/qualityFilters.js";
import { getLineAnalysis } from "../services/qualityQueries.js";

export const linesRouter = Router();

linesRouter.get("/line-analysis", async (req, res, next) => {
  try {
    const filters = parseQualityFilters(req.query as Record<string, string | string[] | undefined>);
    const lineAnalysis = await getLineAnalysis(filters);
    res.json(lineAnalysis);
  } catch (error) {
    next(error);
  }
});
