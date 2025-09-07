export const baseUrl = localStorage.getItem('originOverride') || window.location.origin;
export const baseApiUrl = `${baseUrl}/api`;
