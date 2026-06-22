import { Router } from "express";
import { parseQualityFilters } from "../services/qualityFilters.js";
import { getDefectCategories } from "../services/qualityQueries.js";

export const defectsRouter = Router();

defectsRouter.get("/defect-categories", async (req, res, next) => {
  try {
    const filters = parseQualityFilters(req.query as Record<string, string | string[] | undefined>);
    const categories = await getDefectCategories(filters);
    res.json(categories);
  } catch (error) {
    next(error);
  }
});
