import api from "./baseAPI";

const scanService = {
  scan: (labId, invoiceId) => api.get(`/scan/${labId}/${invoiceId}`),
};

export default scanService;
