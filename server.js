const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// 根据环境加载配置
if (process.env.VERCEL) {
    // Vercel环境，直接使用环境变量
    console.log('Running in Vercel environment');
} else {
    // 本地环境，从.env文件加载
    require('dotenv').config();
    console.log('Running in local environment');
}

const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = process.env.DEEPSEEK_API_URL;

const server = http.createServer((req, res) => {
    // 设置CORS头部
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理CORS预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 处理API请求
    if (req.url === '/generate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const { englishName } = JSON.parse(body);
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

            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                }
            };

            const apiReq = https.request(API_URL, options, (apiRes) => {
                // 设置60秒超时
                apiReq.setTimeout(60000, () => {
                    apiReq.destroy();
                    res.writeHead(504);
                    res.end(JSON.stringify({ error: '请求超时' }));
                });
                let data = '';
                apiRes.on('data', (chunk) => {
                    data += chunk;
                });
                apiRes.on('end', () => {
                    console.log('\n=== API响应详情 ===');
                    console.log(`请求ID: ${apiRes.headers['x-request-id'] || '未提供'}`);
                    console.log(`状态码: ${apiRes.statusCode}`);
                    console.log('响应头:');
                    Object.entries(apiRes.headers).forEach(([key, value]) => {
                        console.log(`  ${key}: ${value}`);
                    });
                    console.log(`\n响应内容长度: ${data.length} 字节`);
                    
                    try {
                        const responseData = JSON.parse(data);
                        console.log('\n完整响应内容:');
                        console.log(JSON.stringify(responseData, null, 2));
                        
                        if (responseData.choices && responseData.choices.length > 0) {
                            console.log('\n生成的名字:');
                            responseData.choices.forEach((choice, index) => {
                                console.log(`\n--- 名字选项 ${index + 1} ---`);
                                console.log(choice.message.content);
                            });
                            console.log(`\n总共生成名字数量: ${responseData.choices.length}`);
                        }
                    } catch (error) {
                        console.log('\n解析响应数据时出错:', error.message);
                        console.log('原始响应数据:', data);
                    }
                    console.log('\n=== API响应结束 ===\n');
                    
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(data);
                });
            });

            apiReq.on('error', (error) => {
                console.error('API请求错误:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: '服务器内部错误，请稍后重试' }));
            });

            apiReq.write(JSON.stringify({
                model: 'deepseek-r1-250120',
                messages: [
                    { role: 'system', content: '你是一个专业的中文起名专家，精通中英文化和起名技巧。' },
                    { role: 'user', content: prompt }
                ]
            }));

            apiReq.end();
        });
        return;
    }

    // 处理静态文件请求
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    
    // 规范化文件路径
    filePath = path.normalize(filePath);
    
    // 只允许访问项目目录下的文件
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('访问被拒绝');
        return;
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
        // 如果请求的是目录，尝试返回目录下的index.html
        if (fs.existsSync(path.dirname(filePath)) && fs.statSync(path.dirname(filePath)).isDirectory()) {
            filePath = path.join(path.dirname(filePath), 'index.html');
            if (!fs.existsSync(filePath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('找不到请求的文件');
                return;
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('找不到请求的文件');
            return;
        }
    }

    // 获取文件扩展名
    const extname = path.extname(filePath);

    // 如果是目录，默认返回index.html
    if (fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('找不到请求的文件');
            return;
        }
    }

    // 读取文件
    fs.readFile(filePath, (error, content) => {
        if (error) {
            console.error(`文件读取错误: ${error.message}`);
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('找不到请求的文件');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('服务器内部错误');
            }
            return;
        }

        // 设置正确的Content-Type
        const contentType = mime.lookup(extname) || 'application/octet-stream';
        res.writeHead(200, { 
            'Content-Type': `${contentType}; charset=utf-8`,
            'Cache-Control': 'no-cache'
        });
        res.end(content, 'utf-8');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});