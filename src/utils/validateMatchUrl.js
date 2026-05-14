const ALLOWED_HOSTS = ['cricclubs.com', 'www.cricclubs.com'];

function isAllowedHost(hostname) {
  if (!hostname) {
    return false;
  }

  const normalized = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((host) => normalized === host || normalized.endsWith(`.${host}`));
}

function validateMatchUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return { valid: false, reason: 'url parameter required' };
  }

  if (value.length > 2048) {
    return { valid: false, reason: 'url is too long' };
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    return { valid: false, reason: 'url is not valid' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: 'url protocol must be http or https' };
  }

  if (!isAllowedHost(parsed.hostname)) {
    return { valid: false, reason: 'url host must be a CricClubs domain' };
  }

  return { valid: true, url: parsed.toString() };
}

module.exports = {
  validateMatchUrl
};
