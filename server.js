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
// SECTOR 1: MATERIALS APIS (quotation)
// ==========================================
app.get('/api/materials', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('quotation_items')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error("❌ خطأ جلب عروض المواد:", err.message);
        res.status(500).json([]);
    }
});

app.post('/api/materials', async (req, res) => {
    const item = req.body;
    console.log("📥 البيانات المستلمة في مسار materials الأصلي:", item);

    const dbRow = {
        category: item.category,
        name: item.name,
        details: item.details,
        source: item.source,
        phone: item.phone,
        qty: Number(item.qty || 1),
        unit: item.unit || 'قطعة',
        price: Number(item.price),
        currency: item.currency || 'دولار',
        address: item.address || '',
        notes: item.notes || '',
        is_archived: item.is_archived === true
    };

    if (item.created_at) dbRow.created_at = item.created_at;

    // بعد إصلاح SQL (إضافة sequence على quotation_items.id)، لا حاجة لتوليد
    // معرف عشوائي عند الإضافة الجديدة — نمرر id فقط عند التعديل (عندما يوجد فعلاً)
    if (item.id && Number(item.id) !== 0 && item.id !== "") {
        dbRow.id = Number(item.id);
    }
    // لاحظ: في حالة الإضافة الجديدة، لا نضع dbRow.id إطلاقاً
    // PostgreSQL سيستخدم nextval('quotation_items_id_seq') تلقائياً

    try {
        const { data, error } = await supabase
            .from('quotation_items')
            .upsert([dbRow])
            .select();

        if (error) {
            console.error("❌ خطأ Supabase المباشر:", error.message);
            return res.status(500).json({ error: error.message });
        }

        console.log(`✅ تم التثبيت بنجاح بالمعرف رقم (${dbRow.id})`);
        res.json({ success: true, data });
    } catch (err) {
        console.error("💥 تحطم مسار حفظ المواد:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/materials/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`🗑️ طلب حذف مادة يحمل المعرف الرقمي: ${id}`);

    try {
        const { data, error } = await supabase
            .from('quotation_items')
            .delete()
            .eq('id', Number(id));

        if (error) {
            console.error("❌ خطأ Supabase أثناء الحذف:", error.message);
            return res.status(500).json({ error: error.message });
        }

        console.log(`✅ تم مسح المادة رقم (${id}) بنجاح من السحاب!`);
        res.json({ success: true, message: "تم الحذف بنجاح" });
    } catch (err) {
        console.error("💥 تحطم مسار الحذف تماماً:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// SECTOR 2: PROJECTS & REQUESTS APIS (المشاريع والطلبات)
// ==========================================

app.get('/api/projects', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;

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

app.get('/api/project-requests', async (req, res) => {
    try {
        const { data: requests, error: reqErr } = await supabase
            .from('project_requests')
            .select('*')
            .order('id', { ascending: false });

        if (reqErr) throw reqErr;

        const { data: projects } = await supabase.from('projects').select('*');

        const mappedRequests = (requests || []).map(r => {
            // عمود project النصي محذوف بالكامل من قاعدة البيانات الآن
            // project_id هو الحقل الوحيد، ونستخرج اسم المشروع من جدول projects فقط للعرض
            const matchProj = (projects || []).find(p => p.id === r.project_id);

            return {
                id: r.id,
                project: matchProj ? matchProj.project_name : 'غير محدد',
                project_id: r.project_id,
                material: r.material || '',
                details: r.details || '',
                qty: r.qty || 0,
                due_date: r.due_date || '',
                is_completed: r.is_completed === true
            };
        });

        res.json(mappedRequests);
    } catch (err) {
        console.error("❌ خطأ جلب طلبات المواد:", err.message);
        res.status(500).json([]);
    }
});

app.post('/api/project-requests', async (req, res) => {
    const item = req.body;
    console.log("📥 البيانات المستلمة لطلب المواد:", item);

    // project_id أصبح NOT NULL في قاعدة البيانات، لذا التحقق هنا إلزامي
    // ويجب أن تكون قيمته id رقمياً صحيحاً من جدول projects (لا اسم نصي بعد الآن)
    const projectIdNum = Number(item.project_id ?? item.project);
    if (!projectIdNum || isNaN(projectIdNum)) {
        return res.status(400).json({ error: 'project_id مطلوب ويجب أن يكون رقم مشروع صحيح' });
    }

    const dbRow = {
        project_id: projectIdNum,
        material: item.material,
        details: item.details,
        qty: Number(item.qty),
        due_date: item.due_date || null,
        is_completed: item.is_completed === true
    };

    try {
        const { data, error } = await supabase
            .from('project_requests')
            .insert([dbRow])
            .select();

        if (error) {
            console.error("❌ خطأ Supabase المباشر في جدول project_requests:", error);
            return res.status(500).json({ error: error.message });
        }

        console.log("✅ تم حفظ طلب المواد بنجاح في السحاب!");
        res.json({ success: true, data });
    } catch (err) {
        console.error("💥 تحطم مسار طلبات المواد كلياً:", err.message);
        res.status(500).json({ error: err.message });
    }
});

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
// SECTOR 3: SUPERVISORS & STAGES
// ==========================================

app.get('/api/project-supervisors', async (req, res) => {
    try {
        const { data: supervisors, error: supErr } = await supabase.from('project_supervisors').select('*');
        if (supErr) throw supErr;

        const { data: projects, error: projErr } = await supabase.from('projects').select('*');
        if (projErr) throw projErr;

        const mappedSupervisors = (supervisors || []).map(s => {
            const matchProj = (projects || []).find(p => p.id === s.project_id);
            return {
                ...s,
                project_name: matchProj ? (matchProj.project_name || matchProj.name) : 'غير محدد'
            };
        });

        res.json(mappedSupervisors);
    } catch (err) {
        console.error("❌ خطأ جلب المشرفين بالسيرفر:", err.message);
        res.status(500).json([]);
    }
});

app.post('/api/project-supervisors', async (req, res) => {
    const { name, phone_number, project_id, username, password } = req.body;
    console.log("📥 بيانات المشرف المستلمة:", { name, phone_number, project_id, username });

    let createdUserId = null;

    try {
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

        const supervisorRow = {
            user_id: createdUserId,
            name: name,
            phone_number: phone_number,
            project_id: Number(project_id)
        };

        const { error: supErr } = await supabase
            .from('project_supervisors')
            .insert([supervisorRow]);

        if (supErr) {
            console.error("❌ خطأ Supabase أثناء تدوين المشرف في جدول project_supervisors:", supErr);

            await supabase.from('users').delete().eq('id', createdUserId);

            return res.status(500).json({ error: supErr.message });
        }

        console.log("✅ نجاح تام: تم إنشاء الحساب وربطه كمشرف في الجدولين بنجاح!");
        res.json({ success: true });

    } catch (err) {
        console.error("💥 التحطم النهائي للمسار بسبب:", err.message);
        res.status(500).json({ error: err.message });
    }
});

//////// STAGES
app.get('/api/project-stages', async (req, res) => {
    try {
        const { data: stages, error: stageErr } = await supabase
            .from('project_stages')
            .select('*')
            .order('id', { ascending: false });

        if (stageErr) throw stageErr;

        const { data: projects } = await supabase.from('projects').select('*');

        const mappedStages = (stages || []).map(s => {
            const matchProj = (projects || []).find(p => p.id === s.project_id);
            return {
                id: s.id,
                stage_name: s.stage_name || s.name,
                project_name: matchProj ? (matchProj.project_name || matchProj.name) : 'غير محدد',
                supervisor_name: s.supervisor_name || 'مشرف المشروع',
                details: s.details || '',
                start_date: s.start_date || '',
                end_date: s.end_date || '',
                is_completed: s.is_completed === true
            };
        });

        res.json(mappedStages);
    } catch (err) {
        console.error("❌ خطأ جلب مراحل المشروع:", err.message);
        res.status(500).json([]);
    }
});

app.post('/api/project-stages', async (req, res) => {
    const item = req.body;
    console.log("📥 البيانات المستلمة للمرحلة:", item);

    const dbRow = {
        stage_name: item.stage_name,
        project_id: Number(item.project_id),
        details: item.details,
        start_date: item.start_date || null,
        end_date: item.end_date || null,
        is_completed: item.is_completed === true
    };

    if (item.id) dbRow.id = Number(item.id);

    try {
        const { data, error } = await supabase
            .from('project_stages')
            .insert([dbRow])
            .select();

        if (error) {
            console.error("❌ خطأ Supabase في جدول project_stages:", error);
            return res.status(500).json({ error: error.message });
        }

        console.log("✅ تم حفظ المرحلة بنجاح سحابياً!");
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));