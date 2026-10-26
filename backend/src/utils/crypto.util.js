import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 10;

export const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

export const computeSHA256 = (bufferOrString) => {
  return crypto.createHash('sha256').update(bufferOrString).digest('hex');
};

export const generateSecureOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

export const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};
