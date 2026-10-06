// Express 4 async so'rovlardagi xatolarni (rejected promise) o'zi ushlamaydi: ular "ushlanmagan xato"ga
// aylanib, butun serverni to'xtatishi mumkin. Bu fayl har bir marshrut ishlovchisining natijasini
// kuzatadi va xato bo'lsa uni umumiy xato ushlagichga (server.js oxirida) uzatadi - server yiqilmaydi,
// foydalanuvchi 500 javobini oladi. Tashqi paket kerak emas (Express 5'da bu o'zi ishlaydi).
const Layer = require('express/lib/router/layer');

if (!Layer.prototype.__asyncErrorsPatched) {
  Layer.prototype.handle_request = function handle_request(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next(); // xato ushlagichlari bu yerda emas
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };
  Layer.prototype.__asyncErrorsPatched = true;
}
