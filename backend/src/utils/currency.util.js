export const formatVND = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(num);
};

export const toFixedNumber = (val, decimals = 2) => {
  const num = Number(val) || 0;
  return Number(num.toFixed(decimals));
};
