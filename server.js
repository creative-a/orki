const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// استدعاء متغيرات البيئة
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
    try {
        const { data, error } = await supabase
            .from('quotation_items')
            .select('*')
            .order('id', { ascending: false });
            
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error("❌ خطأ جلب المواد:", err.message);
        res.status(500).json({ error: err.message });
    }
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
        address: item.address || '',       
        notes: item.notes || '',           
        is_archived: item.is_archived === true
    };

    if (item.created_at) dbRow.created_at = item.created_at;
    if (item.id) dbRow.id = Number(item.id);

    try {
        const { data, error } = await supabase.from('quotation_items').upsert([dbRow]).select();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error("❌ خطأ حفظ المواد:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/materials/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('quotation_items').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// SECTOR 2: PROJECTS & REQUESTS APIS (المشاريع والطلبات)
// ==========================================

// جلب المشاريع - تم إصلاح دالة التحويل لتعمل بأمان ودون إيقاف السيرفر
app.get('/api/projects', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('id', { ascending: false });
            
        if (error) throw error;

        // تحويل آمن للحقول لضمان قراءتها في الواجهة index.html
        const mappedData = (data || []).map(p => {
            return {
                id: p.id,
                name: p.project_name || p.name || 'مشروع بدون اسم', 
                region: p.region || '',
                start_date: p.start_date || ''
            };
        });

        res.json(mappedData);
    } catch (err) {
        console.error("❌ خطأ جلب المشاريع كلياً:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// إضافة مشروع جديد بالاعتماد على الحقل الحقيقي لقاعدة بياناتك project_name
app.post('/api/projects', async (req, res) => {
    const { name, region, start_date } = req.body;
    console.log("📥 البيانات المستلمة لإنشاء مشروع:", { name, region, start_date });

    const formattedDate = start_date ? start_date : null;

    try {
        const { data, error } = await supabase
            .from('projects')
            .insert([{ 
                project_name: name, 
                region: region, 
                start_date: formattedDate 
            }])
            .select();
            
        if (error) throw error;
        console.log("✅ تم إدخال المشروع بنجاح:", data);
        res.json({ success: true, data });
    } catch (err) {
        console.error("❌ خطأ إدخال مشروع جديد:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// جلب طلبات مواد المشاريع
app.get('/api/project-requests', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('project_requests')
            .select('*')
            .order('id', { ascending: false });
            
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// إضافة طلب مشروع جديد
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

    try {
        const { data, error } = await supabase.from('project_requests').upsert([dbRow]).select();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// تحديث حالة إنجاز الطلب
app.put('/api/project-requests/:id/status', async (req, res) => {
    const { id } = req.params;
    const { is_completed } = req.body;
    try {
        const { data, error } = await supabase
            .from('project_requests')
            .update({ is_completed: is_completed })
            .eq('id', id)
            .select();
            
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/project-requests/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('project_requests').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// SECTOR 3: SUPERVISORS & STAGES (المشرفين والمراحل)
// ==========================================

app.get('/api/project-supervisors', async (req, res) => {
    try {
        // جلب المشرفين
        const { data: supervisors, error: supErr } = await supabase.from('project_supervisors').select('*');
        if (supErr) throw supErr;

        // جلب المشاريع للمطابقة الحية
        const { data: projects, error: projErr } = await supabase.from('projects').select('*');
        if (projErr) throw projErr;

        // دمج البيانات لكي يظهر اسم المشروع في الجدول في الـ index.html
        const mappedSupervisors = (supervisors || []).map(s => {
            const matchProj = (projects || []).find(p => p.id === s.project_id);
            return {
                ...s,
                project_name: matchProj ? (matchProj.project_name || matchProj.name) : 'غير محدد'
            };
        });

        res.json(mappedData || mappedSupervisors);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/project-supervisors', async (req, res) => {
    const { name, phone_number, project_id, username, password } = req.body;
    console.log("📥 بيانات المشرف المستلمة:", { name, phone_number, project_id, username });

    let createdUserId = null;

    try {
        // 1. زرع الحساب في جدول المستخدمين (users)
        const { data: userRow, error: userErr } = await supabase
            .from('users')
            .insert([{ username, password, role: 'supervisor', name }])
            .select()
            .single();

        if (userErr) {
            console.error("❌ خطأ Supabase أثناء إنشاء الحساب في جدول users:", userErr);
            return res.status(400).json({ error: `خطأ في جدول المستخدمين: ${userErr.message}` });
        }

        createdUserId = userRow.id;

        // 2. بناء كائن المشرف النقي (بدون حقل project_name لتفادي خطأ الـ Schema Cache)
        const supervisorRow = { 
            user_id: createdUserId, 
            name: name, 
            phone_number: phone_number, 
            project_id: Number(project_id)
        };

        // إذا كان جدولك يحتوي على حقل username للمشرف نقوم بإضافته، وإلا سيتجاهله الكود
        if (username) supervisorRow.username = username;

        const { error: supErr } = await supabase
            .from('project_supervisors')
            .insert([supervisorRow]);

        if (supErr) {
            console.error("❌ خطأ Supabase أثناء تدوين المشرف في جدول project_supervisors:", supErr);
            
            // إجراء حمائي: حذف الحساب الذي أنشئ في جدول users لكي لا يعلق الحساب عند إعادة المحاولة
            await supabase.from('users').delete().eq('id', createdUserId);
            
            throw supErr;
        }

        console.log("✅ تم إنشاء وتعيين المشرف بنجاح سحابياً!");
        res.json({ success: true });

    } catch (err) {
        console.error("💥 التحطم النهائي للمسار بسبب:", err.message);
        res.status(500).json({ error: err.message });
    }
});

//////// STAGES
app.get('/api/project-stages', async (req, res) => {
    try {
        const { data, error } = await supabase.from('project_stages').select('*').order('id', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// مسار افتراضي لتصفح ملف الـ HTML
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
