const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// استدعاء متغيرات البيئة من منصة Render
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ تحذير: لم يتم العثور على مفاتيح Supabase في متغيرات البيئة!");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// AUTHENTICATION API: نظام تسجيل الدخول الموحد
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // البحث عن المستخدم في جدول الحسابات الخاص بـ Supabase
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            return res.status(401).json({ error: 'بيانات تسجيل الدخول غير صحيحة أو غير موجودة سحابياً!' });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// SECTOR 1: MATERIALS APIS (عروض المواد)
// ==========================================
app.get('/api/materials', async (req, res) => {
    const { data, error } = await supabase
        .from('quotation_items')
        .select('*')
        .order('id', { ascending: false });
        
    if (error) {
        console.error("❌ خطأ جلب المواد:", error);
        return res.status(500).json(error);
    }
    res.json(data || []);
});

app.post('/api/materials', async (req, res) => {
    const item = req.body;
    const dbRow = {
        category: item.category,
        name: item.name,
        details: item.details,
        source: item.source,
        phone: item.phone,
        qty: Number(item.qty),
        unit: item.unit,
        price: Number(item.price),
        currency: item.currency || 'دولار'
    };

    const { data, error } = await supabase.from('quotation_items').insert([dbRow]);
    if (error) {
        console.error("❌ خطأ من Supabase في جدول المواد:", error);
        return res.status(500).json(error);
    }
    res.json({ success: true, data });
});

// ==========================================
// SECTOR 2: PROJECTS & REQUESTS APIS (المشاريع والطلبات)
// ==========================================

// جلب المشاريع الأساسية
app.get('/api/projects', async (req, res) => {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('id', { ascending: false });
    if (error) return res.status(500).json(error);
    res.json(data || []);
});

// إضافة مشروع جديد (Admin)
app.post('/api/projects', async (req, res) => {
    const { name, region, start_date } = req.body;
    const { data, error } = await supabase
        .from('projects')
        .insert([{ name, region, start_date }]);
    if (error) return res.status(500).json(error);
    res.json({ success: true, data });
});

// جلب طلبات مواد المشاريع
app.get('/api/project-requests', async (req, res) => {
    const { data, error } = await supabase
        .from('project_requests')
        .select('*')
        .order('id', { ascending: false });
    if (error) return res.status(500).json(error);
    res.json(data || []);
});

// إضافة طلب مشروع جديد
app.post('/api/project-requests', async (req, res) => {
    const { project, material, details, qty, due_date } = req.body;
    const { data, error } = await supabase
        .from('project_requests')
        .insert([{ project, material, details, qty: Number(qty), due_date, is_completed: false }]);
    if (error) return res.status(500).json(error);
    res.json({ success: true, data });
});

// تحديث حالة إنجاز الطلب (من قبل المشتريات)
app.put('/api/projects-requests/:id/status', async (req, res) => {
    const { id } = req.params;
    const { is_completed } = req.body;
    const { data, error } = await supabase
        .from('project_requests')
        .update({ is_completed: is_completed })
        .eq('id', id);
        
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
});

// ==========================================
// SECTOR 3: SUPERVISORS & STAGES (المشرفين والمراحل)
// ==========================================

// جلب قائمة المشرفين
app.get('/api/project-supervisors', async (req, res) => {
    const { data, error } = await supabase.from('project_supervisors').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// إضافة حساب مشرف مشروع جديد (يرتبط بجدول الحسابات وجدول المشرفين)
app.post('/api/project-supervisors', async (req, res) => {
    const { name, phone_number, project_id, username, password } = req.body;
    try {
        // 1. زرع الحساب أولاً في جدول المستخدمين للحصول على صلاحية الدخول
        const { data: userRow, error: userErr } = await supabase
            .from('users')
            .insert([{ username, password, role: 'supervisor', name }])
            .select()
            .single();

        if (userErr) throw userErr;

        // 2. تدوين بيانات المشرف وربطه بالمشروع الحصري له
        const { data: supRow, error: supErr } = await supabase
            .from('project_supervisors')
            .insert([{ user_id: userRow.id, name, phone_number, project_id, username }]);

        if (supErr) throw supErr;

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// جلب مراحل تنفيذ المشاريع
app.get('/api/project-stages', async (req, res) => {
    const { data, error } = await supabase
        .from('project_stages')
        .select('*')
        .order('id', { ascending: false });
    if (error) return res.status(500).json(error);
    res.json(data || []);
});

// خروج تصفح افتراضي لملف الـ HTML
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
