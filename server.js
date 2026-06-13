const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// AUTHENTICATION API
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            return res.status(401).json({ error: 'بيانات تسجيل الدخول غير صحيحة!' });
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
    if (error) return res.status(500).json(error);
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
        currency: item.currency || 'دولار',
        address: item.address || '',       // الحقل الجديد 1: العنوان
        notes: item.notes || '',           // الحقل الجديد 2: الملاحظات
        is_archived: item.is_archived === true
    };

    // الحفاظ على تاريخ الإنشاء الأصلي أو تركه لـ Supabase
    if (item.created_at) dbRow.created_at = item.created_at;

    // استخدام upsert لدعم الإضافة والتعديل بنفس الوقت بناءً على الـ id
    if (item.id) dbRow.id = Number(item.id);

    const { data, error } = await supabase.from('quotation_items').upsert([dbRow]).select();
    if (error) return res.status(500).json(error);
    res.json({ success: true, data });
});

app.delete('/api/materials/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('quotation_items').delete().eq('id', id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
});

// ==========================================
// SECTOR 2: PROJECTS & REQUESTS APIS
// ==========================================

app.get('/api/projects', async (req, res) => {
    const { data, error } = await supabase.from('projects').select('*').order('id', { ascending: false });
    if (error) return res.status(500).json(error);
    res.json(data || []);
});

app.post('/api/projects', async (req, res) => {
    const { name, region, start_date } = req.body;
    console.log("📥 البيانات المستلمة لإنشاء مشروع:", { name, region, start_date });

    // إذا كانت قيمة التاريخ فارغة، نرسل null لتجنب مشاكل الصيغة في SQL
    const formattedDate = start_date ? start_date : null;

    const { data, error } = await supabase
        .from('projects')
        .insert([{ name, region, start_date: formattedDate }])
        .select();
        
    if (error) {
        console.error("❌ خطأ فادح من Supabase أثناء إدخال المشروع:", error);
        return res.status(500).json({ error: error.message, details: error.details });
    }
    
    console.log("✅ تم إدخال المشروع بنجاح في Supabase:", data);
    res.json({ success: true, data });
});


app.get('/api/project-requests', async (req, res) => {
    const { data, error } = await supabase.from('project_requests').select('*').order('id', { ascending: false });
    if (error) return res.status(500).json(error);
    res.json(data || []);
});

app.post('/api/project-requests', async (req, res) => {
    const item = req.body;
    const dbRow = {
        project: item.project,
        material: item.material,
        details: item.details,
        qty: Number(item.qty),
        due_date: item.due_date || null,
        is_completed: item.is_completed === true
    };
    if (item.id) dbRow.id = Number(item.id);

    const { data, error } = await supabase.from('project_requests').upsert([dbRow]).select();
    if (error) return res.status(500).json(error);
    res.json({ success: true, data });
});

// تم توحيد المسار هنا تماماً ليكون متوافقاً مع الاسم المفرد المعتمد للملفات
app.put('/api/project-requests/:id/status', async (req, res) => {
    const { id } = req.params;
    const { is_completed } = req.body;
    const { data, error } = await supabase
        .from('project_requests')
        .update({ is_completed: is_completed })
        .eq('id', id)
        .select();
        
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
});

app.delete('/api/project-requests/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('project_requests').delete().eq('id', id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
});

// ==========================================
// SECTOR 3: SUPERVISORS & STAGES
// ==========================================
app.get('/api/project-supervisors', async (req, res) => {
    const { data, error } = await supabase.from('project_supervisors').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

app.post('/api/project-supervisors', async (req, res) => {
    const { name, phone_number, project_id, username, password } = req.body;
    try {
        const { data: userRow, error: userErr } = await supabase
            .from('users')
            .insert([{ username, password, role: 'supervisor', name }])
            .select()
            .single();

        if (userErr) throw userErr;

        const { error: supErr } = await supabase
            .from('project_supervisors')
            .insert([{ user_id: userRow.id, name, phone_number, project_id, username }]);

        if (supErr) throw supErr;

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/project-stages', async (req, res) => {
    const { data, error } = await supabase.from('project_stages').select('*').order('id', { ascending: false });
    if (error) return res.status(500).json(error);
    res.json(data || []);
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
