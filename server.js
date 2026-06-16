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

app.post('/api/quotation_items', async (req, res) => {
    const item = req.body;
    console.log("📥 البيانات المستلمة لعروض المواد:", item);

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
    
    if (item.id && Number(item.id) !== 0) {
        dbRow.id = Number(item.id);
    } else {
        delete dbRow.id;
    }

    try {
        const { data, error } = await supabase
            .from('quotation_items')
            .upsert([dbRow])
            .select();
            
        if (error) {
            console.error("❌ خطأ Supabase المباشر:", error.message);
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error("💥 تحطم مسار عروض المواد:", err.message);
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

// 1. جلب طلبات المواد مع دمج اسم المشروع ديناميكياً للعرض بالشاشة
app.get('/api/project-requests', async (req, res) => {
    try {
        const { data: requests, error: reqErr } = await supabase
            .from('project_requests')
            .select('*')
            .order('id', { ascending: false });
            
        if (reqErr) throw reqErr;

        // جلب المشاريع لترجمة المعرف الرقمي إلى اسم نصي يظهر للمشرف
        const { data: projects } = await supabase.from('projects').select('*');

        const mappedRequests = (requests || []).map(r => {
            // البحث عن المشروع المطابق سواء كان الربط بـ project_id أو الحقل القديم project
            const projectId = r.project_id || r.project;
            const matchProj = (projects || []).find(p => p.id === Number(projectId));
            
            return {
                id: r.id,
                project: matchProj ? (matchProj.project_name || matchProj.name) : (r.project || 'غير محدد'),
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

// 2. إضافة طلب مواد جديد بالاعتماد على الهيكلية الرقمية الصحيحة
app.post('/api/project-requests', async (req, res) => {
    const item = req.body;
    console.log("📥 البيانات المستلمة لطلب المواد:", item);

    // 1. بناء السطر الأساسي للبيانات
    const dbRow = {
        material: item.material,
        details: item.details,
        qty: Number(item.qty),
        due_date: item.due_date || null,
        is_completed: item.is_completed === true
    };

    // 2. ربط المشروع بالمعرف الرقمي الصحيح
    if (item.project && !isNaN(item.project)) {
        dbRow.project_id = Number(item.project);
        dbRow.project = Number(item.project); 
    } else if (item.project) {
        dbRow.project = item.project; 
    }

    // 3. الحل الذكي لحماية حقل الـ ID من قيد الـ Not-Null
    if (item.id && Number(item.id) !== 0) {
        // إذا كان الطلب قادماً بـ ID حقيقي (عملية تعديل أو تحديث لسطر قائم)
        dbRow.id = Number(item.id);
    } else {
        // إذا كان طلباً جديداً كلياً، نترك سوبابيس تولد الرقم تلقائياً
        // نقوم بحذف الخاصية تماماً من الكائن لكي لا تُرسل كـ null وتسبب انهياراً
        delete dbRow.id;
    }

    try {
        const { data, error } = await supabase
            .from('project_requests')
            .insert([dbRow])
            .select();
            
        if (error) {
            console.error("❌ خطأ Supabase المباشر في جدول project_requests:", error);
            
            // خطة إنقاذ احتياطية: إذا كان الجدول لا يولد أرقاماً تلقائية ويطلب ID صريح
            if (error.message.includes('violates not-null constraint') && error.message.includes('"id"')) {
                console.log("⚠️ الجدول يرفض التوليد التلقائي، سنقوم بتوليد معرف عشوائي فريد وسطي...");
                
                // توليد رقم فريد عشوائي كـ ID احتياطي (بين 10000 و 99999)
                dbRow.id = Math.floor(10000 + Math.random() * 90000);
                
                const retryResult = await supabase.from('project_requests').insert([dbRow]).select();
                if (retryResult.error) throw retryResult.error;
                
                console.log("✅ نجحت خطة الإنقاذ وتم الحفظ بالـ ID المولد يدوياً!");
                return res.json({ success: true, data: retryResult.data });
            }
            
            return res.status(500).json({ error: error.message });
        }

        console.log("✅ تم حفظ طلب المواد بنجاح في السحاب!");
        res.json({ success: true, data });
    } catch (err) {
        console.error("💥 تحطم مسار طلبات المواد كلياً:", err.message);
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

        // تم التصحيح هنا لإرسال المصفوفة المحولة مباشرة دون تضارب تسميات
        res.json(mappedSupervisors);
    } catch (err) {
        console.error("❌ خطأ جلب المشرفين بالسيرفر:", err.message);
        res.status(500).json([]); // إرجاع مصفوفة فارغة في حال حدوث خطأ لمنع انهيار الواجهة
    }
});

app.post('/api/project-supervisors', async (req, res) => {
    const { name, phone_number, project_id, username, password } = req.body;
    console.log("📥 بيانات المشرف المستلمة:", { name, phone_number, project_id, username });
    
    let createdUserId = null;
    
    try {
        // 1. إنشاء الحساب الأساسي في جدول المستخدمين أولاً (هنا يُخزن الـ username والـ password والـ role)
        const { data: userRow, error: userErr } = await supabase
            .from('users')
            .insert([{ username, password, role: 'supervisor', name }])
            .select()
            .single();

        if (userErr) {
            console.error("❌ خطأ Supabase أثناء إنشاء الحساب في جدول users:", userErr);
            return res.status(400).json({ error: `خطأ في جدول المستخدمين: ${userErr.message}` });
        }

        createdUserId = userRow.id; // الإمساك بالـ ID المولد لربطه بالمشرف

        // 2. بناء كائن المشرف النقي والمطابق لأعمدة جدول project_supervisors لديك تماماً
        // تم إزالة حقل username وحقل project_name نهائياً لمنع أي تضارب كاش
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
            
            // إجراء حمائي: إذا فشل تدوين المشرف، نحذف الحساب من جدول users فوراً حتى لا يعلق الاسم
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
// 1. جلب مراحل المشروع مع دمج الأسماء ديناميكياً للعرض في الشاشة
app.get('/api/project-stages', async (req, res) => {
    try {
        // جلب المراحل من جدولها النقي
        const { data: stages, error: stageErr } = await supabase
            .from('project_stages')
            .select('*')
            .order('id', { ascending: false });
            
        if (stageErr) throw stageErr;

        // جلب المشاريع لربط المعرفات بالأسماء الحقيقية
        const { data: projects } = await supabase.from('projects').select('*');

        // دمج البيانات برمجياً قبل إرسالها للواجهة لتجنب الـ null
        const mappedStages = (stages || []).map(s => {
            const matchProj = (projects || []).find(p => p.id === s.project_id);
            return {
                id: s.id,
                stage_name: s.stage_name || s.name, // دعم التسميتين الاحتياطيتين
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

// 2. حفظ وتدوين مرحلة تنفيذية جديدة بالاعتماد على الـ project_id الرقمي فقط
app.post('/api/project-stages', async (req, res) => {
    const item = req.body;
    console.log("📥 البيانات المستلمة للمرحلة:", item);

    // بناء السطر بناءً على الأعمدة القياسية الصافية لقاعدة بياناتك
    const dbRow = {
        stage_name: item.stage_name, 
        project_id: Number(item.project_id), // الاعتماد على الرقم فقط وتجنب الاسم النصي المسبب للمشاكل
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

// مسار افتراضي لتصفح ملف الـ HTML
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
