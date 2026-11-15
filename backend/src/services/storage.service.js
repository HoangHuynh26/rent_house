import fs from 'fs';
import os from 'os';
import path from 'path';
import multer from 'multer';
import { computeSHA256 } from '../utils/crypto.util.js';

// Netlify Functions / AWS Lambda only allow writes under /tmp (os.tmpdir()).
// Even if UPLOAD_DIR='./uploads' is set in Netlify Environment Variables (imported from .env),
// /var/task is read-only and mkdirSync('/var/task/uploads') would throw ENOENT/EROFS.
const IS_SERVERLESS =
  process.env.NETLIFY === 'true' ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  Boolean(process.env.LAMBDA_TASK_ROOT) ||
  process.cwd().startsWith('/var/task');

const resolveWritableUploadDir = () => {
  const tmpUploadDir = path.join(os.tmpdir(), 'uploads');

  if (IS_SERVERLESS) {
    if (process.env.UPLOAD_DIR) {
      const configured = path.resolve(process.env.UPLOAD_DIR);
      if (configured.startsWith('/tmp') || configured.startsWith(os.tmpdir())) {
        return configured;
      }
    }
    return tmpUploadDir;
  }

  const candidate = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), 'uploads');

  try {
    if (!fs.existsSync(candidate)) {
      fs.mkdirSync(candidate, { recursive: true });
    }
    return candidate;
  } catch (err) {
    console.warn(`[Storage] Fallback to ${tmpUploadDir} because ${candidate} is not writable:`, err.message);
    return tmpUploadDir;
  }
};

export const UPLOAD_DIR = resolveWritableUploadDir();
export const METERS_DIR = path.join(UPLOAD_DIR, 'meters');
export const CONTRACTS_DIR = path.join(UPLOAD_DIR, 'contracts');

export const ensureUploadDirs = () => {
  for (const dir of [UPLOAD_DIR, METERS_DIR, CONTRACTS_DIR]) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      console.warn(`[Storage] Could not create directory ${dir}:`, err.message);
    }
  }
};

// Ensure directories exist at startup without ever crashing the serverless runtime
ensureUploadDirs();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDirs();
    if (file.fieldname === 'contract') {
      cb(null, CONTRACTS_DIR);
    } else {
      cb(null, METERS_DIR);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedDocMimes = ['application/pdf'];

  if (file.fieldname === 'contract' && allowedDocMimes.includes((file.mimetype || '').toLowerCase())) {
    return cb(null, true);
  }

  // Accept all common image formats or any image/* mime type
  if (file.mimetype && (file.mimetype.startsWith('image/') || ['application/octet-stream'].includes(file.mimetype))) {
    return cb(null, true);
  }

  cb(new Error('Định dạng tệp không được hỗ trợ. Vui lòng tải lên ảnh (JPEG, PNG, WebP) hoặc tệp PDF.'));
};

export const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB max
  fileFilter
});

export const computeFileHash = (filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const fileBuffer = fs.readFileSync(filePath);
    return computeSHA256(fileBuffer);
  } catch (err) {
    return null;
  }
};

export default {
  upload,
  computeFileHash,
  ensureUploadDirs,
  UPLOAD_DIR,
  METERS_DIR,
  CONTRACTS_DIR
};
