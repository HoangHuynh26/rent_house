import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { computeSHA256 } from '../utils/crypto.util.js';

// Netlify Functions only allow writes under /tmp.  Local/Docker deployments keep
// the existing project-relative uploads directory unless UPLOAD_DIR is supplied.
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : (process.env.NETLIFY === 'true' ? '/tmp/uploads' : path.resolve(process.cwd(), 'uploads'));
export const METERS_DIR = path.join(UPLOAD_DIR, 'meters');
export const CONTRACTS_DIR = path.join(UPLOAD_DIR, 'contracts');

// Ensure directories exist
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(METERS_DIR)) fs.mkdirSync(METERS_DIR, { recursive: true });
if (!fs.existsSync(CONTRACTS_DIR)) fs.mkdirSync(CONTRACTS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'contract') {
      cb(null, CONTRACTS_DIR);
    } else {
      cb(null, METERS_DIR);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedDocMimes = ['application/pdf'];

  if (file.fieldname === 'contract' && allowedDocMimes.includes(file.mimetype.toLowerCase())) {
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
  if (!fs.existsSync(filePath)) return null;
  const fileBuffer = fs.readFileSync(filePath);
  return computeSHA256(fileBuffer);
};

export default {
  upload,
  computeFileHash,
  UPLOAD_DIR,
  METERS_DIR,
  CONTRACTS_DIR
};
