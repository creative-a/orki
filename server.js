const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// قراءة المفاتيح والتوكنز بشكل آمن عبر متغيرات البيئة الخاصة بك
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(express.json());
app.use(express.static(__dirname));

// 1. retrieve - جلب البيانات من السحاب
app.get('/api/items', async (req, res) => {
    const { data, error } = await supabase.from('quotation_items').select('*');
    if (error) return res.status(500).json(error);
    
    // تحويل الأعمدة لتتوافق مع فرونت إند التطبيق
    const formattedData = data.map(item => ({
        id: item.id, 
        category: item.category, 
        name: item.name, 
        details: item.details,
        source: item.source, 
        phone: item.phone, 
        qty: item.qty, 
        unit: item.unit,
        price: item.price, 
        isArchived: item.is_archived,
        createdAt: item.created_at || '---' 
    }));
    res.json(formattedData);
});

// 2. synqr - مزامنة وحفظ البيانات
app.post('/api/save', async (req, res) => {
    const items = req.body;
    
    // تحويل الأعمدة لتتوافق مع جدول SQL في Supabase
    const dbRows = items.map(item => ({
        id: item.id, 
        category: item.category, 
        name: item.name, 
        details: item.details,
        source: item.source, 
        phone: item.phone, 
        qty: item.qty, 
        unit: item.unit,
        price: item.price, 
        is_archived: item.isArchived,
        created_at: item.createdAt 
    }));

    // حفظ وتحديث تلقائي بالسحاب
    const { error } = await supabase.from('quotation_items').upsert(dbRows);
    if (error) return res.status(500).json(error);
    
    res.json({ success: true });
});

// 3. التوجيه الشامل والآمن (تم دمج المسارين لمنع تعارض السيرفر عند التحديث)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
