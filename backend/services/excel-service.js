const ExcelJS = require("exceljs");

function toVietnamExcelDate(value) {
  if (!value) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(value)).map((part) => [part.type, part.value])
  );
  return new Date(Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  ));
}

async function createLeadsWorkbook(leads) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Công ty TNHH Dịch vụ Tư vấn NHT";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Yêu cầu tư vấn", {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { defaultRowHeight: 22 },
  });

  worksheet.columns = [
    { header: "STT", key: "number", width: 8 },
    { header: "Thời gian gửi", key: "createdAt", width: 22 },
    { header: "Họ và tên", key: "name", width: 24 },
    { header: "Số điện thoại", key: "phone", width: 18 },
    { header: "Email", key: "email", width: 32 },
    { header: "Tên công ty", key: "company", width: 28 },
    { header: "Mã số thuế/CCCD", key: "taxCode", width: 20 },
    { header: "Dịch vụ quan tâm", key: "service", width: 28 },
    { header: "Lời nhắn", key: "message", width: 48 },
    { header: "Trạng thái xử lý", key: "processingStatus", width: 20 },
    { header: "Ngày hoàn thành", key: "completedAt", width: 22 },
    { header: "Người phụ trách", key: "assignee", width: 24 },
    { header: "Ghi chú nội bộ", key: "internalNote", width: 40 },
    { header: "Email khách hàng", key: "customerMailStatus", width: 20 },
    { header: "Email quản trị", key: "adminMailStatus", width: 20 },
  ];

  leads.forEach((lead, index) => worksheet.addRow({
    number: index + 1,
    createdAt: toVietnamExcelDate(lead.createdAt),
    name: lead.name || "Không cung cấp",
    phone: lead.phone || "Không cung cấp",
    email: lead.email || "Không cung cấp",
    company: lead.company || "Không cung cấp",
    taxCode: lead.taxCode || "Không cung cấp",
    service: lead.service || "Không cung cấp",
    message: lead.message || "Không có lời nhắn",
    processingStatus: lead.processingStatus === "completed" ? "Đã hoàn thành" : lead.processingStatus === "in_progress" ? "Đang xử lý" : "Mới",
    completedAt: toVietnamExcelDate(lead.completedAt),
    assignee: null,
    internalNote: null,
    customerMailStatus: lead.customerMailStatus || "Không xác định",
    adminMailStatus: lead.adminMailStatus || "Không xác định",
  }));

  const border = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };
  const header = worksheet.getRow(1);
  header.height = 30;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE05915" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.eachCell((cell) => { cell.border = border; });

  worksheet.autoFilter = { from: "A1", to: "O1" };
  worksheet.getColumn("createdAt").numFmt = "dd-mm-yyyy hh:mm";
  worksheet.getColumn("completedAt").numFmt = "dd-mm-yyyy hh:mm";
  worksheet.getColumn("number").alignment = { horizontal: "center", vertical: "top" };
  if (leads.length) {
    worksheet.getCell("J2").dataValidation = {
      type: "list", allowBlank: false, formulae: ['"Mới,Đang xử lý,Đã hoàn thành"'],
    };
    for (let rowNumber = 3; rowNumber <= leads.length + 1; rowNumber += 1) {
      worksheet.getCell(`J${rowNumber}`).dataValidation = worksheet.getCell("J2").dataValidation;
    }
  }
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell({ includeEmpty: true }, (cell) => { cell.border = border; });
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = { createLeadsWorkbook };
