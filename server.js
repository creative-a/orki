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
// SECTOR 1: MATERIALS APIS (عروض المواد)
// ==========================================
app.get('/api/items', async (req, res) => {
    // جلب البيانات مرتبة بحسب المعرف تنازلياً لضمان ظهور الأحدث أولاً
    const { data, error } = await supabase.from('quotation_items').select('*').order('id', { ascending: false });
    if (error) {
        console.error("❌ خطأ جلب المواد:", error);
        return res.status(500).json(error);
    }
    res.json(data || []);
});

app.post('/api/save-single', async (req, res) => {
    const item = req.body;
    console.log("📥 البيانات المستلمة للمواد:", item);

    // بناء كائن نقي يطابق أعمدة الـ SQL التي أرسلتها تماماً
    const dbRow = {
        id: Number(item.id),
        category: item.category,
        name: item.name,
        details: item.details,
        source: item.source,
        phone: item.phone,
        qty: Number(item.qty),
        unit: item.unit,
        price: Number(item.price),
        currency: item.currency || 'دولار',
        is_archived: item.is_archived === true
    };

    // إذا كان هناك تاريخ مخزن مسبقاً نرسله، وإلا ستتولى Supabase توليده تلقائياً
    if (item.created_at) {
        dbRow.created_at = item.created_at;
    }

    const { error } = await supabase.from('quotation_items').upsert(dbRow);
    if (error) {
        console.error("❌ خطأ فادح من Supabase في جدول المواد:", error);
        return res.status(500).json(error);
    }
    res.json({ success: true });
});

app.delete('/api/delete/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('quotation_items').delete().eq('id', id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
});

// ==========================================
// SECTOR 2: PROJECTS APIS (طلبات المشاريع)
// ==========================================
app.get('/api/projects', async (req, res) => {
    const { data, error } = await supabase.from('project_requests').select('*').order('id', { ascending: false });
    if (error) return res.status(500).json(error);
    res.json(data || []);
});

app.post('/api/projects/save-single', async (req, res) => {
    const item = req.body;
    
    const dbRow = {
        id: Number(item.id),
        project: item.project,
        material: item.material,
        details: item.details,
        qty: Number(item.qty),
        due_date: item.due_date || null,
        is_archived: item.is_archived === true
    };

    if (item.created_at) {
        dbRow.created_at = item.created_at;
    }

    const { error } = await supabase.from('project_requests').upsert(dbRow);
    if (error) {
        console.error("❌ خطأ في قطاع المشاريع:", error);
        return res.status(500).json(error);
    }
    res.json({ success: true });
});

app.delete('/api/projects/delete/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('project_requests').delete().eq('id', id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
