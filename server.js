// 1. تفعيل قراءة متغيرات البيئة في السطر الأول دائماً
require('dotenv').config(); 

// 2. استدعاء المكتبات وتعيين المتغيرات (هنا تم تعريف express)
const express = require('express');
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// 3. تشغيل تطبيق إكسبريس (يجب أن يأتي حتماً بعد التعريف)
const app = express();
const PORT = process.env.PORT || 3005;

// 4. الإعدادات الأساسية والميدل وير العامة
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 5. تهيئة الاتصال بقاعدة بيانات Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// تصدير الكائن للأقسام القادمة
module.exports = { supabase };
// استدعاء مكتبة التشفير في أعلى الملف مع باقي الـ requires إذا لم تكن موجودة
const jwt = require('jsonwebtoken');

// المفتاح السري المجلوب من ملف البيئة
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// ----------------------------------------
// [POST] /api/auth/login : نقطة تشغيل تسجيل الدخول
// ----------------------------------------

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1️⃣ طباعة البيانات القادمة من المتصفح للتأكد من سلامة وصولها
        console.log("➡️ [طلب دخول] البيانات المرسلة من الواجهة:", { username, password });

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'الرجاء إدخال اسم المستخدم وكلمة المرور' });
        }

        // الاستعلام باستخدام maybeSingle لمنع انهيار الاستعلام عند عدم وجود تطابق
        const { data: user, error } = await supabase
            .from('users') 
            .select('*')
            .eq('username', username)
            .maybeSingle(); // تعديل جوهري لمنع الأخطاء الحادة

        // 2️⃣ طباعة النتيجة الفعلية المسترجعة من سوبابيس في الـ CMD
        console.log("⬅️ [قاعدة البيانات] النتيجة المرجعة من Supabase:", { user, error });

        if (error) {
            console.error('❌ خطأ أثناء الاتصال بجدول users:', error);
            return res.status(501).json({ success: false, message: 'خطأ في الاتصال بقاعدة البيانات' });
        }

        if (!user) {
            console.log(`⚠️ لم يتم العثور على أي مستخدم في الداتابيس يحمل الاسم: [${username}]`);
            return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        // 3️⃣ طباعة ومقارنة كلمات المرور أمام عينك في السيرفر
        console.log(`🔑 فحص كلمة المرور: المدخلة [${password}] مقابل المخزنة [${user.password}]`);

        if (user.password !== password) {
            console.log("❌ كلمة المرور غير متطابقة!");
            return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        // توليد الـ Token
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role || 'admin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log("🎉 تم التحقق بنجاح وتوليد الـ JWT Token للمستخدم:", user.username);

        return res.json({
            success: true,
            message: 'تم تسجيل الدخول بنجاح',
            token,
            user: { username: user.username, role: user.role }
        });

    } catch (err) {
        console.error('Login Error:', err);
        return res.status(500).json({ success: false, message: 'حدث خطأ داخلي في الخادم' });
    }
});


// ميدل وير لفحص الـ Token وحماية المسارات الحساسة
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    // جلب التوكن من الهيدر (يكون بصيغة Bearer TOKEN_HERE)
    const token = authHeader && authHeader.split(' ')[2] ? authHeader.split(' ')[2] : (authHeader && authHeader.split(' ')[1]);

    if (!token) {
        return res.status(401).json({ success: false, message: 'وصول غير مصرح به، التوكن مفقود' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'جلسة انتهت أو توكن غير صالح' });
        }
        req.user = user; // شحن بيانات المستخدم الموثق بداخل الطلب ليراها السيرفر
        next(); // السماح بالعبور للمسار التالي بسلام
    });
}

// 6. توجيه أي طلب غير معروف للصفحة الرئيسية
// بديل ذكي يلتقط أي طلب لم تجمعه المسارات السابقة ويرسل الصفحة الرئيسية
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 7. تشغيل السيرفر
app.listen(PORT, () => {
    console.log(`🚀 خادم نظام أوركيدا يعمل بنظام الوحدات على المنفذ: ${PORT}`);
});