import { Router, type NextFunction, type Request, type Response } from "express";

import { getAuthClaims, requireAuth } from "../../middleware/require-auth.js";
import type { IAuthProvider } from "../../ports/index.js";
import type { DocumentConfig } from "./document-config.js";
import type { IDocumentService } from "./document-service.js";
import {
  completeDocumentUploadSchema,
  createDocumentUploadSchema,
  documentIdParamsSchema,
} from "./document-schemas.js";

export function createDocumentRouter(
  authProvider: IAuthProvider,
  documentService: IDocumentService,
  config: DocumentConfig,
): Router {
  const router = Router();
  const uploadSchema = createDocumentUploadSchema(config.maxFileSizeBytes);

  router.use(requireAuth(authProvider));

  router.post(
    "/upload-url",
    handle(async (request, response) => {
      const input = uploadSchema.parse(request.body);
      const claims = getAuthClaims(response);
      const result = await documentService.requestUpload({
        ...input,
        userId: claims.sub,
      });

      response.status(201).json(result);
    }),
  );

  router.post(
    "/:documentId/complete",
    handle(async (request, response) => {
      completeDocumentUploadSchema.parse(request.body ?? {});
      const { documentId } = documentIdParamsSchema.parse(request.params);
      const claims = getAuthClaims(response);
      const document = await documentService.completeUpload(
        documentId,
        claims.sub,
      );

      response.status(document.status === "ready" ? 200 : 202).json({
        document,
      });
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
