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
    const { data, error } = await supabase.from('quotation_items').select('*');
    if (error) {
        console.error("❌ خطأ أثناء جلب المواد:", error);
        return res.status(500).json(error);
    }
    
    const formattedData = (data || []).map(item => ({
        id: item.id, 
        category: item.category, 
        name: item.name, 
        details: item.details,
        source: item.source, 
        phone: item.phone, 
        qty: item.qty, 
        unit: item.unit,
        price: item.price, 
        currency: item.currency || 'دولار', 
        isArchived: item.is_archived || item.isArchived || false,
        createdAt: item.created_at || item.createdAt || '---' 
    }));
    res.json(formattedData);
});

app.post('/api/save-single', async (req, res) => {
    const item = req.body;
    console.log("📥 البيانات القادمة من المتصفح للمواد:", item);

    // بناء الكائن بالأسماء الحرفية الصحيحة والمطابقة لـ Supabase تماماً
    const dbRow = {
        id: item.id, 
        category: item.category, 
        name: item.name, 
        details: item.details,
        source: item.source, 
        phone: item.phone, 
        qty: item.qty, 
        unit: item.unit,
        price: item.price, 
        currency: item.currency,
        is_archived: item.isArchived
    };

    // تأمين إرسال التاريخ إلى العمود الصحيح فقط وبصيغة متوافقة
    if (item.createdAt && !item.createdAt.includes('✏️')) {
        dbRow.created_at = item.createdAt; 
    }

    const { error } = await supabase.from('quotation_items').upsert(dbRow);
    
    if (error) {
        console.error("❌❌ خطأ فادح من Supabase في جدول المواد:", error);
        return res.status(500).json({ success: false, message: error.message, details: error });
    }
    
    console.log("🟢 تم حفظ المادة بنجاح في Supabase!");
    res.json({ success: true });
});


app.delete('/api/delete/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('quotation_items').delete().eq('id', id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
});

// ==========================================
// SECTOR 2: PROJECTS APIS (طلبات مواد المشاريع)
// ==========================================

app.get('/api/projects', async (req, res) => {
    const { data, error } = await supabase.from('project_requests').select('*');
    if (error) return res.status(500).json(error);
    
    const formattedData = (data || []).map(item => ({
        id: item.id,
        project: item.project,
        material: item.material,
        details: item.details,
        qty: item.qty,
        dueDate: item.due_date,
        isArchived: item.is_archived || item.isArchived || false,
        createdAt: item.created_at || item.createdAt || '---'
    }));
    res.json(formattedData);
});

app.post('/api/projects/save-single', async (req, res) => {
    const item = req.body;
    
    const dbRow = {
        id: item.id,
        project: item.project,
        material: item.material,
        details: item.details,
        qty: item.qty,
        due_date: item.dueDate,
        is_archived: item.isArchived,
        isArchived: item.isArchived
    };

    if (item.createdAt) {
        dbRow.created_at = item.createdAt;
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

// ==========================================
// GLOBAL ROUTING
// ==========================================
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
