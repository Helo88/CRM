import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer, { FileFilterCallback } from "multer";
import { NextFunction, Request, RequestHandler, Response } from "express";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "customers");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file, not a total-request cap

function customerUploadDir(customerId: string): string {
  const dir = path.join(UPLOAD_ROOT, customerId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// image/PDF only, for the ID-document slot — mirrors ALLOWED_ID_DOCUMENT_MIMES
// below; both the mimetype AND the extension must agree (see fileFilter).
const ALLOWED_ID_DOCUMENT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"];

function extensionFor(file: Express.Multer.File): string {
  const ext = path.extname(file.originalname).toLowerCase();
  return ALLOWED_ID_DOCUMENT_EXTENSIONS.includes(ext) ? ext : "";
}

// Filename is fully opaque, decoupled from client input: a generated UUID
// plus the extension implied by the (validated, for the ID slot) file type —
// never derived from file.originalname itself. The client-supplied name is
// kept only as IAttachment.fileName (display metadata), never used to build
// a filesystem path — removes any path-traversal/collision surface from an
// attacker-controlled name.
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const customerId = req.params.id;
    if (typeof customerId !== "string") {
      cb(new Error("Invalid customer id"), "");
      return;
    }
    cb(null, customerUploadDir(customerId));
  },
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${extensionFor(file)}`);
  },
});

// mimetype is client-supplied multipart request metadata, not verified file
// content — for an upload this sensitive (an ID document), require it to
// agree with the file's extension rather than trusting either alone. Full
// magic-byte content-sniffing would close the remaining gap (spoofing both)
// but is out of scope for this pass.
function idDocumentFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const mimetypeOk = file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
  const extensionOk = ALLOWED_ID_DOCUMENT_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase());
  if (!mimetypeOk || !extensionOk) {
    cb(new Error("UNSUPPORTED_FILE_TYPE"));
    return;
  }
  cb(null, true);
}

const uploadIdDocumentMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: idDocumentFileFilter,
}).single("file");

// General attachments stay type-unrestricted, as scoped — only the file-size
// cap and the 10-files-per-request cap apply.
const uploadGeneralAttachmentsMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
}).array("files", 10);

interface HttpError extends Error {
  status?: number;
}

// Adapts multer's callback-style errors (LIMIT_FILE_SIZE, our own
// fileFilter rejection) into the { status, message } shape
// backend/src/middleware/errorHandler.ts already knows how to render,
// instead of letting them fall through as generic 500s.
function withMulterErrorHandling(middleware: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        const httpError: HttpError = new Error("File exceeds the 10MB size limit");
        httpError.status = 413;
        next(httpError);
        return;
      }
      if (err instanceof Error && err.message === "UNSUPPORTED_FILE_TYPE") {
        const httpError: HttpError = new Error("UNSUPPORTED_FILE_TYPE");
        httpError.status = 400;
        next(httpError);
        return;
      }
      next(err);
    });
  };
}

export const uploadIdDocument = withMulterErrorHandling(uploadIdDocumentMiddleware);
export const uploadGeneralAttachments = withMulterErrorHandling(uploadGeneralAttachmentsMiddleware);

// Resolves an attachment's actual on-disk path from its opaque storage
// filename — used by the protected download routes and by ID-document
// replacement's best-effort cleanup of the previous file. Never derived
// from anything client-supplied.
export function customerFilePath(customerId: string, storageFileName: string): string {
  return path.join(UPLOAD_ROOT, customerId, storageFileName);
}
