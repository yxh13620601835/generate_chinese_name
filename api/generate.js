const https = require('https');

export default async function handler(req, res) {
    // 设置CORS头部
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 处理CORS预检请求
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    // 只处理POST请求
    if (req.method !== 'POST') {
        res.status(405).json({ error: '方法不允许' });
        return;
    }

    try {
        const { englishName } = req.body;
        if (!englishName) {
            res.status(400).json({ error: '请提供英文名' });
            return;
        }

        const prompt = `作为一个专业的中文起名专家，请为英文名"${englishName}"生成3个有趣且富有中国文化特色的中文名字。每个名字都应该：
1. 体现中国传统文化元素
2. 包含一些巧妙的谐音或双关语
3. 与英文名的含义有某种关联
4. 名字要朗朗上口，易于记忆

请按以下格式返回：
中文名1：[名字]
寓意：[中文解释]
Meaning: [英文解释]

中文名2：[名字]
寓意：[中文解释]
Meaning: [英文解释]

中文名3：[名字]
寓意：[中文解释]
Meaning: [英文解释]`;

        const API_KEY = process.env.DEEPSEEK_API_KEY;
        const API_URL = process.env.DEEPSEEK_API_URL;

        const response = await new Promise((resolve, reject) => {
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                }
            };

            const apiReq = https.request(API_URL, options, (apiRes) => {
                let data = '';
                apiRes.on('data', (chunk) => data += chunk);
                apiRes.on('end', () => resolve({ statusCode: apiRes.statusCode, data }));
            });

            apiReq.on('error', reject);
            apiReq.write(JSON.stringify({
                model: 'deepseek-r1-250120',
                messages: [
                    { role: 'system', content: '你是一个专业的中文起名专家，精通中英文化和起名技巧。' },
                    { role: 'user', content: prompt }
                ]
            }));
            apiReq.end();
        });

        if (response.statusCode !== 200) {
            throw new Error(`API请求失败: ${response.statusCode}`);
        }

        const responseData = JSON.parse(response.data);
        res.status(200).json(responseData);

    } catch (error) {
        console.error('处理请求时出错:', error);
        res.status(500).json({ error: '服务器内部错误，请稍后重试' });
    }
}