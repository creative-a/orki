// وحدة الاتصال المركزية بنظام الموديول (API Client Module)

// دالة مساعدة مركزية لإضافة الـ Headers والتوكن تلقائياً لأي طلب
async function request(url, options = {}) {
    const token = localStorage.getItem('ork_token');
    
    // تجهيز الـ Headers وتضمين الـ JWT Token إذا كان موجوداً
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // دمج الإعدادات وإرسال الطلب
    const config = {
        ...options,
        headers
    };

    try {
        const response = await fetch(url, config);
        
        // إذا انتهت صلاحية الجلسة أو كان التوكن تالفاً (401 أو 403)
        if (response.status === 401 || response.status === 403) {
            console.warn("⚠️ جلسة غير مصرح بها أو منتهية الصلاحية. يتم التوجيه لتسجيل الدخول.");
            localStorage.removeItem('ork_token');
            localStorage.removeItem('ork_u_obj');
            window.location.reload(); // إعادة تحميل الصفحة ليتم طرده لصفحة الدخول
            throw new Error("Session expired or unauthorized");
        }

        return response;
    } catch (error) {
        console.error(`💥 فشل الاتصال بالمسار (${url}):`, error);
        throw error;
    }
}

// تصدير دوال الاتصال القياسية لكي تستخدمها بقية موديولات النظام بسلاسة
export const api = {
    get: (url, options) => request(url, { method: 'GET', ...options }),
    post: (url, body, options) => request(url, { method: 'POST', body: JSON.stringify(body), ...options }),
    put: (url, body, options) => request(url, { method: 'PUT', body: JSON.stringify(body), ...options }),
    delete: (url, options) => request(url, { method: 'DELETE', ...options })
};