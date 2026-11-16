const rateLimit = require('express-rate-limit');

const options = (max, windowMinutes, error) => ({
  windowMs: windowMinutes * 60 * 1000,
  limit: max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error },
});

// Tentativas de login por IP (dificulta adivinhar senha)
const loginLimiter = rateLimit(options(10, 15, 'Muitas tentativas de login. Tente novamente em alguns minutos.'));

// Envio de leads pela landing page por IP (dificulta spam)
const leadLimiter = rateLimit(options(20, 60, 'Muitos envios. Tente novamente mais tarde.'));

// Auto-cadastro de usuários por IP (dificulta criação em massa)
const registroLimiter = rateLimit(options(5, 60, 'Muitos cadastros a partir desta rede. Tente novamente mais tarde.'));

module.exports = { loginLimiter, leadLimiter, registroLimiter };
