import api from "./baseAPI";

const scanService = {
  scan: (labId, invoiceId) => api.get(`/scan/${labId}/${invoiceId}`),
  getReport: (labId, invoiceId, testId) => api.get(`/scan/${labId}/${invoiceId}/report/${testId}`),
};

export default scanService;
