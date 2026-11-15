export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  TENANT: 'tenant'
};

export const ROOM_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
  INACTIVE: 'inactive'
};

export const CONTRACT_STATUS = {
  DRAFT: 'draft',
  PENDING_SIGNATURE: 'pending_signature',
  SIGNED: 'signed',
  EXPIRED: 'expired',
  TERMINATED: 'terminated'
};

export const BILL_STATUS = {
  UNPAID: 'unpaid',
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled'
};

export const VERIFICATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  CORRECTED: 'corrected',
  REJECTED: 'rejected',
  FLAGGED: 'flagged'
};

const isProduction = process.env.NODE_ENV === 'production';
export const COOKIE_OPTIONS = {
  httpOnly: true,
  // Backend & Frontend are hosted on the same Netlify domain -> 'lax' works reliably across browsers
  secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction,
  sameSite: process.env.COOKIE_SAMESITE || 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};
