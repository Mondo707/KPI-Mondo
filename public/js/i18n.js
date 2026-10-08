// Til almashtirish (O'zbekcha <-> Ruscha) - butun sayt uchun.
//
// Sahifalardagi matnlar o'zbekcha yozilgan. Ruscha tanlanganda bu fayl sahifadagi matnlarni
// (jumladan JavaScript keyinroq chizadigan jadval, xabar, tugmalarni ham) lug'at bo'yicha
// ruschaga o'giradi. O'zbekchaga qaytilganda asl matn tiklanadi. Til brauzerda (kpi_lang)
// saqlanadi. Filial/kategoriya/mahsulot nomlari lug'atda yo'q, shuning uchun o'zgarmaydi.
(function () {
  'use strict';

  var DICT = {
"KPI": "KPI",
"Kunlik savdo": "Продажи по дням",
"Bonus jadvali": "Таблица бонусов",
"Kassa kiritish": "Ввод кассы",
"Portsiya": "Порции",
"Savdo": "Продажи",
"Kirish tarixi": "История входов",
"Admin panel": "Админ-панель",
"Chiqish": "Выход",
"Tungi rejim": "Ночной режим",
"Kunduzgi rejim": "Дневной режим",
"✕ Yopish": "✕ Закрыть",
"Sessiya tugagan": "Сессия завершена",
"Yuklanmoqda...": "Загрузка...",
"Yuklashda xato:": "Ошибка загрузки:",
"Yuklab bo'lmadi": "Не удалось загрузить",
"Ma'lumot topilmadi": "Данные не найдены",
"Ma'lumot yuklashda xato:": "Ошибка загрузки данных:",
"Bu davr uchun ma'lumot yo'q": "Нет данных за этот период",
"Yozuv topilmadi": "Запись не найдена",
"so'm": "сум",
"Sana": "Дата",
"Sanadan": "С даты",
"Sanagacha": "По дату",
"Sana oralig'ini tanlang": "Выберите период",
"Filial": "Филиал",
"Filiallar": "Филиалы",
"Barchasi": "Все",
"Barcha filiallar": "Все филиалы",
"Barchasi (ruxsatingiz bor filiallar)": "Все (доступные вам филиалы)",
"Filialni tanlang": "Выберите филиал",
"Filial va sanani tanlang": "Выберите филиал и дату",
"Qo'llash": "Применить",
"Qidirish": "Найти",
"Ko'rsatish": "Показать",
"Yuborish": "Отправить",
"Saqlash": "Сохранить",
"Qo'shish": "Добавить",
"Tahrirlash": "Редактировать",
"O'chirish": "Удалить",
"Yangilash": "Обновить",
"Yuklash": "Загрузить",
"Amallar": "Действия",
"Faol": "Активна",
"Faolsiz": "Неактивен",
"Rol": "Роль",
"Login": "Логин",
"Parol": "Пароль",
"Kirish": "Войти",
"Login xato": "Неверный логин",
"KPI Bonus tizimiga kirish": "Вход в систему KPI Бонус",
"📲 Ilova sifatida o'rnating": "📲 Установите как приложение",
"Tezroq ochilish va qulay foydalanish uchun": "Для быстрого запуска и удобной работы",
"📲 Bosh ekranga qo'shing": "📲 Добавьте на главный экран",
"Pastdagi 📤 (Share) tugmasini bosing, so'ng \"Add to Home Screen\"ni tanlang": "Нажмите кнопку 📤 (Поделиться) внизу, затем выберите «На экран “Домой”»",
"BONUS HISOB-KITOBI": "РАСЧЁТ БОНУСА",
"Bonus": "Бонус",
"Bonus holati —": "Статус бонуса —",
"Jami bonus": "Итого бонус",
"Hisoblangan jami": "Всего начислено",
"Yozuvlar soni": "Количество записей",
"Berildi": "Выдан",
"Berilmadi": "Не выдан",
"To'landi": "Выплачен",
"To'lanmadi (kassa farqi)": "Не выплачен (разница по кассе)",
"Tekshirilmagan": "Не проверено",
"Tekshiruv kutilmoqda": "Ожидает проверки",
"Bonus to'lanadi": "Бонус выплачивается",
"Bonusning bir qismi to'lanmaydi": "Часть бонуса не выплачивается",
"Kassa kiritilmagan": "Касса не введена",
"Kassa kiritilgan, Poster bilan solishtirish kutilmoqda": "Касса введена, ожидается сверка с Poster",
"Kassa farqi chegaradan oshgan": "Разница по кассе превышает лимит",
"Berilmagan va tekshirilmagan kunlar": "Дни без выплаты и непроверенные дни",
"Kategoriyalar bo'yicha progress —": "Прогресс по категориям —",
"Mahsulot kategoriyasi": "Категория продукции",
"Keyingi pog'onaga yetdi!": "Следующая ступень достигнута!",
"Maksimal pog'ona": "Максимальная ступень",
"Pog'ona yo'q": "Нет ступени",
"Pog'ona jadvalini yuklab bo'lmadi:": "Не удалось загрузить таблицу ступеней:",
"Kunlik bonus jurnali —": "Журнал бонусов по дням —",
"Sabab": "Причина",
"Tanlangan davr:": "Выбранный период:",
"Bu davrda sotuv qayd etilmagan": "За этот период продаж нет",
"Bu davr uchun yozuv yo'q": "Нет записей за этот период",
"Chekni yuklashda xato:": "Ошибка загрузки чека:",
"Jurnalni yuklashda xato:": "Ошибка загрузки журнала:",
"Tanlangan davr uchun hisoblangan bonus qanday taqsimlangani. Kassa Poster bilan solishtirilgandan keyin \"Berildi\" yoki \"Berilmadi\" bo'ladi.": "Как распределён начисленный бонус за выбранный период. После сверки кассы с Poster статус станет «Выдан» или «Не выдан».",
"Har bir kun uchun jami bonus (faqat \"To'landi\" kunlar yig'indiga kiradi) va kassa holati. Sana ustiga bosing — yuqorida shu kunlik chek ko'rinadi.": "Итоговый бонус за каждый день (в сумму входят только дни со статусом «Выплачен») и статус кассы. Нажмите на дату — выше откроется чек за этот день.",
"Kunlik savdo — KPI Bonus": "Продажи по дням — KPI Бонус",
"Har bir filial bo'yicha, har bir kategoriyadan qancha sotilgani (dona/kg). Bonus bu yerda hisobga olinmaydi.": "Сколько продано по каждой категории в каждом филиале (шт/кг). Бонус здесь не учитывается.",
"Savdo — KPI Bonus": "Продажи — KPI Бонус",
"Jami savdo (davr)": "Всего продаж (период)",
"O'rtacha kunlik savdo": "Средние продажи в день",
"Eng yuqori kun": "Лучший день",
"Eng past kun": "Худший день",
"Kunlik savdo dinamikasi": "Динамика продаж по дням",
"Savdo jurnali": "Журнал продаж",
"Umumiy kassa": "Общая касса",
"Bu yerda xodimlar kiritgan umumiy kassa ko'rsatiladi (Poster bilan solishtirishdagi smena farqisiz), shuning uchun Kassa bo'limidagi \"Umumiy kassa\"dan farq qilishi mumkin.": "Здесь показана общая касса, введённая сотрудниками (без разницы по смене при сверке с Poster), поэтому она может отличаться от «Общей кассы» в разделе «Касса».",
"Kassa kiritish — KPI Bonus": "Ввод кассы — KPI Бонус",
"Kassadagi naqd pulni kupyura bo'yicha sanab kiriting": "Пересчитайте наличные в кассе по купюрам",
"Kupyuralar": "Купюры",
"Naqd pulsiz to'lovlar va boshqa kanallar": "Безналичные платежи и другие каналы",
"To'lov turlari": "Виды оплаты",
"To'lov turlari yig'indisi": "Сумма по видам оплаты",
"+ To'lov turlari": "+ Виды оплаты",
"Kunlik xarajatlar (masalan yetkazib berish, ta'mirlash va h.k.)": "Ежедневные расходы (например, доставка, ремонт и т.д.)",
"+ Rasxod qo'shish": "+ Добавить расход",
"Rasxod nomi": "Название расхода",
"Masalan: Kuryer xizmati": "Например: Курьерская служба",
"Rasxodlar": "Расходы",
"Umumiy rasxod (Общие Расходы)": "Общие расходы",
"+ Umumiy rasxod": "+ Общий расход",
"Tоза (naqd)": "Чистая (наличные)",
"Tоза (sanalgan naqd)": "Чистая (пересчитанные наличные)",
"Pechat qilish": "Печать",
"USB orqali chop etish": "Печать через USB",
"Printerni ulash (USB)": "Подключить принтер (USB)",
"Printer tanlanmadi": "Принтер не выбран",
"Printer ulandi! Endi \"USB orqali chop etish\" tugmasidan foydalanishingiz mumkin.": "Принтер подключён! Теперь можно пользоваться кнопкой «Печать через USB».",
"Chop etilmoqda...": "Идёт печать...",
"Chek printerga yuborildi": "Чек отправлен на принтер",
"USB orqali chop etishda xato:": "Ошибка печати через USB:",
"Ulanishda xato:": "Ошибка подключения:",
"Bu kun uchun ma'lumot allaqachon yuborilgan": "Данные за этот день уже отправлены",
"Excel'ga yuklab olish": "Скачать в Excel",
"Excel eksportida xato:": "Ошибка экспорта в Excel:",
"Fakt": "Факт",
"Farq": "Разница",
"Umumiy farq": "Общая разница",
"Farq bor": "Есть разница",
"Mos": "Совпадает",
"Kutilmoqda": "Ожидается",
"Hali qulflangan": "Пока заблокировано",
"Hisoblanmoqda": "Вычисляется",
"Hali yozuv yo'q": "Записей пока нет",
"Bonus bekor qilindi": "Бонус отменён",
"Bonus saqlanadi": "Бонус сохраняется",
"Poster": "Poster",
"Poster bilan solishtirish": "Сверка с Poster",
"Poster bilan solishtirish hali hisoblanmagan": "Сверка с Poster ещё не рассчитана",
"Solishtirish uchun avval ma'lumot yuboring.": "Для сверки сначала отправьте данные.",
"Ma'lumotlarni yuborgandan so'ng, 6 soatdan keyin shu yerda ko'rinadi.": "После отправки данных результат появится здесь через 6 часов.",
"Filiallar bo'yicha farq hisoboti": "Отчёт по разнице по филиалам",
"Bir nechta filialni birga tanlab, ularning Poster bilan \"Umumiy kassa\" farqini solishtiring.": "Выберите несколько филиалов и сравните их разницу по «Общей кассе» с Poster.",
"Filiallar ro'yxatini yuklab bo'lmadi. Sahifani yangilab ko'ring:": "Не удалось загрузить список филиалов. Обновите страницу:",
"Hisobotni yuklashda xato:": "Ошибка загрузки отчёта:",
"O'rtacha/kun": "В среднем в день",
"Kassa jurnali —": "Журнал кассы —",
"Farq jurnali —": "Журнал разницы —",
"Farq jurnalini yuklashda xato:": "Ошибка загрузки журнала разницы:",
"Har bir kun uchun umumiy kassa. Sana ustiga bosing — yuqoridagi forma shu kun ma'lumotlari bilan to'ladi.": "Общая касса за каждый день. Нажмите на дату — форма выше заполнится данными этого дня.",
"Har bir kun uchun Poster bilan solishtirilgan umumiy farq tarixi. Qizil \"-\" — Fakt Posterdan ko'p, sariq — Fakt Posterdan kam.": "История общей разницы с Poster по дням. Красный «-» — Факт больше, чем в Poster; жёлтый — Факт меньше, чем в Poster.",
"⚠ Smena hali yopilmagan — smena farqi hisobga olinmadi, natija to'liq aniq bo'lmasligi mumkin": "⚠ Смена ещё не закрыта — разница по смене не учтена, результат может быть неточным",
"filialda qoldirilgan pul, hisobga olindi": "деньги оставлены в филиале, учтено",
"float'dan sarflangan, ayirildi": "потрачено из размена (float), вычтено",
"↳ Тоза + Rasxod + Инкассация + Smena farqi:": "↳ Чистая + Расход + Инкассация + Разница по смене:",
"Portsiya — KPI Bonus": "Порции — KPI Бонус",
"Portsiya — qoldiqni kiritish": "Порции — ввод остатка",
"Savdo to'xtagandan keyin, ingredientlarning haqiqiy qoldig'ini tarozida o'lchab kiriting.": "После окончания продаж взвесьте и введите фактический остаток ингредиентов.",
"Ingredient": "Ингредиент",
"kg": "кг",
"Kamida bitta qiymat kiriting": "Введите хотя бы одно значение",
"Bu kun uchun ma'lumot hali kiritilmagan.": "За этот день данные ещё не введены.",
"Bu kun uchun allaqachon yuborilgan. Faqat admin qayta tahrirlashi mumkin.": "За этот день данные уже отправлены. Изменить может только администратор.",
"Bitta kun tanlansa - shu kungi farq. Davr tanlansa - davr ichidagi umumiy va o'rtacha kunlik farq.": "Если выбран один день — разница за этот день. Если выбран период — общая и средняя дневная разница за период.",
"Xodim kiritgan (Fakt) va Poster'dagi qoldiq (kiritilgan kunning oxiriga, 24:00 holatiga). Tun yarimdan keyin yopiladigan filiallarda kichik farq bo'lishi mumkin.": "Введено сотрудником (Факт) и остаток в Poster (на конец дня ввода, на 24:00). В филиалах, закрывающихся после полуночи, возможна небольшая разница.",
"Bonus jadvali — KPI Bonus": "Таблица бонусов — KPI Бонус",
"Har bir kategoriya bo'yicha, qancha sotilsa qanday bonus tegishi ko'rsatilgan. Bu jadval faqat ko'rish uchun.": "По каждой категории показано, какой бонус положен за какой объём продаж. Таблица только для просмотра.",
"Kirish tarixi — KPI Bonus": "История входов — KPI Бонус",
"Foydalanuvchi": "Пользователь",
"Kirish vaqti": "Время входа",
"Oxirgi faollik": "Последняя активность",
"Davomiyligi": "Длительность",
"Hozir ochiq": "Сейчас открыто",
"Fonda": "В фоне",
"Yopilgan": "Закрыта",
"Foydalanuvchilarni yuklashda xato:": "Ошибка загрузки пользователей:",
"Kirish tarixini yuklashda xato:": "Ошибка загрузки истории входов:",
"Har bir foydalanuvchi qachon tizimga kirgani, sayt qancha vaqt ochiq turgani va hozir qanday holatdaligini ko'rish uchun. Bitta kun tanlansa (Sanadan = Sanagacha), faqat shu kun (Toshkent vaqti, 00:00–24:00) chiqadi.": "Показывает, когда каждый пользователь входил в систему, как долго был открыт сайт и в каком он сейчас состоянии. Если выбран один день (С даты = По дату), показывается только этот день (время Ташкента, 00:00–24:00).",
"sahifa ekranda ko'rinib turgan vaqt": "время, когда страница была на экране",
"sahifa ochiq, lekin ekranda ko'rinmagan vaqt (boshqa ilova yoki ekran o'chgan)": "время, когда страница была открыта, но не на экране (другое приложение или экран выключен)",
"Telefonda ekran o'chganda brauzer signalni to'xtatishi mumkin, shuning uchun \"Fonda\" va \"Yopilgan\" holatlari taxminiy. Signal tizimi qo'shilishidan oldingi kirishlar uchun bu ustunlar bo'sh.": "При выключенном экране телефона браузер может остановить сигнал, поэтому статусы «В фоне» и «Закрыта» приблизительные. Для входов до добавления сигнала эти столбцы пусты.",
"Admin panel — KPI Bonus": "Админ-панель — KPI Бонус",
"Foydalanuvchilar ro'yxati": "Список пользователей",
"Yangi foydalanuvchi qo'shish": "Добавить пользователя",
"Yangi foydalanuvchi yaratildi": "Новый пользователь создан",
"Ko'ruvchi (viewer)": "Наблюдатель (viewer)",
"Ruxsat etilgan filiallar (hech biri belgilanmasa = hammasi)": "Доступные филиалы (если ничего не отмечено — все)",
"Ko'ra oladigan bo'limlar": "Доступные разделы",
"Bo'limlar": "Разделы",
"Bo'limlar yangilandi": "Разделы обновлены",
"Filiallar yangilandi": "Филиалы обновлены",
"Hali kirmagan": "Ещё не входил",
"Yaratilgan": "Создан",
"Oxirgi kirish": "Последний вход",
"Parol tiklash": "Сбросить пароль",
"Parol yangilandi": "Пароль обновлён",
"Parol juda qisqa": "Пароль слишком короткий",
"Yangi parolni kiriting (kamida 4 belgi):": "Введите новый пароль (минимум 4 символа):",
"Login va parol kiritilishi shart": "Логин и пароль обязательны",
"Bu foydalanuvchini butunlay o'chirasizmi? Bu amalni orqaga qaytarib bo'lmaydi.": "Удалить этого пользователя навсегда? Это действие нельзя отменить.",
"Bu foydalanuvchini faolsizlantirasizmi? U tizimga kira olmaydi.": "Деактивировать этого пользователя? Он не сможет войти в систему.",
"Bu foydalanuvchini qayta faollashtirasizmi?": "Активировать этого пользователя снова?",
"Kassa farqi chegarasi (bonus qoidasi)": "Лимит разницы по кассе (правило бонуса)",
"Chegara (%)": "Лимит (%)",
"(Наличные + Безналичные + Сертификат jami) farqi shu foizdan katta bo'lsa, o'sha kun uchun bonus avtomatik bekor qilinadi.": "Если разница (Наличные + Безналичные + Сертификат, итого) превышает этот процент, бонус за этот день автоматически отменяется.",
"Hozirgi qiymat:": "Текущее значение:",
"To'g'ri qiymat kiriting": "Введите корректное значение",
"Bonus jadvalini sozlash": "Настройка таблицы бонусов",
"Filial bo'yicha kategoriya sozlamalari": "Настройки категорий по филиалам",
"Ba'zi kategoriyalar ma'lum filialga tegishli bo'lmasligi mumkin — shu yerda o'sha filial uchun yashirib (o'chirib) qo'yishingiz mumkin. O'chirilgan kategoriya o'sha filial uchun bonusga umuman hisoblanmaydi.": "Некоторые категории могут не относиться к определённому филиалу — здесь их можно скрыть (отключить) для этого филиала. Отключённая категория вообще не учитывается в бонусе этого филиала.",
"Mahsulotlarni kategoriyaga bog'lash": "Привязка продуктов к категориям",
"Poster'da yangi mahsulot qo'shilsa, u avtomatik hech qaysi bonus kategoriyasiga tushmaydi. Shu yerda kategoriyasini tanlab \"Saqlash\"ni bossangiz, u darhol KPI va Kunlik savdo statistikasiga qo'shiladi.": "Если в Poster добавлен новый продукт, он автоматически не попадает ни в одну категорию бонуса. Выберите здесь категорию и нажмите «Сохранить» — продукт сразу появится в статистике KPI и «Продажи по дням».",
"Mahsulotlar topilmadi": "Продукты не найдены",
"Barcha mahsulotlar": "Все продукты",
"Faqat bog'lanmaganlar": "Только непривязанные",
"Bog'lanmagan": "Не привязан",
"Hammasi bog'langan": "Всё привязано",
"Qo'lda bog'langan": "Привязан вручную",
"Nomdan avtomatik": "Автоматически (по названию)",
"Avtomatik": "Автоматически",
"Kategoriya": "Категория",
"Kategoriyani tanlang": "Выберите категорию",
"Kanal": "Канал",
"Kanal tanlang": "Выберите канал",
"To'lov turi xaritasi (UZCARD": "Сопоставление видов оплаты (UZCARD",
"HUMO": "HUMO",
"Uz Qr Kod": "Uz Qr Kod",
"Click": "Click",
"Payme": "Payme",
"Uzum": "Uzum",
"Alif": "Alif",
"Paynet)": "Paynet)",
"Poster'dagi karta to'lovlarini aniq kanalga bog'lash uchun. Avval \"Aniqlash\" tugmasini bosing — so'nggi kunlardagi tranzaksiyalarda qanday to'lov usuli kodlari uchraganini ko'rasiz, so'ng har biriga mos kanalni tanlang.": "Чтобы привязать карточные платежи из Poster к конкретному каналу. Сначала нажмите «Определить» — увидите, какие коды способов оплаты встречались в последних транзакциях, затем выберите подходящий канал для каждого.",
"Aniqlash": "Определить",
"Hozirgi xarita": "Текущее сопоставление",
"Hali hech narsa sozlanmagan": "Пока ничего не настроено",
"Poster klient xaritasi (Yandex eats": "Сопоставление клиентов Poster (Yandex eats",
"Jiz-Biz restaurant)": "Jiz-Biz restaurant)",
"Poster'da bu kanallar alohida \"mijoz\" (client) sifatida qayd etiladi. Shu kanalning Poster'dagi client_id raqamini kiriting — shunda kassa solishtirishda aniq hisoblanadi. Odatda bu ID'lar butun akkauntda bir xil bo'ladi, shuning uchun \"Barchasi (global)\" ni tanlab bir marta kiriting.": "В Poster эти каналы ведутся как отдельные «клиенты» (client). Введите client_id этого канала из Poster — тогда сверка кассы будет точной. Обычно эти ID одинаковы для всего аккаунта, поэтому выберите «Все (глобально)» и введите один раз.",
"Yandex eats — Poster client_id": "Yandex eats — Poster client_id",
"Jiz-Biz restaurant — Poster client_id": "Jiz-Biz restaurant — Poster client_id",
"Barchasi (global - tavsiya etiladi)": "Все (глобально — рекомендуется)",
"Filial (ixtiyoriy, bo'sh = barchasi)": "Филиал (необязательно, пусто = все)",
"Klient xaritasi saqlandi": "Сопоставление клиентов сохранено",
"agar Poster hisobingizda bu maydon berilmasa, bo'sh chiqishi mumkin — …": "если в вашем аккаунте Poster это поле не заполняется, оно может быть пустым — в этом случае все карточные платежи остаются в строке «Карточки» (не определено); система работает корректно, просто нет разбивки по каналам.",
"Portsiya ingredientlari": "Ингредиенты для порций",
"Смесь/Шарик bilan cheklanmaydi — xohlagancha ingredient qo'shishingiz mumkin. Har biri xodimlar \"Portsiya\" formasida avtomatik chiqadi.": "Не ограничивается Смесь/Шарик — можно добавить любое количество ингредиентов. Каждый автоматически появится в форме «Порции» у сотрудников.",
"+ Yangi ingredient qo'shish": "+ Добавить ингредиент",
"Nomi (xodimlarga ko'rinadi)": "Название (видно сотрудникам)",
"Nomi (xodimlarga qanday ko'rinsin)": "Название (как будет видно сотрудникам)",
"Poster ingredienti": "Ингредиент Poster",
"Poster'dagi ingredient": "Ингредиент Poster",
"Nomi va Poster ingredientini tanlang": "Укажите название и выберите ингредиент Poster",
"Hali ingredient qo'shilmagan": "Ингредиенты ещё не добавлены",
"Bu ingredientni o'chirasizmi? Xodimlar formasidan ham yo'qoladi.": "Удалить этот ингредиент? Он также исчезнет из формы сотрудников.",
"Portsiya yozuvlari": "Записи по порциям",
"Xodimlar kiritgan Portsiya ma'lumotlarini bu yerdan tahrirlash yoki o'chirish mumkin.": "Данные по порциям, введённые сотрудниками, можно редактировать или удалять здесь.",
"Bu Portsiya yozuvini o'chirasizmi?": "Удалить эту запись по порциям?",
"Bu kassa yozuvini o'chirasizmi?": "Удалить эту запись кассы?",
"Kim kiritgan": "Кто ввёл",
"Admin tomonidan tahrirlangan": "Отредактировано администратором",
"Tarixiy ma'lumotlarni yuklash (backfill)": "Загрузка исторических данных (backfill)",
"Tizim har bir kunni Poster'dan avtomatik faqat \"bugungi kun\" uchun oladi. Eski sanalarni ko'rish uchun birinchi marta shu yerdan sinxronlab qo'ying (bir martalik amal, keyin doim bazada saqlanadi).": "Система автоматически получает из Poster только данные «за сегодня». Чтобы увидеть старые даты, один раз синхронизируйте их отсюда (разовое действие, дальше данные постоянно хранятся в базе).",
"Sinxronlash": "Синхронизация",
"Sinxronlash muvaffaqiyatli tugadi": "Синхронизация успешно завершена",
"Sinxronlash qisman muvaffaqiyatli": "Синхронизация выполнена частично",
"Qidirilmoqda... (bu bir necha daqiqa vaqt olishi mumkin)": "Поиск... (это может занять несколько минут)",
"Bu bir necha daqiqa vaqt olishi mumkin (har bir kun Poster'dan alohida so'raladi)...": "Это может занять несколько минут (каждый день запрашивается из Poster отдельно)...",
"Yuklanmoqda... (bu bir necha soniya olishi mumkin)": "Загрузка... (это может занять несколько секунд)",
"Tranzaksiyalar": "Транзакции",
"Summasi": "Сумма",
"Qiymatlar": "Значения",
"Yorug' rejim": "Дневной режим",
"🌙 Tungi rejim": "🌙 Ночной режим",
"☀️ Yorug' rejim": "☀️ Дневной режим",
"Hali yuborilmagan": "Ещё не отправлено",
"vaqt kutilmoqda": "ожидается время",
"Foydalanuvchi qo'shildi": "Пользователь добавлен",
"Foydalanuvchi o'chirildi": "Пользователь удалён",
"Foydalanuvchi faollashtirildi": "Пользователь активирован",
"Foydalanuvchi faolsizlantirildi": "Пользователь деактивирован",
"Kassa yozuvlari (tahrirlash / o'chirish)": "Записи кассы (редактирование / удаление)",
"Yozuv o'chirildi": "Запись удалена",
"Yozuv yangilandi": "Запись обновлена",
"Umumiy rasxod summasini kiriting:": "Введите сумму общих расходов:",
"Qayta hisoblash": "Пересчитать",
"Qayta hisoblandi": "Пересчитано",
"— qidiring yoki tanlang —": "— найдите или выберите —",
"— tanlang —": "— выберите —",
"Mahsulot nomi": "Название продукта",
"Mahsulot nomi...": "Название продукта...",
"Ilovani o'rnatish": "Установить приложение",
"O'rnatish": "Установить",
"Holat": "Статус",
"Holati": "Статус",
"Tоза": "Чистая",
"Тоза": "Чистая",
"Тоза (naqd)": "Чистая (наличные)",
"Тоза (sanalgan naqd)": "Чистая (пересчитанные наличные)",
"Тоза (naqd) summasini kiriting:": "Введите сумму чистых (наличных):",
"Тоза + Rasxod + Инкассация + Smena farqi:": "Чистая + Расход + Инкассация + Разница по смене:",
"Admin": "Админ",
"KPI — KPI Bonus": "KPI — KPI Бонус",
"Kunlik savdo —": "Продажи по дням —",
"So'nggi": "Последние",
"Eslatma:": "Примечание:",
"Agar kunlik": "Если ежедневная",
"oxirgi 90 kun": "последние 90 дней",
"Necha kunlik": "За сколько дней",
"Poster'dan": "из Poster",
"Дата:": "Дата:",
"Kupyuralar ma'lumoti noto'g'ri": "Неверные данные по купюрам",
"Qoldiq manfiy bo'lmagan son bo'lishi kerak (kg)": "Остаток должен быть неотрицательным числом (кг)",
"Rasxod nomi noto'g'ri (ko'pi bilan 100 belgi)": "Неверное название расхода (не более 100 символов)",
"Rasxod summasi musbat butun son bo'lishi kerak": "Сумма расхода должна быть положительным целым числом",
"Rasxodlar ro'yxati noto'g'ri (ko'pi bilan 50 ta)": "Неверный список расходов (не более 50)",
"To'lov turi nomi noto'g'ri": "Неверное название вида оплаты",
"To'lov turlari ma'lumoti noto'g'ri": "Неверные данные по видам оплаты",
"Umumiy summa juda katta - kiritilgan qiymatlarni tekshiring": "Общая сумма слишком велика — проверьте введённые значения",
"Bir martada eng ko'pi bilan 92 kun (taxminan 3 oy) sinxronlash mumkin": "За один раз можно синхронизировать не более 92 дней (около 3 месяцев)",
"Bu bo'limga ruxsatingiz yo'q": "У вас нет доступа к этому разделу",
"Bu filialga ruxsatingiz yo'q": "У вас нет доступа к этому филиалу",
"Bu foydalanuvchi faolsizlantirilgan": "Этот пользователь деактивирован",
"Bu foydalanuvchi faolsizlantirilgan. Administratorga murojaat qiling.": "Этот пользователь деактивирован. Обратитесь к администратору.",
"Bu kun uchun allaqachon yuborilgan, faqat admin tahrirlashi mumkin": "За этот день данные уже отправлены, изменить может только администратор",
"Bu kun uchun kassa smenasi hali yopilmagan. Smena yopilgandan keyin yuboring.": "Кассовая смена за этот день ещё не закрыта. Отправьте после закрытия смены.",
"Bu kun uchun kassa yozuvi topilmadi": "Запись кассы за этот день не найдена",
"Bu kun uchun ma'lumot allaqachon yuborilgan. O'zgartirish uchun administratorga murojaat qiling.": "Данные за этот день уже отправлены. Для изменения обратитесь к администратору.",
"Bu kun uchun ma'lumot kiritilmagan": "За этот день данные не введены",
"Bu login allaqachon mavjud": "Такой логин уже существует",
"Bu sessiya sizga tegishli emas": "Эта сессия вам не принадлежит",
"Excel eksport faqat administratorlar uchun": "Экспорт в Excel доступен только администраторам",
"Faqat admin uchun ruxsat berilgan": "Доступно только администратору",
"Foydalanuvchi topilmadi": "Пользователь не найден",
"Login yoki parol xato": "Неверный логин или пароль",
"O'zingizni faolsizlantira olmaysiz": "Нельзя деактивировать самого себя",
"O'zingizni o'chira olmaysiz": "Нельзя удалить самого себя",
"Parol kamida 4 belgidan iborat bo'lishi kerak": "Пароль должен содержать не менее 4 символов",
"Server vaqtincha javob bera olmadi. Bir necha soniyadan keyin qayta urinib ko'ring.": "Сервер временно не отвечает. Повторите попытку через несколько секунд.",
"Token topilmadi": "Токен не найден",
"Token yaroqsiz yoki muddati o'tgan": "Токен недействителен или истёк",
"allowed_sections massiv bo'lishi kerak": "allowed_sections должен быть массивом",
"allowed_spots massiv bo'lishi kerak": "allowed_spots должен быть массивом",
"cash_diff_limit_percent (0 yoki musbat son) kerak": "Нужен cash_diff_limit_percent (0 или положительное число)",
"date_from date_to dan katta bo'lmasligi kerak": "date_from не должна быть позже date_to",
"date_from formati noto'g'ri (YYYY-MM-DD)": "Неверный формат date_from (YYYY-MM-DD)",
"date_to formati noto'g'ri (YYYY-MM-DD)": "Неверный формат date_to (YYYY-MM-DD)",
"Juda ko'p noto'g'ri urinish.": "Слишком много неверных попыток.",
"daqiqadan keyin qayta urinib ko'ring.": "мин. Повторите попытку позже.",
"so'mlik kupyura soni manfiy bo'lmagan butun son bo'lishi kerak": "— количество купюр должно быть неотрицательным целым числом",
"Kupyura turi noto'g'ri:": "Неверный номинал купюры:",
"summasi musbat butun son bo'lishi kerak": "— сумма должна быть положительным целым числом",
"So'rov xatosi": "Ошибка запроса",
"Хато": "Ошибка",
"Xato:": "Ошибка:",
"Saqlandi": "Сохранено",
"O'chirildi": "Удалено",
"Yuborildi": "Отправлено",
"Noma'lum": "Неизвестно",
"Tugadi:": "Готово:",
"kun ishlandi,": "дн. обработано,",
"tasi xato bilan.": "с ошибками.",
"ta bog'lanmagan": "не привязано",
"qo'shildi": "добавлен(о)",
"yangilandi": "обновлён(о)",
"kategoriyasiga bog'landi": "привязан к категории",
"Faqat oxirgi": "Только последние",
"kun uchun kiritish mumkin": "дн. можно вводить",
"(farq:": "(разница:",
"chegara:": "лимит:",
"Ochilish vaqti:": "Время открытия:",
"(6 soatdan keyin).": "(через 6 часов).",
"Ochiladi:": "Откроется:",
"Xodim kiritgan (Fakt) va Poster'dagi haqiqiy to'lovlar.": "Введено сотрудником (Факт) и реальные платежи в Poster.",
"oldingi davrga nisbatan": "по сравнению с предыдущим периодом",
"O'rtacha": "Среднее",
"Tekshiruvda:": "На проверке:",
"(kassa hali solishtirilmagan)": "(касса ещё не сверена)",
"kassa kiritilmagan:": "касса не введена:",
"solishtirish kutilmoqda:": "ожидается сверка:",
"Bonus uchun kamida": "Минимум для бонуса:",
"kerak.": "",
"Keyingi pog'onagacha": "До следующей ступени",
"qoldi": "осталось",
"dona": "шт",
"(dona)": "(шт)",
"(kg)": "(кг)",
"Kassa": "Касса",
"Kanalni tanlang": "Выберите канал",
"Kassa yozuvlarini yuklashda xato:": "Ошибка загрузки записей кассы:",
"Poster ingredientlarini yuklashda xato:": "Ошибка загрузки ингредиентов Poster:",
"Portsiya ingredientlarini yuklashda xato:": "Ошибка загрузки ингредиентов для порций:",
"Portsiya yozuvlarini yuklashda xato:": "Ошибка загрузки записей по порциям:",
"Masalan: 1234": "Например: 1234",
"Masalan: 5678": "Например: 5678",
"Masalan: Смесь": "Например: Смесь",
"Yorliq": "Метка",
"Rasxod": "Расход",
"Summa": "Сумма",
"To'lov turi": "Вид оплаты",
"Ma'lumotni yuklash": "Загрузить данные",
"davr uchun barcha bonus": "весь бонус за период",
"kassa tekshirilgan, farq me'yorda": "касса проверена, разница в норме",
"kassa farqi chegaradan oshgani uchun": "из-за превышения лимита разницы по кассе",
"kassa kiritilmagan yoki hali solishtirilmagan": "касса не введена или ещё не сверена",
"Kirish — KPI Bonus": "Вход — KPI Бонус",
"Ma'lumot yo'q": "Нет данных",
"Tekshiruvda": "На проверке",
"Berilmadi (kassa farqi)": "Не выдан (разница по кассе)",
"Kassa farqi": "Разница по кассе",
"Kassa farqi (Fakt − Poster)": "Разница по кассе (Факт − Poster)",
"Tarif o'zgarishlari tarixi": "История изменений тарифа",
"Qiymatni o'zgartiring, so'ng \"Bugundan boshlab saqlash\" yoki \"Davr bilan qo'llash\" tugmasini bosing. Tugmasiz hech narsa o'zgarmaydi.": "Измените значение, затем нажмите «Сохранить с сегодняшнего дня» или «Применить за период». Без нажатия кнопки ничего не изменится.",
"💾 Bugundan boshlab saqlash": "💾 Сохранить с сегодняшнего дня",
"📅 Davr bilan qo'llash": "📅 Применить за период",
"Bekor qilish": "Отмена",
"⚠ Saqlanmagan o'zgarish bor": "⚠ Есть несохранённые изменения",
"Sanagacha (bo'sh = shundan keyin doim)": "По дату (пусто = постоянно после этой даты)",
"Tanlangan o'tgan kunlar yangi tarif bilan qayta hisoblanadi (orqa fonda). Davrdan tashqari kunlar o'zgarmaydi.": "Выбранные прошедшие дни будут пересчитаны по новому тарифу (в фоне). Дни вне периода не меняются.",
"\"Bugundan boshlab\" — yangi tarif": "«С сегодняшнего дня» — новый тариф",
"(bugungi ish kuni) dan amal qiladi, o'tgan kunlar o'zgarmaydi.": "(сегодняшний рабочий день) действует с этой даты, прошедшие дни не меняются.",
"O'zgartirilgan vaqt": "Время изменения",
"Kim": "Кто",
"Qaysi kunlar uchun": "За какие дни",
"O'zgarish": "Изменение",
"Qayta hisoblangan": "Пересчитано",
"dan boshlab": "с этой даты",
"Tarif hali o'zgartirilmagan": "Тариф ещё не изменялся",
"Qayta hisoblanmoqda:": "Идёт пересчёт:",
"Sahifani yopmasangiz ham bo'ladi.": "Страницу можно не закрывать.",
"Qayta hisoblash tugadi:": "Пересчёт завершён:",
"kun muvaffaqiyatli,": "дн. успешно,",
"kunda xato": "дн. с ошибкой",
"kun yangilandi": "дн. обновлено",
"yangi tarif": "новый тариф",
"dan boshlab saqlandi": "сохранён с этой даты",
"O'zgarish yo'q": "Изменений нет",
"kun qayta hisoblanmoqda": "дн. пересчитывается",
"Boshlanish sanasini tanlang": "Выберите начальную дату",
"Tugash sanasi boshlanishdan oldin bo'lishi mumkin emas": "Конечная дата не может быть раньше начальной",
"Qaysi sanadagi tarif": "Тариф на дату",
"yangi tarifi": "нового тарифа",
"kunlari uchun qo'llanadi va bu kunlar qayta hisoblanadi. Davom etasizmi?": "применяется за эти дни, и эти дни будут пересчитаны. Продолжить?",
"dan boshlab doimiy qo'llanadi va o'tgan kunlar qayta hisoblanadi. Davom etasizmi?": "применяется постоянно с этой даты, и прошедшие дни будут пересчитаны. Продолжить?",
"-pog'ona:": "-я ступень:",
"Pog'onalar soni noto'g'ri": "Неверное количество ступеней",
"pastki chegara noto'g'ri": "нижняя граница неверна",
"bonus summasi noto'g'ri": "сумма бонуса неверна",
"yuqori chegara pastkidan kichik": "верхняя граница меньше нижней",
"Oldingi davr hali qayta hisoblanyapti. Tugashini kuting.": "Предыдущий период ещё пересчитывается. Дождитесь завершения.",
"Davr uchun boshlanish sanasi (date_from) kerak": "Для периода нужна начальная дата (date_from)",
"Boshlanish sanasi noto'g'ri": "Неверная начальная дата",
"Tugash sanasi noto'g'ri": "Неверная конечная дата",
"Boshlanish sanasi juda eski": "Начальная дата слишком старая",
"Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas": "Конечная дата не может быть раньше начальной",
"Bir martada eng ko'pi bilan 92 kunlik davrni qayta hisoblash mumkin": "За один раз можно пересчитать не более 92 дней",
"Poster o'zgarishlari jurnali": "Журнал изменений в Poster",
"Kassa Poster bilan solishtirilgandan keyin Poster'dagi raqam o'zgarsa (masalan chek o'chirilsa), tizim oxirgi 3 kunni har ertalab tekshirib, kunni avtomatik qayta hisoblaydi va bu yerga yozib qo'yadi. Bu jurnal faqat adminga ko'rinadi.": "Если после сверки кассы число в Poster изменится (например, удалён чек), система каждое утро проверяет последние 3 дня, автоматически пересчитывает день и записывает это сюда. Журнал виден только администратору.",
"🔄 Hozir tekshirish (oxirgi 3 kun)": "🔄 Проверить сейчас (последние 3 дня)",
"Poster bilan tekshirilmoqda... (bir necha soniya)": "Идёт проверка с Poster... (несколько секунд)",
"Tekshirildi:": "Проверено:",
"ta yozuv, o'zgargan:": "записей, изменено:",
"shubhali (bo'sh javob):": "подозрительно (пустой ответ):",
"Hozircha o'zgarish aniqlanmagan": "Изменений пока не обнаружено",
"Aniqlangan vaqt": "Время обнаружения",
"Eski Poster kassa": "Старая касса Poster",
"Yangi Poster kassa": "Новая касса Poster",
"Chek o'chirilgan yoki kamaytirilgan bo'lishi mumkin": "Возможно, чек удалён или уменьшен",
"Chek qo'shilgan yoki o'zgargan bo'lishi mumkin": "Возможно, чек добавлен или изменён",
"Bonus holati": "Статус бонуса",
"berildi": "выдан",
"berilmadi": "не выдан",
"Tekshiruv hozir ishlayapti, birozdan keyin urinib ko'ring": "Проверка уже идёт, повторите чуть позже",
"berildi → berildi": "выдан → выдан",
"berildi → berilmadi": "выдан → не выдан",
"berildi → —": "выдан → —",
"berilmadi → berildi": "не выдан → выдан",
"berilmadi → berilmadi": "не выдан → не выдан",
"berilmadi → —": "не выдан → —",
"— → berildi": "— → выдан",
"— → berilmadi": "— → не выдан",
"— → —": "— → —",
"Izoh": "Комментарий",
"Telegram": "Telegram",
"Bog'langan": "Привязан",
"/start kutilmoqda": "ожидается /start",
"Username saqlandi. Foydalanuvchi botga /start yuborsin.": "Username сохранён. Пользователь должен отправить боту /start.",
"Telegram bog'lanishi o'chirildi": "Привязка Telegram удалена",
"Parol kamida 6 belgidan iborat bo'lishi kerak": "Пароль должен содержать не менее 6 символов",
"Yangi parolni kiriting (kamida 6 belgi):": "Введите новый пароль (не менее 6 символов):",
"Telegram username noto'g'ri (5-32 belgi: lotin harf, raqam, pastki chiziq; harf bilan boshlanadi)": "Неверный Telegram username (5–32 символа: латинские буквы, цифры, подчёркивание; начинается с буквы)",
"Telegram avto-hisobotlar": "Авто-отчёты в Telegram",
"Hisobot har kuni belgilangan vaqtda tanlangan foydalanuvchilarga (ularning shaxsiy chatiga) va Telegram guruhlarga PDF bo'lib boradi. Foydalanuvchi o'z filiallari va huquqlari doirasida oladi. Guruhga faqat shu yerda belgilangan hisobotlar boradi. Vaqt Toshkent vaqti bilan, ish kuni 05:00 da boshlanadi, shuning uchun \"Kecha\" hisoboti uchun 05:00 dan keyingi vaqtni tanlang.": "Отчёт каждый день в заданное время отправляется PDF-файлом выбранным пользователям (в личный чат) и в группы Telegram. Пользователь получает данные в рамках своих филиалов и прав. В группу идут только отчёты, назначенные здесь. Время ташкентское, рабочий день начинается в 05:00, поэтому для отчёта «Вчера» выбирайте время после 05:00.",
"⚠️ TELEGRAM_BOT_TOKEN sozlanmagan, bot o'chirilgan.": "⚠️ TELEGRAM_BOT_TOKEN не настроен, бот отключён.",
"+ Yangi avto-hisobot": "+ Новый авто-отчёт",
"Nomi": "Название",
"Hisobot": "Отчёт",
"Vaqt": "Время",
"Davr": "Период",
"Guruh tili": "Язык группы",
"Kassa farqi (Fakt va Poster)": "Разница кассы (Факт и Poster)",
"Oxirgi 7 kun": "Последние 7 дней",
"Shu oy (bugungacha)": "Этот месяц (до сегодня)",
"Shu oy": "Этот месяц",
"Kecha": "Вчера",
"Filiallar (hech biri belgilanmasa = hammasi; foydalanuvchi faqat o'z filiallarini oladi)": "Филиалы (если ничего не отмечено — все; пользователь получает только свои филиалы)",
"Foydalanuvchilar (shaxsiy chat)": "Пользователи (личный чат)",
"Guruhlar": "Группы",
"Yoqilgan (har kuni avtomatik yuboriladi)": "Включено (отправляется автоматически каждый день)",
"Oluvchilar": "Получатели",
"Oxirgi yuborilgan": "Последняя отправка",
"Hali avto-hisobot yo'q": "Авто-отчётов пока нет",
"Menga sinab yuborish": "Отправить пробный мне",
"Hozir hammaga yuborish": "Отправить всем сейчас",
"Ulangan Telegram guruhlar": "Подключённые группы Telegram",
"Guruhni ulash: botni guruhga qo'shing, so'ng guruhda Telegram'i bog'langan admin": "Как подключить группу: добавьте бота в группу, затем администратор с привязанным Telegram пишет в группе",
"deb yozsin. Guruh shu ro'yxatda paydo bo'ladi.": ". Группа появится в этом списке.",
"Guruh": "Группа",
"Kim ulagan": "Кто подключил",
"Olib tashlash": "Убрать",
"Hali guruh ulanmagan": "Группы пока не подключены",
"Yuborish jurnali (oxirgi 60 ta)": "Журнал отправки (последние 60)",
"Kimga": "Кому",
"Natija": "Результат",
"Jurnal bo'sh": "Журнал пуст",
"Yoqilgan": "Включено",
"O'chiq": "Выключено",
"Hali yo'q": "Пока нет",
"Xato": "Ошибка",
"O'tkazildi": "Пропущено",
"(qo'lda)": "(вручную)",
"ta foydalanuvchi,": "польз.,",
"ta guruh": "групп",
"Bot chiqarilgan": "Бот удалён",
"Avto-hisobot saqlandi": "Авто-отчёт сохранён",
"Bu avto-hisobotni o'chirasizmi?": "Удалить этот авто-отчёт?",
"Bu guruhni ro'yxatdan olib tashlaysizmi?": "Убрать эту группу из списка?",
"Hisobot hozir barcha oluvchilarga (foydalanuvchilar va guruhlarga) yuboriladi. Davom etasizmi?": "Отчёт будет сейчас отправлен всем получателям (пользователям и группам). Продолжить?",
"Yuborilmoqda...": "Отправляется...",
"Telegram username biriktirilgan foydalanuvchi yo'q": "Нет пользователей с привязанным Telegram username",
"Ulangan guruh yo'q": "Нет подключённых групп",
"Nom kerak (80 belgigacha)": "Нужно название (до 80 символов)",
"Vaqt HH:MM ko'rinishida bo'lishi kerak": "Время должно быть в формате ЧЧ:ММ",
"Sizning hisobingiz Telegram bilan bog'lanmagan. Avval o'z username'ingizni yozib, botga /start yuboring.": "Ваш аккаунт не привязан к Telegram. Сначала впишите свой username и отправьте боту /start.",
"Foydalanuvchilar:": "Пользователи:",
"Guruhlar:": "Группы:",
"KPI / Bonus holati": "KPI / Статус бонуса",
"Kunlik savdo (kategoriya bo'yicha)": "Дневные продажи (по категориям)",
"Kategoriyalar (hech biri belgilanmasa = hammasi)": "Категории (если ничего не отмечено — все)"
};
  var RULES = [
    [/(\d)\s*so'm\b/g, '$1 сум'],
    [/(\d)\s*kg\b/g, '$1 кг'],
    [/(\d)\s*dona\b/g, '$1 шт'],
    [/(\d)\s*so'mlik\b/g, '$1 сум'],
    [/^(\d+) s (\d{2}) d$/, '$1 ч $2 мин'],
    [/^(\d+) d$/, '$1 мин'],
    [/^<1 d$/, '<1 мин'],
    [/^(.+) kerak$/, 'Обязательно: $1'],
    [/\bbonus (\d)/g, 'бонус $1'],
    [/\bdan (\d)/g, 'от $1'],
    [/\bgacha (\d|∞)/g, 'до $1'],
  ];

  var LANG_KEY = 'kpi_lang';
  var lang = 'uz';
  try { lang = localStorage.getItem(LANG_KEY) === 'ru' ? 'ru' : 'uz'; } catch (e) {}

  function normApos(s) { return s.replace(/[ʻʼ’‘`´]/g, "'"); }
  function collapse(s) { return s.replace(/\s+/g, ' ').trim(); }

  var exact = Object.create(null);
  var subs = [];
  Object.keys(DICT).forEach(function (k) {
    var nk = collapse(normApos(k));
    exact[nk] = DICT[k];
    if (nk.length >= 9 || /[:—]$/.test(nk)) subs.push([nk, DICT[k]]);
  });
  subs.sort(function (a, b) { return b[0].length - a[0].length; });

  // Bitta matnni ruschaga o'giradi. O'zgarmasa null qaytaradi.
  function translateCore(core) {
    var n = normApos(core);
    if (exact[n] !== undefined) return exact[n];
    var out = n;
    for (var i = 0; i < subs.length; i++) {
      if (out.indexOf(subs[i][0]) !== -1) out = out.split(subs[i][0]).join(subs[i][1]);
    }
    for (var j = 0; j < RULES.length; j++) out = out.replace(RULES[j][0], RULES[j][1]);
    return out === n ? null : out;
  }

  function translateString(str) {
    if (lang !== 'ru' || typeof str !== 'string' || !str) return str;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(str);
    if (!m[2]) return str;
    var r = translateCore(collapse(m[2]));
    return r === null ? str : m[1] + r + m[3];
  }

  // ---- DOM ----
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var textStore = new WeakMap(); // tugun -> {orig, set}
  var attrStore = new WeakMap(); // element -> {attr: {orig, set}}
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1 };

  function skipEl(el) {
    for (; el && el.nodeType === 1; el = el.parentNode) {
      if (SKIP[el.tagName] || (el.hasAttribute && el.hasAttribute('data-no-i18n'))) return true;
    }
    return false;
  }

  function doText(node) {
    if (skipEl(node.parentNode)) return;
    var st = textStore.get(node);
    var cur = node.data;
    if (st && st.set === cur) return; // bu bizning tarjimamiz
    var tr = translateString(cur);
    if (tr !== cur) { textStore.set(node, { orig: cur, set: tr }); node.data = tr; }
    else if (st) textStore.delete(node);
  }

  function doAttrs(el) {
    if (skipEl(el)) return;
    var list = ATTRS.slice();
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/.test(el.type)) list.push('value');
    var store = attrStore.get(el);
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (!el.hasAttribute(a)) continue;
      var cur = el.getAttribute(a);
      var st = store && store[a];
      if (st && st.set === cur) continue;
      var tr = translateString(cur);
      if (tr !== cur) {
        if (!store) { store = {}; attrStore.set(el, store); }
        store[a] = { orig: cur, set: tr };
        el.setAttribute(a, tr);
      } else if (st) delete store[a];
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (SKIP[root.tagName]) return; doAttrs(root); }
    var kids = root.childNodes;
    for (var i = 0; i < kids.length; i++) walk(kids[i]);
  }

  function revert(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      var st = textStore.get(root);
      if (st && st.set === root.data) root.data = st.orig;
      textStore.delete(root);
      return;
    }
    if (root.nodeType === 1) {
      var as = attrStore.get(root);
      if (as) {
        Object.keys(as).forEach(function (a) {
          if (root.getAttribute(a) === as[a].set) root.setAttribute(a, as[a].orig);
        });
        attrStore.delete(root);
      }
    }
    var kids = root.childNodes;
    for (var i = 0; i < kids.length; i++) revert(kids[i]);
  }

  var observer = null;
  function startObserver() {
    if (observer || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(function (muts) {
      if (lang !== 'ru') return;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    });
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS.concat(['value']),
    });
  }

  function updateButtons() {
    document.documentElement.setAttribute('lang', lang);
    var els = document.querySelectorAll('[data-lang-opt]');
    for (var i = 0; i < els.length; i++) {
      els[i].classList.toggle('active', els[i].getAttribute('data-lang-opt') === lang);
    }
  }

  function applyLang() {
    updateButtons();
    if (!document.body) return;
    if (lang === 'ru') { walk(document.documentElement); startObserver(); }
    else revert(document.documentElement);
  }

  function setLang(next) {
    next = next === 'ru' ? 'ru' : 'uz';
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    applyLang();
    try { window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } })); } catch (e) {}
  }
  function toggleLang() { setLang(lang === 'ru' ? 'uz' : 'ru'); }

  // alert / confirm / prompt matnlari ham tilga mos
  ['alert', 'confirm', 'prompt'].forEach(function (fn) {
    var orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function (msg) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof args[0] === 'string') args[0] = translateString(args[0]);
      return orig.apply(window, args);
    };
  });

  // Yon panel/menyudagi til tugmasi HTML'i (topbar.js ishlatadi)
  function langToggleHtml(id) {
    return '<button type="button" class="lang-toggle" id="' + id + '" data-no-i18n aria-label="Til / Язык">' +
      '<span class="lang-globe">🌐</span>' +
      '<span class="lang-opt" data-lang-opt="uz">UZ</span>' +
      '<span class="lang-opt" data-lang-opt="ru">RU</span></button>';
  }
  function bindLangButton(id) {
    var b = document.getElementById(id);
    if (b) b.addEventListener('click', toggleLang);
  }

  // Kirish sahifasida yon panel yo'q - o'ng yuqori burchakda suzuvchi tugma
  function mountFloating() {
    if (document.querySelector('.sidebar') || document.getElementById('lang-toggle-floating')) return;
    if (!/login/.test(location.pathname)) return;
    var w = document.createElement('div');
    w.className = 'lang-floating';
    w.innerHTML = langToggleHtml('lang-toggle-floating');
    document.body.appendChild(w);
    bindLangButton('lang-toggle-floating');
    updateButtons();
  }

  window.getLang = function () { return lang; };
  window.setLang = setLang;
  window.t = translateString;
  window.i18nTranslate = translateString;
  window.langToggleHtml = langToggleHtml;
  window.bindLangButton = bindLangButton;
  window.i18nRefresh = function () { updateButtons(); if (lang === 'ru') walk(document.documentElement); };

  function init() { mountFloating(); applyLang(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('load', function () { if (lang === 'ru') walk(document.documentElement); });
})();
