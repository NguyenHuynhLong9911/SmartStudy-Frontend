import { Router, type NextFunction, type Request, type Response } from "express";

import { getAuthClaims, requireAuth } from "../../middleware/require-auth.js";
import type { IAuthProvider } from "../../ports/index.js";
import {
  getSummaryQuerySchema,
  summarizeRequestSchema,
  summaryDocumentIdParamsSchema,
} from "./summary-schemas.js";
import type { ISummaryService } from "./summary-service.js";

export function createSummaryRouter(
  authProvider: IAuthProvider,
  summaryService: ISummaryService,
): Router {
  const router = Router();

  router.use(requireAuth(authProvider));

  router.get(
    "/documents/:documentId/summary",
    handle(async (request, response) => {
      const { documentId } = summaryDocumentIdParamsSchema.parse(request.params);
      const query = getSummaryQuerySchema.parse(request.query);
      const claims = getAuthClaims(response);

      const summary = await summaryService.getSummary({
        chapterRef: query.chapterRef ?? null,
        documentId,
        scope: query.scope,
        userId: claims.sub,
      });

      if (!summary) {
        response.status(404).json({ error: "Summary not found" });
        return;
      }

      response.status(200).json({ summary });
    }),
  );

  router.post(
    "/documents/:documentId/summary",
    handle(async (request, response) => {
      const { documentId } = summaryDocumentIdParamsSchema.parse(request.params);
      const body = summarizeRequestSchema.parse(request.body);
      const claims = getAuthClaims(response);

      if (body.scope === "chapter") {
        if (!body.chapterRef) {
          response.status(400).json({ error: "chapterRef is required for chapter scope" });
          return;
        }
        const summary = await summaryService.summarizeChapter({
          chapterRef: body.chapterRef,
          documentId,
          forceRefresh: body.forceRefresh,
          userId: claims.sub,
        });
        response.status(200).json({ summary });
        return;
      }

      const summary = await summaryService.summarizeFullDocument({
        documentId,
        forceRefresh: body.forceRefresh,
        userId: claims.sub,
      });
      response.status(200).json({ summary });
    }),
  );

  return router;
}

type AsyncRouteHandler = (
  request: Request,
  response: Response,
) => Promise<void>;

function handle(handler: AsyncRouteHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response).catch(next);
  };
}
