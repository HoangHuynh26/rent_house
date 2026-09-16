import * as contractRepo from '../repositories/contract.repo.js';
import * as roomRepo from '../repositories/room.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import * as pdfService from '../services/pdf.service.js';
import * as notificationRepo from '../repositories/notification.repo.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import * as auditService from '../services/audit.service.js';
import { isPostgresActive, query } from '../config/db.js';

// Synchronize price updates to current readings & bills of the room
async function syncContractPricingToReadingsAndBills(roomId, { electricity_price, water_price, rent_amount }) {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    if (isPostgresActive()) {
      let elecAmount = null;
      let waterAmount = null;

      if (electricity_price !== undefined && electricity_price !== null) {
        const ep = Number(electricity_price);
        const elecRes = await query(`
          UPDATE electricity_readings
          SET unit_price = $1, amount = ROUND(consumption * $1), updated_at = CURRENT_TIMESTAMP
          WHERE room_id = $2 AND reading_month = $3 AND reading_year = $4
          RETURNING amount
        `, [ep, roomId, currentMonth, currentYear]);
        if (elecRes.rows.length > 0) {
          elecAmount = Number(elecRes.rows[0].amount);
        }
      }

      if (water_price !== undefined && water_price !== null) {
        const wp = Number(water_price);
        const waterRes = await query(`
          UPDATE water_readings
          SET unit_price = $1, amount = ROUND(consumption * $1), updated_at = CURRENT_TIMESTAMP
          WHERE room_id = $2 AND reading_month = $3 AND reading_year = $4
          RETURNING amount
        `, [wp, roomId, currentMonth, currentYear]);
        if (waterRes.rows.length > 0) {
          waterAmount = Number(waterRes.rows[0].amount);
        }
      }

      // Update bill if exists for this period
      const billRes = await query(`
        SELECT * FROM bills WHERE room_id = $1 AND billing_month = $2 AND billing_year = $3
      `, [roomId, currentMonth, currentYear]);

      if (billRes.rows.length > 0) {
        const b = billRes.rows[0];
        const newElec = elecAmount !== null ? elecAmount : Number(b.electricity_amount);
        const newWater = waterAmount !== null ? waterAmount : Number(b.water_amount);
        const newRent = rent_amount !== undefined && rent_amount !== null && !isNaN(rent_amount) ? Number(rent_amount) : Number(b.rent_amount);
        const newTotal = newRent + newElec + newWater - Number(b.discount_amount || 0);

        await query(`
          UPDATE bills
          SET rent_amount = $1, electricity_amount = $2, water_amount = $3, total_amount = $4, updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `, [newRent, newElec, newWater, newTotal, b.id]);
      }
    }
  } catch (syncErr) {
    console.warn('[Sync Contract Pricing Error]:', syncErr.message);
  }
}

export const getContracts = async (req, res) => {
  try {
    const contracts = await contractRepo.findAll(req.query);
    return successResponse(res, contracts, 'Danh sách hợp đồng.');
  } catch (err) {
    console.error('[Get Contracts Error]:', err);
    return errorResponse(res, 'Không thể tải danh sách hợp đồng.', 'SERVER_ERROR', 500);
  }
};

export const getContractById = async (req, res) => {
  try {
    const { id } = req.params;
    const contract = await contractRepo.findById(id);
    if (!contract) {
      return errorResponse(res, 'Không tìm thấy hợp đồng này.', 'NOT_FOUND', 404);
    }
    return successResponse(res, contract, 'Chi tiết hợp đồng.');
  } catch (err) {
    console.error('[Get Contract Error]:', err);
    return errorResponse(res, 'Không thể tải chi tiết hợp đồng.', 'SERVER_ERROR', 500);
  }
};

export const createContract = async (req, res) => {
  try {
    const {
      room_id,
      tenant_id,
      start_date,
      end_date,
      rent_amount,
      deposit_amount,
      electricity_price,
      water_price,
      contract_content,
      admin_signature
    } = req.body;

    if (!room_id || !tenant_id || !start_date || !end_date || !rent_amount || !electricity_price || !water_price) {
      return errorResponse(res, 'Vui lòng cung cấp đầy đủ thông tin bắt buộc của hợp đồng.', 'BAD_REQUEST', 400);
    }

    const room = await roomRepo.findById(room_id);
    const tenant = await userRepo.findById(tenant_id);
    if (!room || !tenant) {
      return errorResponse(res, 'Phòng hoặc người thuê không tồn tại.', 'NOT_FOUND', 404);
    }

    const contractNumber = `HD-${room.room_number}-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const status = admin_signature ? 'pending_signature' : 'draft';

    const contract = await contractRepo.create({
      room_id,
      tenant_id,
      contract_number: contractNumber,
      start_date,
      end_date,
      rent_amount,
      deposit_amount: deposit_amount || 0,
      electricity_price,
      water_price,
      contract_content: contract_content || `Hợp đồng thuê phòng ${room.room_number} giữa Ban Quản Lý và ${tenant.full_name}.`,
      status,
      admin_signature
    });

    // Automatically set room to occupied and assign tenant to room
    await roomRepo.update(room_id, { status: 'occupied' });
    if (isPostgresActive()) {
      await query(
        `INSERT INTO tenant_rooms (id, tenant_id, room_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, room_id) DO NOTHING`,
        [crypto.randomUUID(), tenant_id, room_id]
      );
      await query(`UPDATE users SET room_id = COALESCE(room_id, $1) WHERE id = $2`, [room_id, tenant_id]);
    } else {
      if (!tenant.room_id) {
        await userRepo.update(tenant_id, { room_id });
      }
    }

    // Notify tenant that contract is ready to sign
    await notificationRepo.create({
      recipient_type: 'tenant',
      recipient_id: tenant_id,
      title: 'Hợp đồng thuê phòng mới',
      message: `Hợp đồng thuê phòng ${room.room_number} đã sẵn sàng để bạn ký điện tử.`,
      type: 'contract',
      metadata: { contract_id: contract.id }
    });

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'CREATE_CONTRACT',
      entityType: 'contract',
      entityId: contract.id,
      newData: contract,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, contract, 'Tạo hợp đồng thành công.', 201);
  } catch (err) {
    console.error('[Create Contract Error]:', err);
    return errorResponse(res, 'Không thể tạo hợp đồng.', 'SERVER_ERROR', 500);
  }
};

export const updateDraftContract = async (req, res) => {
  try {
    const { id } = req.params;
    const contract = await contractRepo.findById(id);
    if (!contract) {
      return errorResponse(res, 'Không tìm thấy hợp đồng.', 'NOT_FOUND', 404);
    }
    if (contract.status === 'signed' || (contract.tenant_signature && contract.admin_signature)) {
      return errorResponse(
        res,
        'Hợp đồng đã hoàn tất ký 2 bên và đã khóa bảo mật, bên admin cũng không có quyền chỉnh sửa. Nếu có thay đổi, vui lòng xóa bỏ hợp đồng và tạo hợp đồng mới.',
        'CONTRACT_LOCKED',
        400
      );
    }

    const updated = await contractRepo.updateDraft(id, req.body);

    // Sync price updates to current readings and bills if applicable
    if (req.body.electricity_price !== undefined || req.body.water_price !== undefined || req.body.rent_amount !== undefined) {
      await syncContractPricingToReadingsAndBills(contract.room_id, req.body);
    }

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'UPDATE_CONTRACT_DRAFT',
      entityType: 'contract',
      entityId: id,
      oldData: contract,
      newData: updated,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, updated, 'Cập nhật hợp đồng thành công.');
  } catch (err) {
    console.error('[Update Draft Contract Error]:', err);
    return errorResponse(res, err.message || 'Không thể cập nhật hợp đồng.', 'SERVER_ERROR', 500);
  }
};

export const adminSignContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_signature } = req.body;
    if (!admin_signature) {
      return errorResponse(res, 'Vui lòng cung cấp chữ ký điện tử của chủ nhà.', 'BAD_REQUEST', 400);
    }

    const contract = await contractRepo.findById(id);
    if (!contract) {
      return errorResponse(res, 'Không tìm thấy hợp đồng.', 'NOT_FOUND', 404);
    }
    if (contract.status === 'signed' || (contract.tenant_signature && contract.admin_signature)) {
      return errorResponse(res, 'Hợp đồng này đã hoàn tất ký kết 2 bên và đã bị khóa bảo mật.', 'CONTRACT_LOCKED', 400);
    }

    const room = await roomRepo.findById(contract.room_id);
    const tenant = await userRepo.findById(contract.tenant_id);

    // If tenant already signed, both parties have now signed -> finalize, generate signed PDF and lock!
    if (contract.tenant_signature) {
      const contractWithBothSigs = {
        ...contract,
        admin_signature,
        tenant_signature: contract.tenant_signature,
        signed_ip: req.ip,
        signed_user_agent: req.get('User-Agent')
      };

      const pdfResult = await pdfService.generateSignedContractPDF(contractWithBothSigs, room, tenant);

      const updated = await contractRepo.updateDraft(id, {
        admin_signature,
        status: 'signed',
        document_hash: pdfResult.documentHash,
        contract_file_url: pdfResult.fileUrl,
        signed_at: new Date()
      });

      // Ensure room is occupied and tenant assigned
      await roomRepo.update(contract.room_id, { status: 'occupied' });
      await userRepo.update(contract.tenant_id, { room_id: contract.room_id });

      // Notify tenant
      await notificationRepo.create({
        recipient_type: 'tenant',
        recipient_id: contract.tenant_id,
        title: 'Hợp đồng đã hoàn tất ký 2 bên',
        message: `Chủ nhà đã ký hợp đồng phòng ${room?.room_number || contract.room_number}. Hợp đồng đã hoàn tất ký 2 bên và được khóa an toàn.`,
        type: 'contract',
        metadata: { contract_id: id }
      });

      await auditService.logAction({
        actorId: req.admin?.id,
        actorType: 'admin',
        action: 'SIGN_CONTRACT_FINALIZED',
        entityType: 'contract',
        entityId: id,
        newData: { status: 'signed', document_hash: pdfResult.documentHash },
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, {
        ...updated,
        document_hash: pdfResult.documentHash,
        contract_file_url: pdfResult.fileUrl
      }, 'Chủ nhà đã ký. Cả 2 bên đã hoàn tất ký kết, hợp đồng chính thức khóa bảo mật.');
    } else {
      // Tenant has not signed yet, record admin signature and mark pending_signature
      const updated = await contractRepo.updateDraft(id, {
        admin_signature,
        status: 'pending_signature'
      });

      // Notify tenant
      await notificationRepo.create({
        recipient_type: 'tenant',
        recipient_id: contract.tenant_id,
        title: 'Chủ nhà đã ký hợp đồng',
        message: `Chủ nhà đã ký hợp đồng phòng ${room?.room_number || contract.room_number}. Vui lòng kiểm tra và ký xác nhận.`,
        type: 'contract',
        metadata: { contract_id: id }
      });

      return successResponse(res, updated, 'Chủ nhà đã ký hợp đồng. Chờ người thuê ký để hoàn tất và khóa hợp đồng.');
    }
  } catch (err) {
    console.error('[Admin Sign Contract Error]:', err);
    return errorResponse(res, 'Không thể ký hợp đồng.', 'SERVER_ERROR', 500);
  }
};

export const tenantSignContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_signature } = req.body;
    if (!tenant_signature) {
      return errorResponse(res, 'Vui lòng ký tên vào khung chữ ký.', 'BAD_REQUEST', 400);
    }

    const contract = await contractRepo.findById(id);
    if (!contract) {
      return errorResponse(res, 'Không tìm thấy hợp đồng.', 'NOT_FOUND', 404);
    }

    // Verify ownership: tenant can only sign their own contract
    if (req.tenant && req.tenant.id !== contract.tenant_id) {
      return errorResponse(res, 'Bạn không có quyền ký hợp đồng của người khác.', 'FORBIDDEN', 403);
    }

    if (contract.status === 'signed' || (contract.tenant_signature && contract.admin_signature)) {
      return errorResponse(res, 'Hợp đồng này đã được ký kết 2 bên và đã bị khóa vĩnh viễn.', 'CONTRACT_ALREADY_SIGNED', 400);
    }

    const room = await roomRepo.findById(contract.room_id);
    const tenant = await userRepo.findById(contract.tenant_id);

    // If Admin already signed, both sides have now signed -> finalize, generate signed PDF and lock!
    if (contract.admin_signature) {
      const contractWithBothSigs = {
        ...contract,
        tenant_signature,
        admin_signature: contract.admin_signature,
        signed_ip: req.ip,
        signed_user_agent: req.get('User-Agent')
      };

      const pdfResult = await pdfService.generateSignedContractPDF(contractWithBothSigs, room, tenant);

      const signedContract = await contractRepo.signByTenant(id, {
        tenant_signature,
        signed_ip: req.ip,
        signed_user_agent: req.get('User-Agent'),
        document_hash: pdfResult.documentHash,
        contract_file_url: pdfResult.fileUrl
      });

      // Ensure room is occupied and tenant assigned
      await roomRepo.update(contract.room_id, { status: 'occupied' });
      await userRepo.update(contract.tenant_id, { room_id: contract.room_id });

      // Notify Admin
      await notificationRepo.create({
        recipient_type: 'admin',
        recipient_id: null,
        title: 'Hợp đồng hoàn tất ký 2 bên',
        message: `Người thuê ${tenant.full_name} đã hoàn tất ký hợp đồng phòng ${room.room_number}. Hợp đồng đã khóa bảo mật.`,
        type: 'contract',
        metadata: { contract_id: id }
      });

      await auditService.logAction({
        actorId: tenant.id,
        actorType: 'tenant',
        action: 'SIGN_CONTRACT_FINALIZED',
        entityType: 'contract',
        entityId: id,
        newData: {
          status: 'signed',
          document_hash: pdfResult.documentHash,
          signed_at: new Date()
        },
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, {
        ...signedContract,
        contract_file_url: pdfResult.fileUrl,
        document_hash: pdfResult.documentHash,
        landlord_phone: '0909256680'
      }, 'Ký hợp đồng thành công. Cả 2 bên đã hoàn tất chữ ký và hợp đồng đã được khóa bảo mật.');
    } else {
      // Admin hasn't signed yet! Tenant signed first.
      const updated = await contractRepo.updateDraft(id, {
        tenant_signature,
        signed_ip: req.ip,
        signed_user_agent: req.get('User-Agent'),
        status: 'pending_signature'
      });

      // Notify Admin
      await notificationRepo.create({
        recipient_type: 'admin',
        recipient_id: null,
        title: 'Người thuê đã ký hợp đồng',
        message: `Người thuê ${tenant.full_name} đã ký hợp đồng phòng ${room.room_number}. Vui lòng ký để hoàn tất và khóa hợp đồng.`,
        type: 'contract',
        metadata: { contract_id: id }
      });

      return successResponse(res, {
        ...updated,
        landlord_phone: '0909256680'
      }, 'Bạn đã ký hợp đồng thành công. Hợp đồng đang chờ bên chủ nhà ký để hoàn tất và khóa bảo mật.');
    }
  } catch (err) {
    console.error('[Tenant Sign Contract Error]:', err);
    return errorResponse(res, 'Không thể ký hợp đồng.', 'SERVER_ERROR', 500);
  }
};

export const reopenContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, end_date, rent_amount, clear_signatures, reason } = req.body;

    const contract = await contractRepo.findById(id);
    if (!contract) {
      return errorResponse(res, 'Không tìm thấy hợp đồng này.', 'NOT_FOUND', 404);
    }

    const previousStatus = contract.status;
    const updatedContract = await contractRepo.reopen(id, {
      status: status || 'pending_signature',
      end_date,
      rent_amount,
      clear_signatures: !!clear_signatures
    });

    if (rent_amount !== undefined && rent_amount !== null) {
      await syncContractPricingToReadingsAndBills(contract.room_id, { rent_amount });
    }

    // Send notification to tenant
    await notificationRepo.create({
      recipient_type: 'tenant',
      recipient_id: contract.tenant_id,
      title: 'Hợp đồng được mở lại',
      message: `Hợp đồng thuê phòng ${contract.room_number} đã được mở lại bởi Ban Quản Lý${reason ? ` (Lý do: ${reason})` : ''}.`,
      type: 'contract',
      metadata: { contract_id: id, previous_status: previousStatus, new_status: updatedContract?.status }
    });

    // Log in audit trail
    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'REOPEN_CONTRACT',
      entityType: 'contract',
      entityId: id,
      oldData: { status: previousStatus, end_date: contract.end_date, rent_amount: contract.rent_amount },
      newData: {
        status: updatedContract?.status,
        end_date: updatedContract?.end_date,
        rent_amount: updatedContract?.rent_amount,
        clear_signatures,
        reason
      },
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, updatedContract, 'Mở lại hợp đồng thành công.');
  } catch (err) {
    console.error('[Reopen Contract Error]:', err);
    return errorResponse(res, 'Không thể mở lại hợp đồng.', 'SERVER_ERROR', 500);
  }
};

export const deleteContract = async (req, res) => {
  try {
    const { id } = req.params;
    const contract = await contractRepo.findById(id);
    if (!contract) {
      return errorResponse(res, 'Không tìm thấy hợp đồng để xóa.', 'NOT_FOUND', 404);
    }

    const deleted = await contractRepo.deleteById(id);

    // If no remaining active contract or active tenant in room, revert room status to available
    const remainingContract = await contractRepo.findActiveByRoom(contract.room_id);
    if (!remainingContract) {
      if (isPostgresActive()) {
        const uRes = await query(
          'SELECT id FROM users WHERE room_id = $1 AND deleted_at IS NULL AND status = $2',
          [contract.room_id, 'active']
        );
        if (uRes.rows.length === 0) {
          await roomRepo.update(contract.room_id, { status: 'available' });
        }
      }
    }

    // Notify tenant if contract was deleted
    if (contract.tenant_id) {
      await notificationRepo.create({
        recipient_type: 'tenant',
        recipient_id: contract.tenant_id,
        title: 'Hợp đồng thuê đã bị xóa bỏ',
        message: `Hợp đồng số ${contract.contract_number} (phòng ${contract.room_number || ''}) đã bị xóa bỏ bởi Quản trị viên để thỏa thuận lại hoặc lập hợp đồng mới.`,
        type: 'contract',
        metadata: { contract_number: contract.contract_number, room_id: contract.room_id }
      });
    }

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'DELETE_CONTRACT',
      entityType: 'contract',
      entityId: id,
      oldData: contract,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, deleted, 'Đã xóa bỏ hợp đồng thành công. Bạn có thể tạo hợp đồng mới.');
  } catch (err) {
    console.error('[Delete Contract Error]:', err);
    return errorResponse(res, 'Không thể xóa hợp đồng.', 'SERVER_ERROR', 500);
  }
};

