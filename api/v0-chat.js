// API endpoint for V0 AI integration
import dotenv from 'dotenv';
try{ dotenv.config(); }catch{}

export default async function handler(req, res){
  if (req.method !== 'POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({ ok:false, error:'Method Not Allowed' });
  }
  
  try{
    const { message, context, language = 'arabic' } = req.body || {};
    
    if (!message) {
      return res.status(400).json({ ok: false, error: 'Message is required' });
    }
    
    // Get V0 API key from environment
    const v0ApiKey = process.env.V0_API_Key || process.env.V0_API_KEY || process.env.UI_API_Key;
    
    if (!v0ApiKey) {
      // Fallback to OpenAI or local processing
      return res.status(400).json({ 
        ok: false, 
        error: 'V0 API not configured',
        fallback: true
      });
    }
    
    // Prepare V0 API request
    const v0Payload = {
      message: message,
      context: context || 'You are a helpful AI assistant for QuickITQuote, specializing in IT products and solutions. Respond in Arabic.',
      model: 'gpt-4',
      stream: false
    };
    
    // Call V0 API
    const v0Response = await fetch('https://api.v0.dev/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${v0ApiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'QuickITQuote/1.0'
      },
      body: JSON.stringify(v0Payload)
    });
    
    if (!v0Response.ok) {
      const errorText = await v0Response.text();
      console.error('V0 API Error:', v0Response.status, errorText);
      
      // Fallback response
      return res.status(200).json({
        ok: true,
        response: generateFallbackResponse(message),
        provider: 'fallback',
        note: 'V0 API unavailable, using fallback response'
      });
    }
    
    const v0Data = await v0Response.json();
    
    return res.status(200).json({
      ok: true,
      response: v0Data.response || v0Data.message || 'عذراً، لم أتمكن من معالجة طلبك.',
      provider: 'v0',
      model: 'gpt-4'
    });
    
  } catch (error) {
    console.error('V0 Chat API Error:', error);
    
    // Return fallback response instead of error
    const fallbackResponse = generateFallbackResponse(req.body?.message || '');
    
    return res.status(200).json({
      ok: true,
      response: fallbackResponse,
      provider: 'fallback',
      error: 'API temporarily unavailable'
    });
  }
}

function generateFallbackResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  // Arabic keywords detection
  if (lowerMessage.includes('سويتش') || lowerMessage.includes('switch')) {
    return `🔌 أهلاً بك! لدينا مجموعة متنوعة من السويتشات:
    
• سويتش 24 منفذ جيجابايت - مثالي للمكاتب الصغيرة
• سويتش 48 منفذ مع PoE - للشبكات الكبيرة
• سويتشات Layer 3 المُدارة - للشبكات المتقدمة

ما هي احتياجاتك المحددة؟ عدد المنافذ المطلوبة؟`;
  }
  
  if (lowerMessage.includes('راوتر') || lowerMessage.includes('router')) {
    return `🌐 ممتاز! نوفر راوترات متنوعة:
    
• راوترات WiFi 6 للمكاتب الحديثة
• راوترات إنتربرايز مع VPN
• راوترات الألياف البصرية عالية السرعة

أخبرني عن حجم الشبكة وسرعة الإنترنت المطلوبة؟`;
  }
  
  if (lowerMessage.includes('كابل') || lowerMessage.includes('cable')) {
    return `🔗 لدينا كابلات عالية الجودة:
    
• Cat6 UTP - للشبكات الداخلية العادية
• Cat6a - لسرعات أعلى ومسافات أطول  
• Fiber Optic - للمسافات الطويلة والسرعات العالية

ما هي المسافة المطلوبة؟ داخلي أم خارجي؟`;
  }
  
  if (lowerMessage.includes('سعر') || lowerMessage.includes('price') || lowerMessage.includes('تكلفة')) {
    return `💰 بالطبع! يسرني مساعدتك في الحصول على أفضل الأسعار:
    
• اختر المنتجات من الكتالوج
• أضفها إلى سلة الاقتباس  
• احصل على عرض سعر مخصص فوراً
• خصومات خاصة للكميات الكبيرة

هل تريد مساعدة في اختيار منتجات محددة؟`;
  }
  
  if (lowerMessage.includes('مساعدة') || lowerMessage.includes('help')) {
    return `🤝 أنا هنا لمساعدتك! يمكنني:
    
✅ تقديم معلومات عن المنتجات
✅ مساعدتك في اختيار الحلول المناسبة
✅ إعداد عروض أسعار مخصصة
✅ الإجابة على الاستفسارات التقنية

ما الذي تحتاج مساعدة به تحديداً؟`;
  }
  
  // Default response
  return `🙋‍♂️ أهلاً وسهلاً بك في QuickITQuote!
  
أنا مساعدك الذكي المتخصص في حلول تكنولوجيا المعلومات. يمكنني مساعدتك في:

🔍 العثور على المنتجات المناسبة
💡 تقديم استشارات تقنية
📋 إعداد عروض أسعار مخصصة
🛠️ اختيار الحلول المتكاملة

كيف يمكنني مساعدتك اليوم؟`;
}