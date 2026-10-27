(function (root) {
  const services = [
    { id: "ke-toan-tron-goi", name: "Kế toán trọn gói", page: "ke-toan-thue-doanh-nghiep.html" },
    { id: "soat-xet-bctc", name: "Soát xét báo cáo tài chính", page: "soat-xet-bao-cao-tai-chinh.html" },
    { id: "bhxh-tien-luong", name: "Cố vấn nhân sự & bảo hiểm", page: "lien-he.html?service=bhxh-tien-luong" },
    { id: "thu-tuc-phap-ly", name: "Hành chính & pháp lý", page: "dich-vu.html#dich-vu-phap-ly" },
    { id: "thu-tuc-thue", name: "Thủ tục thuế", page: "dich-vu.html#dich-vu-thu-tuc-thue" },
    { id: "ke-toan-noi-bo-tai-chinh", name: "Kế toán nội bộ & tài chính", page: "lien-he.html?service=ke-toan-noi-bo-tai-chinh" },
    { id: "dich-vu-so-ho-tro-khac", name: "Dịch vụ chữ ký số và dịch vụ khác", page: "dich-vu-chu-ky-so-va-dich-vu-khac.html" },
  ];
  const catalog = { services, label: (value) => services.find((item) => item.id === value)?.name || value || "Không cung cấp" };
  if (typeof module === "object" && module.exports) module.exports = catalog;
  else root.NHTServices = catalog;
})(typeof globalThis === "object" ? globalThis : this);
