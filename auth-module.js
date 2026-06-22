// auth-module.js - وحدة إدارة الحماية وتوثيق المستخدمين النظيفة

/**
 * دالة إرسال بيانات تسجيل الدخول للسيرفر المحلي
 * @param {string} username 
 * @param {string} password 
 */
export async function loginUser(username, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (data.success) {
            // تخزين التوكن والبيانات في المتصفح
            localStorage.setItem('orkida_token', data.token);
            localStorage.setItem('orkida_user', JSON.stringify(data.user));
            return { success: true, message: data.message };
        } else {
            return { success: false, message: data.message || 'فشل تسجيل الدخول' };
        }
    } catch (error) {
        console.error('Auth Module Error:', error);
        return { success: false, message: 'فشل الاتصال بالسيرفر المحلي' };
    }
}

/**
 * دالة فحص هل المستخدم مسجل دخوله حالياً وصلاحية التوكن موجودة
 */
export function isAuthenticated() {
    const token = localStorage.getItem('orkida_token');
    return !!token; 
}

/**
 * دالة تسجيل الخروج وتصفير المتصفح
 */
export function logoutUser() {
    localStorage.removeItem('orkida_token');
    localStorage.removeItem('orkida_user');
    window.location.reload();
}