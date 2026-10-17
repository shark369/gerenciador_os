if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
const fs = require('fs');
const logStream = fs.createWriteStream('log.txt', { flags: 'a' });
console.log = function(...args) {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  logStream.write(new Date().toISOString() + ': ' + message + '\n');
  process.stdout.write(new Date().toISOString() + ': ' + message + '\n');
};
console.error = console.log;

const express = require('express');
const { Pool } = require('pg'); // Changed from mysql2 to pg
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const JACIRA_USERNAME = 'jacira';
const JACIRA_INITIAL_PASSWORD = process.env.JACIRA_INITIAL_PASSWORD || '9176';
const JACIRA_ROLE = 'recepcao';
const JUNIOR_USERNAME = 'junior';
const DEFAULT_INITIAL_PASSWORD = process.env.DEFAULT_INITIAL_PASSWORD || '123';
const JUNIOR_ROLE = 'recepcao';
const RESTRICTED_RECEPCAO_USERNAMES = ['tarcio', 'safira', JUNIOR_USERNAME];

function isRestrictedRecepcaoUser(username, role) {
    return role === 'recepcao' && RESTRICTED_RECEPCAO_USERNAMES.includes(username);
}

const SERVICE_ORDER_COLUMNS_JOIN = 'so.id, so.osId, so.clientName, so.clientPhone, to_char(so.osDate, \'YYYY-MM-DD\') AS osDate, so.description, so.status, so.products::text, so.discountType, so.discountValue, so.totalValue, so.totalDue, so.sector, so.createdBy, so.createdAt, so.converterId, c.name AS converterName';

function parseConverterId(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toSqlDate(value) {
    if (!value) return value;
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : value;
}

const app = express();
const backendPort = process.env.PORT || 3001;

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for simplicity. For better security, restrict this to your frontend URL.
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Protect sensitive files from direct static access
const BLOCKED_EXTENSIONS = /\.(dump|sql|env|log|txt|bak|json|md|ps1|bat|sh|tar|gz|zip)$/i;
const BLOCKED_FILENAMES = ['server.js', '.env'];

app.use((req, res, next) => {
    const requestedPath = req.path.toLowerCase().replace(/^\/+/, '');
    
    // Bloqueia dotfiles (.git, .env, etc.)
    if (requestedPath.startsWith('.') || requestedPath.includes('/.')) {
        return res.status(403).send('Acesso proibido.');
    }

    // Bloqueia extensões sensíveis e arquivos de servidor
    if (BLOCKED_EXTENSIONS.test(requestedPath) || BLOCKED_FILENAMES.includes(requestedPath)) {
        return res.status(403).send('Acesso proibido.');
    }

    next();
});

app.use(express.static(__dirname, { dotfiles: 'ignore' }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/:filename', (req, res) => {
    const { filename } = req.params;
    if (filename.endsWith('.html')) {
        res.sendFile(path.join(__dirname, filename));
    } else {
        res.status(404).send('File not found');
    }
});

// PostgreSQL Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test PostgreSQL connection and setup schema
if (!process.env.DATABASE_URL) {
    console.error('ERRO CRÍTICO: A variável de ambiente DATABASE_URL não está definida.');
    process.exit(1);
}

async function initializeDatabase(retries = 5, delayMs = 3000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        console.log(`Tentando conectar ao banco de dados PostgreSQL (tentativa ${attempt}/${retries})...`);
        try {
            const client = await pool.connect();
            try {
                console.log('Conexão com o banco de dados PostgreSQL estabelecida com sucesso!');

                // Create service_orders table
                await client.query(`
                    CREATE TABLE IF NOT EXISTS service_orders (
                        id SERIAL PRIMARY KEY,
                        osId VARCHAR(255) UNIQUE NOT NULL,
                        clientName VARCHAR(255) NOT NULL,
                        clientPhone VARCHAR(20),
                        osDate DATE NOT NULL,
                        description TEXT,
                        status VARCHAR(50) NOT NULL,
                        products JSON,
                        discountType VARCHAR(50),
                        discountValue DECIMAL(10, 2),
                        totalValue DECIMAL(10, 2) NOT NULL,
                        totalDue DECIMAL(10, 2) NOT NULL,
                        sector VARCHAR(50),
                        createdBy VARCHAR(255),
                        createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('Tabela service_orders verificada/criada com sucesso.');

                // Create converters table
                await client.query(`
                    CREATE TABLE IF NOT EXISTS converters (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        active BOOLEAN DEFAULT true,
                        cep VARCHAR(10),
                        address VARCHAR(255),
                        number VARCHAR(20),
                        complement VARCHAR(100),
                        neighborhood VARCHAR(100),
                        city VARCHAR(100),
                        state VARCHAR(50),
                        phone VARCHAR(20),
                        email VARCHAR(255),
                        createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('Tabela converters verificada/criada com sucesso.');

                // Add converterId column if missing
                await client.query(`
                    ALTER TABLE service_orders
                    ADD COLUMN IF NOT EXISTS converterId INTEGER REFERENCES converters(id) ON DELETE SET NULL
                `);

                // Backfill converterId by matching exact client names
                const backfillResult = await client.query(`
                    UPDATE service_orders AS so
                    SET converterId = mapped.converter_id
                    FROM (
                        SELECT DISTINCT ON (LOWER(TRIM(name)))
                            id AS converter_id,
                            LOWER(TRIM(name)) AS converter_name
                        FROM converters
                        ORDER BY LOWER(TRIM(name)), id
                    ) AS mapped
                    WHERE so.converterId IS NULL
                      AND LOWER(TRIM(so.clientName)) = mapped.converter_name
                `);
                console.log(`Coluna converterId verificada. OSs vinculadas por nome: ${backfillResult.rowCount}.`);

                // Create users table
                await client.query(`
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR(255) UNIQUE NOT NULL,
                        password VARCHAR(255) NOT NULL,
                        role VARCHAR(50) NOT NULL,
                        createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('Tabela users verificada/criada com sucesso.');

                // Check if users table is empty
                const userCountResult = await client.query('SELECT COUNT(*) as count FROM users');
                if (userCountResult.rows[0].count == 0) {
                    console.log('Populando tabela de usuários...');
                    const defaultUsers = [
                        { username: JACIRA_USERNAME, password: JACIRA_INITIAL_PASSWORD, role: JACIRA_ROLE },
                        { username: 'tarcio', password: DEFAULT_INITIAL_PASSWORD, role: 'recepcao' },
                        { username: 'safira', password: DEFAULT_INITIAL_PASSWORD, role: 'recepcao' },
                        { username: 'grafica', password: DEFAULT_INITIAL_PASSWORD, role: 'grafica' },
                        { username: JUNIOR_USERNAME, password: DEFAULT_INITIAL_PASSWORD, role: JUNIOR_ROLE }
                    ];

                    for (const user of defaultUsers) {
                        const hashedPassword = await bcrypt.hash(user.password, saltRounds);
                        await client.query(
                            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                            [user.username, hashedPassword, user.role]
                        );
                    }
                    console.log('Tabela de usuários populada com sucesso.');
                }

                // Garante que o usuário jacira exista com role correto (sem sobrescrever senha se já existir)
                const jaciraResult = await client.query(
                    'SELECT username, role FROM users WHERE username = $1',
                    [JACIRA_USERNAME]
                );
                if (jaciraResult.rowCount === 0) {
                    const jaciraHashedPassword = await bcrypt.hash(JACIRA_INITIAL_PASSWORD, saltRounds);
                    await client.query(
                        'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                        [JACIRA_USERNAME, jaciraHashedPassword, JACIRA_ROLE]
                    );
                    console.log('Usuária jacira criada com sucesso.');
                } else if (jaciraResult.rows[0].role !== JACIRA_ROLE) {
                    await client.query('UPDATE users SET role = $1 WHERE username = $2', [JACIRA_ROLE, JACIRA_USERNAME]);
                    console.log('Role da jacira ajustada para recepcao.');
                }

                // Garante que o usuário junior exista com role correto (sem sobrescrever senha se já existir)
                const juniorResult = await client.query(
                    'SELECT username, role FROM users WHERE username = $1',
                    [JUNIOR_USERNAME]
                );
                if (juniorResult.rowCount === 0) {
                    const juniorHashedPassword = await bcrypt.hash(DEFAULT_INITIAL_PASSWORD, saltRounds);
                    await client.query(
                        'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                        [JUNIOR_USERNAME, juniorHashedPassword, JUNIOR_ROLE]
                    );
                    console.log('Usuário junior criado com sucesso.');
                } else if (juniorResult.rows[0].role !== JUNIOR_ROLE) {
                    await client.query('UPDATE users SET role = $1 WHERE username = $2', [JUNIOR_ROLE, JUNIOR_USERNAME]);
                    console.log('Role do junior ajustada para recepcao.');
                }

                return; // Sucesso completo
            } finally {
                client.release();
            }
        } catch (err) {
            console.error(`Erro ao conectar/inicializar banco de dados (tentativa ${attempt}/${retries}):`, err.message);
            if (attempt < retries) {
                console.log(`Aguardando ${delayMs / 1000}s para nova tentativa...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                console.error('ERRO CRÍTICO: Não foi possível conectar ao banco de dados após todas as tentativas.');
            }
        }
    }
}

initializeDatabase();


// API Routes

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Usuário ou senha incorretos.' });
        }

        const match = await bcrypt.compare(password, user.password);

        if (match) {
            res.json({
                message: 'Login bem-sucedido!',
                role: user.role,
                username: user.username
            });
        } else {
            res.status(401).json({ message: 'Usuário ou senha incorretos.' });
        }
    } catch (err) {
        console.error('Erro ao fazer login:', err.stack);
        res.status(500).json({ message: 'Erro no servidor durante o login.', error: err.message });
    }
});

// POST /api/change-password (Para usuário alterar sua própria senha)
app.post('/api/change-password', async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;

    if (!username || !currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    if (newPassword.length < 3) {
        return res.status(400).json({ message: 'A nova senha deve ter no mínimo 3 caracteres.' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
            return res.status(401).json({ message: 'Senha atual incorreta.' });
        }

        const newHash = await bcrypt.hash(newPassword, saltRounds);
        await pool.query('UPDATE users SET password = $1 WHERE username = $2', [newHash, username]);

        console.log(`Senha do usuário ${username} alterada com sucesso.`);
        res.json({ message: 'Senha alterada com sucesso!' });
    } catch (err) {
        console.error('Erro ao alterar senha:', err.stack);
        res.status(500).json({ message: 'Erro interno ao alterar senha.', error: err.message });
    }
});

// POST /api/reset-password (Para redefinição caso esqueça a senha, usando Chave de Segurança)
app.post('/api/reset-password', async (req, res) => {
    const { username, securityKey, newPassword } = req.body;

    if (!username || !securityKey || !newPassword) {
        return res.status(400).json({ message: 'Usuário, Chave de Segurança e Nova Senha são obrigatórios.' });
    }

    if (newPassword.length < 3) {
        return res.status(400).json({ message: 'A nova senha deve ter no mínimo 3 caracteres.' });
    }

    const expectedKey = process.env.ADMIN_RESET_KEY || 'stampex2026';
    if (securityKey !== expectedKey) {
        return res.status(403).json({ message: 'Chave de segurança incorreta. Solicite a chave ao administrador do sistema.' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const newHash = await bcrypt.hash(newPassword, saltRounds);
        await pool.query('UPDATE users SET password = $1 WHERE username = $2', [newHash, username]);

        console.log(`Senha do usuário ${username} redefinida via Chave de Segurança.`);
        res.json({ message: 'Senha redefinida com sucesso! Você já pode fazer login com a nova senha.' });
    } catch (err) {
        console.error('Erro ao redefinir senha:', err.stack);
        res.status(500).json({ message: 'Erro interno ao redefinir senha.', error: err.message });
    }
});

// GET service orders with pagination and filtering
app.get('/api/serviceOrders', async (req, res) => {
    const userRole = req.query.role;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const search = req.query.search ? req.query.search.trim() : null;
    const status = req.query.status ? req.query.status.trim() : null;
    const editableOnly = req.query.editableOnly === 'true';

    const typeFilter = req.query.typeFilter; // 'revendedores' | 'avulsos'

    let query = `
        SELECT ${SERVICE_ORDER_COLUMNS_JOIN} 
        FROM service_orders so 
        LEFT JOIN converters c ON c.id = so.converterId 
        WHERE 1=1
    `;
    const params = [];

    if (editableOnly) {
        params.push('Paga', 'Entregue');
        query += ` AND so.status NOT IN ($${params.length - 1}, $${params.length})`;
    } else {
        params.push('Entregue');
        query += ` AND so.status != $${params.length}`;
    }

    if (userRole === 'grafica') {
        params.push('Grafica', 'Pendente');
        query += ` AND so.sector = $${params.length - 1} AND so.status = $${params.length}`;
    } else if (userRole === 'impressao') {
        params.push('Impressao Digital', 'Pendente');
        query += ` AND so.sector = $${params.length - 1} AND so.status = $${params.length}`;
    } else if (status && status !== 'Todas') {
        params.push(status);
        query += ` AND so.status = $${params.length}`;
    }

    if (typeFilter === 'revendedores') {
        query += ` AND so.converterId IS NOT NULL`;
    } else if (typeFilter === 'avulsos') {
        query += ` AND so.converterId IS NULL`;
    }

    if (search) {
        params.push(`%${search.toLowerCase()}%`);
        query += ` AND (
            LOWER(so.clientName) LIKE $${params.length} 
            OR LOWER(so.osId) LIKE $${params.length}
            OR LOWER(COALESCE(c.name, '')) LIKE $${params.length}
        )`;
    }

    query += ' ORDER BY so.createdAt DESC, so.id DESC';

    if (limit && limit > 0) {
        params.push(limit);
        query += ` LIMIT $${params.length}`;
        if (offset && offset > 0) {
            params.push(offset);
            query += ` OFFSET $${params.length}`;
        }
    }

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar ordens de serviço:', err.stack);
        res.status(500).json({ message: 'Erro ao buscar ordens de serviço.' });
    }
});

// GET reports (include TODAS as OS, inclusive Entregue)
app.get('/api/reports', async (req, res) => {
    const { startDate, endDate, converterName, username } = req.query;
    const converterId = parseConverterId(req.query.converterId || req.query.converterid);

    if (username !== 'jacira') {
        return res.status(403).json({ message: 'Acesso negado ao relatório.' });
    }

    const conditions = [];
    const params = [];

    if (startDate) {
        params.push(toSqlDate(startDate));
        conditions.push(`so.osDate >= $${params.length}`);
    }

    if (endDate) {
        params.push(toSqlDate(endDate));
        conditions.push(`so.osDate <= $${params.length}`);
    }

    if (converterId) {
        params.push(converterId);
        if (converterName) {
            params.push(converterName);
            conditions.push(`(
                so.converterId = $${params.length - 1}
                OR (so.converterId IS NULL AND LOWER(TRIM(so.clientName)) = LOWER(TRIM($${params.length})))
            )`);
        } else {
            conditions.push(`so.converterId = $${params.length}`);
        }
    }

    let query = `
        SELECT ${SERVICE_ORDER_COLUMNS_JOIN}
        FROM service_orders so
        LEFT JOIN converters c ON c.id = so.converterId
    `;

    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY so.osDate DESC, so.createdAt DESC';

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao gerar relatório de OS:', err.stack);
        res.status(500).json({ message: 'Erro ao gerar relatório de OS.' });
    }
});

// GET a single service order by ID
app.get('/api/serviceOrders/:id', async (req, res) => {
    const { id } = req.params;
    const userRole = req.query.role; // Get user role from query parameter

    try {
        // Explicitly cast products to text
        const result = await pool.query(`
            SELECT ${SERVICE_ORDER_COLUMNS_JOIN} 
            FROM service_orders so 
            LEFT JOIN converters c ON c.id = so.converterId 
            WHERE so.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Ordem de serviço não encontrada.' });
        }

        const serviceOrder = result.rows[0];

        // Security Check: Verify user role has permission to view this OS
        if (userRole === 'recepcao') {
            // Reception can see all orders
            return res.json(serviceOrder);
        } else if (userRole === 'grafica' && serviceOrder.sector === 'Grafica') {
            // 'grafica' role can only see orders for 'Grafica' sector
            return res.json(serviceOrder);
        } else if (userRole === 'impressao' && serviceOrder.sector === 'Impressao Digital') {
            // 'impressao' role can only see orders for 'Impressao Digital' sector
            return res.json(serviceOrder);
        } else {
            // If user does not have permission, act as if the order was not found
            return res.status(404).json({ message: 'Ordem de serviço não encontrada ou acesso não permitido.' });
        }

    } catch (err) {
        console.error('Erro ao buscar ordem de serviço:', err.stack);
        res.status(500).json({ message: 'Erro ao buscar ordem de serviço.' });
    }
});

// POST a new service order
app.post('/api/serviceOrders', async (req, res) => {
    const { osid, clientname, clientphone, osdate, description, status, products, discount, totalvalue, totaldue, sector, createdby } = req.body;
    const converterId = parseConverterId(req.body.converterid ?? req.body.converterId);
    
    if (!clientname || !clientphone) {
        return res.status(400).json({ message: 'Nome do cliente e celular são obrigatórios.' });
    }

    const productsJson = typeof products === 'string' ? products : JSON.stringify(products || []);
    let discountType = null;
    let discountValue = null;

    if (discount && typeof discount === 'object') {
        discountType = discount.type || null;
        discountValue = discount.value !== undefined ? discount.value : null;
    } else {
        discountType = req.body.discounttype !== undefined ? req.body.discounttype : (req.body.discountType !== undefined ? req.body.discountType : null);
        discountValue = req.body.discountvalue !== undefined ? req.body.discountvalue : (req.body.discountValue !== undefined ? req.body.discountValue : null);
    }

    // Helper for insert with automatic retry on duplicate osId
    async function insertOrder(idToUse, retryCount = 0) {
        try {
            const result = await pool.query(
                'INSERT INTO service_orders (osId, clientName, clientPhone, osDate, description, status, products, discountType, discountValue, totalValue, totalDue, sector, createdBy, converterId) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id',
                [idToUse, clientname, clientphone, toSqlDate(osdate), description, status, productsJson, discountType, discountValue, totalvalue, totaldue, sector, createdby, converterId]
            );
            return result.rows[0].id;
        } catch (err) {
            // Check for duplicate key violation (PostgreSQL code 23505)
            if (err.code === '23505' && retryCount < 5) {
                const generatedId = 'OS-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
                console.warn(`Aviso: osId duplicado detectado (${idToUse}). Gerando novo ID: ${generatedId}`);
                return insertOrder(generatedId, retryCount + 1);
            }
            throw err;
        }
    }

    try {
        console.log('Iniciando a inserção de nova OS no banco de dados...');
        const initialOsId = osid || ('OS-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000));
        const newOsId = await insertOrder(initialOsId);
        
        // Fetch the newly added OS to emit its full data, casting products to text
        const newOsResult = await pool.query(`
            SELECT ${SERVICE_ORDER_COLUMNS_JOIN} 
            FROM service_orders so 
            LEFT JOIN converters c ON c.id = so.converterId 
            WHERE so.id = $1
        `, [newOsId]);
        const newOs = newOsResult.rows[0];

        io.emit('newOS', newOs);
        console.log('Evento newOS emitido via Socket.IO.');

        res.status(201).json({ id: newOsId, osId: newOs.osid, message: 'Ordem de serviço adicionada com sucesso!' });
    } catch (err) {
        console.error('Erro ao adicionar ordem de serviço:', err.stack);
        res.status(500).json({ message: 'Erro ao adicionar ordem de serviço.', error: err.message });
    }
});

// PUT (update) an existing service order
app.put('/api/serviceOrders/:id', async (req, res) => {
    const { id } = req.params;
    const {
        osid,
        clientname,
        clientphone,
        osdate,
        description,
        status,
        products,
        discount,
        totalvalue,
        totaldue,
        sector,
        createdby,
        userrole,
        userRole,
        username,
        action
    } = req.body;
    
    const productsJson = typeof products === 'string' ? products : JSON.stringify(products || []);
    
    let discountType = null;
    let discountValue = null;
    if (discount && typeof discount === 'object') {
        discountType = discount.type || null;
        discountValue = discount.value !== undefined ? discount.value : null;
    } else {
        discountType = req.body.discounttype !== undefined ? req.body.discounttype : (req.body.discountType !== undefined ? req.body.discountType : null);
        discountValue = req.body.discountvalue !== undefined ? req.body.discountvalue : (req.body.discountValue !== undefined ? req.body.discountValue : null);
    }

    const normalizedUserRole = userrole || userRole;

    if (!clientname || !clientphone) {
        return res.status(400).json({ message: 'Nome do cliente e celular são obrigatórios.' });
    }

    let newTotalDue = totaldue !== undefined ? totaldue : 0;
    if ((status === 'Paga' || status === 'Entregue') && normalizedUserRole === 'recepcao') {
        newTotalDue = 0;
    }

    const hasConverterIdInBody = Object.prototype.hasOwnProperty.call(req.body, 'converterid')
        || Object.prototype.hasOwnProperty.call(req.body, 'converterId');
    let converterIdToSave = hasConverterIdInBody
        ? parseConverterId(req.body.converterid ?? req.body.converterId)
        : undefined;

    try {
        if (action === 'edit') {
            if (!username) {
                return res.status(400).json({ message: 'Usuário não informado para validar a edição da OS.' });
            }

            const userResult = await pool.query('SELECT role FROM users WHERE username = $1', [username]);

            if (userResult.rows.length === 0) {
                return res.status(403).json({ message: 'Usuário não encontrado.' });
            }

            const editorRole = userResult.rows[0].role;

            if (isRestrictedRecepcaoUser(username, editorRole)) {
                return res.status(403).json({ message: 'Este usuário não tem permissão para editar Ordens de Serviço.' });
            }
        }

        if (converterIdToSave === undefined) {
            const existingResult = await pool.query('SELECT converterId FROM service_orders WHERE id = $1', [id]);
            if (existingResult.rows.length === 0) {
                return res.status(404).json({ message: 'Ordem de serviço não encontrada.' });
            }
            converterIdToSave = parseConverterId(existingResult.rows[0].converterid);
        }

        const result = await pool.query(
            'UPDATE service_orders SET osId = $1, clientName = $2, clientPhone = $3, osDate = $4, description = $5, status = $6, products = $7, discountType = $8, discountValue = $9, totalValue = $10, totalDue = $11, sector = $12, createdBy = $13, converterId = $14 WHERE id = $15',
            [osid, clientname, clientphone, toSqlDate(osdate), description, status, productsJson, discountType, discountValue, totalvalue, newTotalDue, sector, createdby, converterIdToSave, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Ordem de serviço não encontrada.' });
        }
        res.json({ message: 'Ordem de serviço atualizada com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar ordem de serviço:', err.stack);
        res.status(500).json({ message: 'Erro ao atualizar ordem de serviço.', error: err.message });
    }
});

// DELETE a service order
app.delete('/api/serviceOrders/:id', async (req, res) => {
    const { id } = req.params;
    const { username } = req.body;

    try {
        // First, check user permissions
        const userResult = await pool.query('SELECT role FROM users WHERE username = $1', [username]);
        
        if (userResult.rows.length === 0) {
            return res.status(403).json({ message: 'Usuário não encontrado.' });
        }
        
        const deleterRole = userResult.rows[0].role;

        // Apply the security rule
        if (isRestrictedRecepcaoUser(username, deleterRole)) {
            return res.status(403).json({ message: 'Este usuário não tem permissão para remover Ordens de Serviço.' });
        }

        // If permission is granted, proceed to delete
        const result = await pool.query('DELETE FROM service_orders WHERE id = $1', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Ordem de serviço não encontrada.' });
        }
        
        res.json({ message: 'Ordem de serviço removida com sucesso!' });

    } catch (err) {
        console.error('Erro ao remover ordem de serviço:', err.stack);
        res.status(500).json({ message: 'Erro no servidor ao remover ordem de serviço.' });
    }
});

// GET all converters (active and inactive)
app.get('/api/converters', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM converters ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar revendedores:', err.stack);
        res.status(500).json({ message: 'Erro ao buscar revendedores.' });
    }
});

// GET a single converter by ID
app.get('/api/converters/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM converters WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Revendedor não encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao buscar revendedor:', err.stack);
        res.status(500).json({ message: 'Erro ao buscar revendedor.' });
    }
});

// POST a new converter
app.post('/api/converters', async (req, res) => {
    const { name, active, cep, address, number, complement, neighborhood, city, state, phone, email } = req.body;

    if (!name || !phone || !city) {
        return res.status(400).json({ message: 'Nome, Celular e Cidade são obrigatórios.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO converters (name, active, cep, address, number, complement, neighborhood, city, state, phone, email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
            [name, active, cep, address, number, complement, neighborhood, city, state, phone, email]
        );
        res.status(201).json({ id: result.rows[0].id, message: 'Revendedor registrado com sucesso!' });
    } catch (err) {
        console.error('Erro ao registrar revendedor:', err.stack);
        res.status(500).json({ message: 'Erro ao registrar revendedor.', error: err.message });
    }
});

// PUT (update) an existing converter
app.put('/api/converters/:id', async (req, res) => {
    const { id } = req.params;
    const { name, active, cep, address, number, complement, neighborhood, city, state, phone, email } = req.body;

    if (!name || !phone || !city) {
        return res.status(400).json({ message: 'Nome, Celular e Cidade são obrigatórios.' });
    }

    try {
        const result = await pool.query(
            'UPDATE converters SET name = $1, active = $2, cep = $3, address = $4, number = $5, complement = $6, neighborhood = $7, city = $8, state = $9, phone = $10, email = $11 WHERE id = $12',
            [name, active, cep, address, number, complement, neighborhood, city, state, phone, email, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Revendedor não encontrado.' });
        }
        res.json({ message: 'Revendedor atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar revendedor:', err.stack);
        res.status(500).json({ message: 'Erro ao atualizar revendedor.', error: err.message });
    }
});

// DELETE a converter
app.delete('/api/converters/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM converters WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Revendedor não encontrado.' });
        }
        res.json({ message: 'Revendedor removido com sucesso!' });
    } catch (err) {
        console.error('Erro ao remover revendedor:', err.stack);
        res.status(500).json({ message: 'Erro ao remover revendedor.' });
    }
});


httpServer.listen(backendPort, () => {
    console.log(`Backend server rodando na porta ${backendPort}`);
});
