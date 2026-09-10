(function (root) {
  const services = [
    { id: "ke-toan-tron-goi", name: "Kế toán trọn gói", page: "ke-toan-tron-goi.html" },
    { id: "soat-xet-bctc", name: "Soát xét báo cáo tài chính", page: "soat-xet-bao-cao-tai-chinh.html" },
    { id: "bhxh-tien-luong", name: "Cố vấn nhân sự & bảo hiểm", page: "co-van-nhan-su-bao-hiem.html" },
    { id: "thu-tuc-phap-ly", name: "Hành chính & pháp lý", page: "hanh-chinh-phap-ly.html" },
    { id: "ke-toan-noi-bo-tai-chinh", name: "Kế toán nội bộ & tài chính", page: "ke-toan-noi-bo-tai-chinh.html" },
    { id: "dich-vu-so-ho-tro-khac", name: "Dịch vụ số & hỗ trợ khác", page: "dich-vu-so-ho-tro-khac.html" },
  ];
  const catalog = { services, label: (value) => services.find((item) => item.id === value)?.name || value || "Không cung cấp" };
  if (typeof module === "object" && module.exports) module.exports = catalog;
  else root.NHTServices = catalog;
})(typeof globalThis === "object" ? globalThis : this);
