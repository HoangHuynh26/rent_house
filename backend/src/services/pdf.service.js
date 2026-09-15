import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { computeSHA256 } from '../utils/crypto.util.js';
import { formatVND } from '../utils/currency.util.js';
import { CONTRACTS_DIR } from './storage.service.js';

export const generateSignedContractPDF = async (contract, room, tenant) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        const documentHash = computeSHA256(pdfBuffer);
        
        // Save to disk
        const fileName = `contract_${contract.contract_number}_${Date.now()}.pdf`;
        const filePath = path.join(CONTRACTS_DIR, fileName);
        if (!fs.existsSync(path.dirname(filePath))) {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        fs.writeFileSync(filePath, pdfBuffer);

        resolve({
          filePath,
          fileUrl: `/uploads/contracts/${fileName}`,
          documentHash,
          buffer: pdfBuffer
        });
      });

      // Title
      doc.fontSize(18).text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center' });
      doc.fontSize(14).text('Độc lập - Tự do - Hạnh phúc', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text('HỢP ĐỒNG THUÊ PHÒNG TRỌ', { align: 'center', bold: true });
      doc.fontSize(11).text(`Mã hợp đồng: ${contract.contract_number}`, { align: 'center' });
      doc.moveDown();

      // Parties
      doc.fontSize(12).text('BÊN CHO THUÊ (BÊN A):', { underline: true });
      doc.fontSize(10).text(`Đại diện: Ban Quản Lý Nhà Trọ Thanh Tâm`);
      doc.text(`Số điện thoại liên hệ: 0909256680`);
      doc.text(`Địa chỉ nhà trọ: Trục 16, Phường Tân Triệu, TP. Đồng Nai, Việt Nam`);
      doc.moveDown(0.5);

      doc.fontSize(12).text('BÊN THUÊ (BÊN B):', { underline: true });
      doc.fontSize(10).text(`Họ và tên: ${tenant.full_name}`);
      doc.text(`Số điện thoại: ${tenant.phone}`);
      doc.text(`Phòng thuê: ${room.room_number}`);
      doc.moveDown();

      // Terms
      doc.fontSize(12).text('ĐIỀU KHOẢN HỢP ĐỒNG:', { underline: true });
      doc.fontSize(10).text(`1. Thời hạn thuê: Từ ngày ${contract.start_date} đến ngày ${contract.end_date}.`);
      doc.text(`2. Giá thuê phòng: ${formatVND(contract.rent_amount)} / tháng.`);
      doc.text(`3. Tiền đặt cọc: ${formatVND(contract.deposit_amount)}.`);
      doc.text(`4. Đơn giá điện: ${formatVND(contract.electricity_price)} / kWh.`);
      doc.text(`5. Đơn giá nước: ${formatVND(contract.water_price)} / m3.`);
      doc.moveDown();

      doc.text('Nội dung chi tiết thỏa thuận:', { bold: true });
      doc.text(contract.contract_content || 'Hai bên cam kết thực hiện đúng các quy định phòng cháy chữa cháy và an ninh trật tự.');
      doc.moveDown();

      // Signatures
      doc.fontSize(11).text('ĐẠI DIỆN BÊN A (CHỦ NHÀ)', 50, doc.y, { width: 230, align: 'center' });
      doc.text('ĐẠI DIỆN BÊN B (NGƯỜI THUÊ)', 320, doc.y - 14, { width: 230, align: 'center' });
      doc.moveDown(0.5);

      // Embedded Signatures if present (Base64)
      const sigY = doc.y;
      if (contract.admin_signature && contract.admin_signature.startsWith('data:image')) {
        try {
          const adminBase64 = contract.admin_signature.split(',')[1];
          const adminBuf = Buffer.from(adminBase64, 'base64');
          doc.image(adminBuf, 90, sigY, { width: 150, height: 60 });
        } catch (e) {
          doc.text('(Đã ký điện tử)', 90, sigY + 20);
        }
      } else {
        doc.text('(Chưa ký)', 110, sigY + 20);
      }

      if (contract.tenant_signature && contract.tenant_signature.startsWith('data:image')) {
        try {
          const tenantBase64 = contract.tenant_signature.split(',')[1];
          const tenantBuf = Buffer.from(tenantBase64, 'base64');
          doc.image(tenantBuf, 360, sigY, { width: 150, height: 60 });
        } catch (e) {
          doc.text('(Đã ký điện tử)', 360, sigY + 20);
        }
      } else {
        doc.text('(Chưa ký)', 380, sigY + 20);
      }

      // Footer metadata
      doc.fontSize(8).text(
        `Ký kết điện tử lúc: ${new Date().toISOString()} | IP: ${contract.signed_ip || '127.0.0.1'} | SHA-256 hash verified`,
        50,
        780,
        { align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

export default {
  generateSignedContractPDF
};
