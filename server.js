

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// SupabaseTok
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(express.json());
app.use(express.static(__dirname));

// 1. retrieve
app.get('/api/items', async (req, res) => {
    const { data, error } = await supabase.from('quotation_items').select('*');
    if (error) return res.status(500).json(error);
    
    // edit columns
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
        createdAt: item.created_at || '---' // date
    }));
    res.json(formattedData);
});

// 2. synqr
app.post('/api/save', async (req, res) => {
    const items = req.body;
    
    // supabase SQL
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

    // مسح البيانات القديمة وإدخال الجديدة (Upsert) لضمان التحديث التلقائي
const { error } = await supabase.from('quotation_items').upsert(dbRows);
    if (error) return res.status(500).json(error);
    
    res.json({ success: true });
});

app.listen(PORT, () => console.log(` السيرفر جاهز على منفذ ${PORT}`));
