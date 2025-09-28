/**
 * OpenAI Assistant API Integration for QuickITQuote
 * 
 * Uses Assistant ID: asst_OYoqbbkPzgI6kojL6iliOiM (Sales and Presales Agent)
 * Provides intelligent product support and presales Q&A
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ASSISTANT_ID = 'asst_OYoqbbkPzgI6kojL6iliOiM';

    if (!OPENAI_API_KEY) {
        return res.status(200).json({
            success: false,
            message: 'OpenAI API key not configured',
            fallback: true,
            response: 'مرحباً! كيف يمكنني مساعدتك اليوم؟'
        });
    }

    try {
        const { action, data } = req.body || {};

        switch (action) {
            case 'create_thread':
                return await createThread(res, OPENAI_API_KEY);
            
            case 'send_message':
                return await sendMessage(data, res, OPENAI_API_KEY, ASSISTANT_ID);
            
            case 'get_messages':
                return await getMessages(data, res, OPENAI_API_KEY);
            
            default:
                return await handleDirectMessage(req.body, res, OPENAI_API_KEY, ASSISTANT_ID);
        }
    } catch (error) {
        console.error('OpenAI Assistant API Error:', error);
        return res.status(200).json({
            success: false,
            message: 'Chat service temporarily unavailable',
            error: error.message,
            fallback: true,
            response: getFallbackResponse(req.body?.message || '')
        });
    }
}

/**
 * إنشاء thread جديد للمحادثة
 */
async function createThread(res, apiKey) {
    try {
        const response = await fetch('https://api.openai.com/v1/threads', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                metadata: {
                    source: 'QuickITQuote',
                    created_at: new Date().toISOString()
                }
            })
        });

        const thread = await response.json();

        if (!response.ok) {
            throw new Error(`OpenAI Thread Creation Error: ${thread.error?.message || response.statusText}`);
        }

        return res.status(200).json({
            success: true,
            thread_id: thread.id,
            message: 'Thread created successfully'
        });

    } catch (error) {
        console.error('Create thread error:', error);
        throw error;
    }
}

/**
 * إرسال رسالة ومعالجة الرد باستخدام المساعد
 */
async function sendMessage(data, res, apiKey, assistantId) {
    try {
        const { thread_id, message, user_context } = data;

        if (!thread_id || !message) {
            throw new Error('Thread ID and message are required');
        }

        // 1. إضافة رسالة المستخدم إلى الـ thread
        await addMessageToThread(thread_id, message, user_context, apiKey);

        // 2. تشغيل المساعد
        const run = await runAssistant(thread_id, assistantId, apiKey);

        // 3. انتظار اكتمال التشغيل
        const completedRun = await waitForRunCompletion(thread_id, run.id, apiKey);

        // 4. جلب الرد
        const messages = await getThreadMessages(thread_id, apiKey);
        const assistantReply = extractAssistantReply(messages);

        return res.status(200).json({
            success: true,
            response: assistantReply,
            thread_id: thread_id,
            run_id: completedRun.id,
            tokens_used: completedRun.usage || null
        });

    } catch (error) {
        console.error('Send message error:', error);
        throw error;
    }
}

/**
 * معالجة مباشرة للرسائل (ينشئ thread تلقائياً)
 */
async function handleDirectMessage(body, res, apiKey, assistantId) {
    try {
        const { message, thread_id, user_context } = body;

        if (!message) {
            throw new Error('Message is required');
        }

        let currentThreadId = thread_id;

        // إنشاء thread جديد إذا لم يكن موجوداً
        if (!currentThreadId) {
            const threadResponse = await fetch('https://api.openai.com/v1/threads', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'OpenAI-Beta': 'assistants=v2'
                }
            });

            const thread = await threadResponse.json();
            currentThreadId = thread.id;
        }

        // إرسال الرسالة ومعالجة الرد
        const messageData = {
            thread_id: currentThreadId,
            message: message,
            user_context: user_context
        };

        return await sendMessage(messageData, res, apiKey, assistantId);

    } catch (error) {
        console.error('Direct message error:', error);
        throw error;
    }
}

/**
 * إضافة رسالة المستخدم إلى الـ thread
 */
async function addMessageToThread(threadId, message, userContext, apiKey) {
    // إعداد السياق المحسن للمساعد
    let enhancedMessage = message;
    
    if (userContext) {
        const contextInfo = [];
        
        if (userContext.page) contextInfo.push(`الصفحة الحالية: ${userContext.page}`);
        if (userContext.products && userContext.products.length > 0) {
            contextInfo.push(`المنتجات المحددة: ${userContext.products.join(', ')}`);
        }
        if (userContext.quote_items) contextInfo.push(`عناصر في السلة: ${userContext.quote_items}`);
        
        if (contextInfo.length > 0) {
            enhancedMessage = `${message}\n\nمعلومات إضافية: ${contextInfo.join(' | ')}`;
        }
    }

    const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
            role: 'user',
            content: enhancedMessage,
            metadata: {
                source: 'QuickITQuote',
                timestamp: new Date().toISOString(),
                user_context: userContext
            }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to add message: ${error.error?.message || response.statusText}`);
    }

    return await response.json();
}

/**
 * تشغيل المساعد على الـ thread
 */
async function runAssistant(threadId, assistantId, apiKey) {
    const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
            assistant_id: assistantId,
            additional_instructions: `
                أنت مساعد مبيعات ومشاورات ما قبل البيع لشركة QuickITQuote المتخصصة في معدات تكنولوجيا المعلومات.
                
                مهامك:
                1. مساعدة العملاء في العثور على المنتجات المناسبة
                2. تقديم معلومات تقنية دقيقة عن المنتجات
                3. اقتراح حلول متكاملة حسب احتياجات العميل
                4. المساعدة في عملية طلب الأسعار
                5. الإجابة على الأسئلة الفنية والتجارية
                
                أسلوبك:
                - احترافي ومفيد
                - واضح ومباشر
                - باللغة العربية مع استخدام المصطلحات التقنية بالإنجليزية عند الضرورة
                - مركز على احتياجات العميل
                - مشجع لإتمام عملية الشراء بشكل طبيعي
                
                معلومات مهمة:
                - الشركة متخصصة في معدات IT للشركات والمؤسسات
                - نقدم حلول متكاملة من الخوادم إلى أجهزة الحاسوب
                - لدينا فريق دعم فني متخصص
                - نوفر ضمانات وخدمات ما بعد البيع
            `,
            metadata: {
                source: 'QuickITQuote',
                run_timestamp: new Date().toISOString()
            }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to run assistant: ${error.error?.message || response.statusText}`);
    }

    return await response.json();
}

/**
 * انتظار اكتمال تشغيل المساعد
 */
async function waitForRunCompletion(threadId, runId, apiKey, maxWaitTime = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
        const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to check run status: ${response.statusText}`);
        }

        const run = await response.json();

        if (run.status === 'completed') {
            return run;
        } else if (run.status === 'failed') {
            throw new Error(`Assistant run failed: ${run.last_error?.message || 'Unknown error'}`);
        } else if (run.status === 'requires_action') {
            // التعامل مع الإجراءات المطلوبة (إذا كان المساعد يستخدم tools)
            console.log('Run requires action:', run.required_action);
            // يمكن إضافة منطق للتعامل مع function calls هنا
        }

        // انتظار ثانية قبل المحاولة التالية
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Assistant run timed out');
}

/**
 * جلب رسائل الـ thread
 */
async function getThreadMessages(threadId, apiKey) {
    const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
    }

    return await response.json();
}

/**
 * استخراج رد المساعد من الرسائل
 */
function extractAssistantReply(messagesResponse) {
    const messages = messagesResponse.data || [];
    
    // البحث عن آخر رسالة من المساعد
    const assistantMessage = messages.find(msg => msg.role === 'assistant');
    
    if (assistantMessage && assistantMessage.content && assistantMessage.content.length > 0) {
        // استخراج النص من المحتوى
        const textContent = assistantMessage.content.find(content => content.type === 'text');
        return textContent ? textContent.text.value : 'عذراً، لم أستطع معالجة طلبك.';
    }

    return 'عذراً، لم أستطع الحصول على رد مناسب.';
}

/**
 * جلب الرسائل (endpoint منفصل)
 */
async function getMessages(data, res, apiKey) {
    try {
        const { thread_id } = data;

        if (!thread_id) {
            throw new Error('Thread ID is required');
        }

        const messages = await getThreadMessages(thread_id, apiKey);

        return res.status(200).json({
            success: true,
            messages: messages.data || [],
            message_count: messages.data?.length || 0
        });

    } catch (error) {
        console.error('Get messages error:', error);
        throw error;
    }
}

/**
 * ردود احتياطية في حالة فشل الـ API
 */
function getFallbackResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('سعر') || lowerMessage.includes('price')) {
        return 'يمكنني مساعدتك في الحصول على أفضل الأسعار لمعدات IT. يرجى تحديد المنتجات التي تحتاجها وسأقوم بإعداد عرض سعر مخصص لك.';
    }
    
    if (lowerMessage.includes('خادم') || lowerMessage.includes('server')) {
        return 'لدينا مجموعة واسعة من الخوادم من أفضل الماركات العالمية. ما هي متطلباتك التقنية والميزانية المتاحة؟';
    }
    
    if (lowerMessage.includes('حاسوب') || lowerMessage.includes('laptop') || lowerMessage.includes('computer')) {
        return 'نوفر أحدث أجهزة الحاسوب للشركات والمؤسسات. هل تبحث عن أجهزة مكتبية أم محمولة؟ وما هي المواصفات المطلوبة؟';
    }
    
    if (lowerMessage.includes('شبكة') || lowerMessage.includes('network')) {
        return 'نقدم حلول شبكات متكاملة تشمل المعدات والتركيب والدعم الفني. ما حجم الشبكة التي تحتاجها؟';
    }
    
    return 'مرحباً بك في QuickITQuote! أنا هنا لمساعدتك في العثور على أفضل معدات تكنولوجيا المعلومات لشركتك. كيف يمكنني مساعدتك اليوم؟';
}