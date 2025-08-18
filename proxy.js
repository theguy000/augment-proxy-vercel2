// Vercel Serverless Function for Augment Code Proxy
const cors = require('cors');

// 简单的内存存储（生产环境建议使用数据库）
let accounts = new Map();

// CORS配置
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// 生成授权码
function generateAuthCode(token) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token + Date.now()).digest('hex').substring(0, 32);
}

// 主处理函数
module.exports = async function handler(req, res) {
  // 处理CORS
  await new Promise((resolve) => {
    cors(corsOptions)(req, res, resolve);
  });

  const { method, url } = req;
  const urlPath = new URL(url, `http://${req.headers.host}`).pathname;
  const query = new URL(url, `http://${req.headers.host}`).searchParams;

  console.log(`${method} ${urlPath}`, Object.fromEntries(query));

  try {
    // 健康检查
    if (urlPath === '/health' || urlPath === '/api/health') {
      return res.status(200).json({
        status: 'ok',
        service: 'augment-proxy-vercel',
        timestamp: new Date().toISOString(),
        accounts: accounts.size
      });
    }

    // 主页
    if (urlPath === '/' || urlPath === '/api') {
      return res.status(200).send(`
        <html>
          <head><title>Augment Code Proxy - Vercel</title></head>
          <body>
            <h1>Augment Code Proxy Server</h1>
            <p>Status: Running on Vercel</p>
            <p>Time: ${new Date().toISOString()}</p>
            <p>Accounts: ${accounts.size}</p>
            <h2>API Endpoints:</h2>
            <ul>
              <li>GET /api/health - Health check</li>
              <li>POST /api/accounts - Add account</li>
              <li>GET /api/accounts - List accounts</li>
              <li>POST /api/login - Process login</li>
              <li>GET /api/authorize - OAuth authorization</li>
            </ul>
          </body>
        </html>
      `);
    }

    // 添加账号
    if (urlPath === '/api/accounts' && method === 'POST') {
      const { email, accessToken, clientId, redirectUri } = req.body;

      if (!email || !accessToken) {
        return res.status(400).json({ error: '邮箱和访问令牌不能为空' });
      }

      const accountId = Date.now().toString();
      accounts.set(accountId, {
        id: accountId,
        email,
        accessToken,
        clientId: clientId || 'augment-intellij-plugin',
        redirectUri: redirectUri || 'http://127.0.0.1:63342/api/augment/auth/result',
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({ success: true, accountId });
    }

    // 获取账号列表
    if (urlPath === '/api/accounts' && method === 'GET') {
      const accountList = Array.from(accounts.values()).map(acc => ({
        id: acc.id,
        email: acc.email,
        clientId: acc.clientId,
        redirectUri: acc.redirectUri,
        createdAt: acc.createdAt
      }));
      return res.status(200).json(accountList);
    }

    // OAuth授权端点
    if (urlPath === '/api/authorize' || urlPath === '/authorize') {
      const response_type = query.get('response_type');
      const client_id = query.get('client_id');
      const redirect_uri = query.get('redirect_uri');
      const state = query.get('state');
      const scope = query.get('scope');

      console.log('OAuth授权请求:', {
        response_type, client_id, redirect_uri, state, scope
      });

      // 查找匹配的账号
      let account = null;
      for (const acc of accounts.values()) {
        if (acc.clientId === client_id && acc.redirectUri === redirect_uri) {
          account = acc;
          break;
        }
      }

      // 如果没有精确匹配，使用第一个账号
      if (!account && accounts.size > 0) {
        account = accounts.values().next().value;
      }

      if (!account) {
        return res.status(400).send(`
          <html>
            <head><title>No Account Found</title></head>
            <body>
              <h2>No Matching Account</h2>
              <p>No account found for client_id: ${client_id}</p>
              <p>Please add an account first.</p>
              <p><a href="/api">Back to Home</a></p>
            </body>
          </html>
        `);
      }

      // 生成授权码
      const authCode = generateAuthCode(account.accessToken);

      // 构建重定向URL
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('code', authCode);
      if (state) {
        redirectUrl.searchParams.set('state', state);
      }

      console.log(`重定向到: ${redirectUrl.toString()}`);

      // 重定向到IDEA
      return res.redirect(302, redirectUrl.toString());
    }

    // 处理登录请求
    if (urlPath === '/api/login' && method === 'POST') {
      const { loginUrl } = req.body;

      if (!loginUrl) {
        return res.status(400).json({ error: '登录URL不能为空' });
      }

      // 解析登录URL
      const url = new URL(loginUrl);
      const clientId = url.searchParams.get('client_id');
      const redirectUri = url.searchParams.get('redirect_uri');
      const state = url.searchParams.get('state');

      // 查找匹配的账号
      let account = null;
      for (const acc of accounts.values()) {
        if (acc.clientId === clientId && acc.redirectUri === redirectUri) {
          account = acc;
          break;
        }
      }

      if (!account && accounts.size > 0) {
        account = accounts.values().next().value;
      }

      if (!account) {
        return res.status(400).json({ error: '没有找到匹配的账号' });
      }

      // 生成授权码
      const authCode = generateAuthCode(account.accessToken);

      // 构建回调URL
      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set('code', authCode);
      if (state) {
        callbackUrl.searchParams.set('state', state);
      }

      // 尝试访问IDEA回调
      try {
        const fetch = require('node-fetch');
        const callbackResponse = await fetch(callbackUrl.toString(), {
          timeout: 10000,
          headers: {
            'User-Agent': 'Augment-Proxy-Vercel/1.0'
          }
        });

        return res.status(200).json({
          success: true,
          account: account.email,
          callbackUrl: callbackUrl.toString(),
          callbackStatus: callbackResponse.status,
          message: '登录处理完成'
        });
      } catch (error) {
        return res.status(200).json({
          success: true,
          account: account.email,
          callbackUrl: callbackUrl.toString(),
          callbackError: error.message,
          message: '授权码已生成，但回调可能失败'
        });
      }
    }

    // 404
    return res.status(404).json({ error: 'Not Found' });

  } catch (error) {
    console.error('处理请求时出错:', error);
    return res.status(500).json({
      error: '服务器内部错误',
      message: error.message
    });
  }
}
