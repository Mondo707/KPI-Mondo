// Filial bo'yicha ruxsat: foydalanuvchining allowed_spots ro'yxati bo'sh bo'lsa - barcha
// filiallar (admin yoki cheklanmagan foydalanuvchi), aks holda faqat ro'yxatdagilar.
function canAccessSpot(user, spotId) {
  const allowed = (user && user.allowed_spots) || [];
  return allowed.length === 0 || allowed.includes(Number(spotId));
}

// Ruxsat bo'lmasa 403 qaytaradi va false chiqaradi (handler ichida: if (!ensureSpotAccess(...)) return;)
function ensureSpotAccess(req, res, spotId) {
  if (canAccessSpot(req.user, spotId)) return true;
  res.status(403).json({ error: 'Bu filialga ruxsatingiz yo\'q' });
  return false;
}

module.exports = { canAccessSpot, ensureSpotAccess };
