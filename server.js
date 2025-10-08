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

const app = express();
const backendPort = 3001;

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: `http://localhost:${backendPort}`,
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

app.use(express.static(__dirname));

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

console.log('Tentando conectar ao banco de dados PostgreSQL...');
pool.connect()
    .then(client => {
        console.log('Conexão com o banco de dados PostgreSQL estabelecida com sucesso!');
        
        // Create service_orders table
        client.query(`
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
        `)
        .then(() => {
            console.log('Tabela service_orders verificada/criada com sucesso.');
            // Create users table
            return client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);
        })
        .then(() => {
            console.log('Tabela service_orders verificada/criada com sucesso.');
            // Create converters table
            return client.query(`
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
        })
        .then(() => {
            console.log('Tabela converters verificada/criada com sucesso.');
            // Create users table
            return client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);
        })
        .then(() => {
            console.log('Tabela users verificada/criada com sucesso.');
            // Check if users table is empty
            return client.query('SELECT COUNT(*) as count FROM users');
        })
        .then(async (result) => {
            if (result.rows[0].count == 0) {
                console.log('Populando tabela de usuários...');
                const users = [
                    { username: 'jacira', password: '123', role: 'recepcao' },
                    { username: 'tarcio', password: '123', role: 'recepcao' },
                    { username: 'safira', password: '123', role: 'recepcao' },
                    { username: 'grafica', password: '123', role: 'grafica' },
                    { username: 'impressao', password: '123', role: 'impressao' }
                ];

                for (const user of users) {
                    const hashedPassword = await bcrypt.hash(user.password, saltRounds);
                    await client.query(
                        'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                        [user.username, hashedPassword, user.role]
                    );
                }
                console.log('Tabela de usuários populada com sucesso.');
            }
        })
        .catch(err => {
            console.error('ERRO CRÍTICO NA INICIALIZAÇÃO DO BANCO DE DADOS:', err.stack);
        })
        .finally(() => {
            client.release(); // Release the client back to the pool
        });
    })
    .catch(err => {
        console.error('ERRO CRÍTICO AO CONECTAR AO BANCO DE DADOS:', err.stack);
    });


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

// GET all service orders
app.get('/api/serviceOrders', async (req, res) => {
    const userRole = req.query.role;
    // Explicitly cast products to text to avoid issues with JSONB type in pg driver
    let query = 'SELECT id, osId, clientName, clientPhone, osDate, description, status, products::text, discountType, discountValue, totalValue, totalDue, sector, createdBy, createdAt FROM service_orders';
    const params = [];

    if (userRole === 'grafica') {
        query += ' WHERE sector = $1 AND status = $2';
        params.push('Grafica', 'Pendente');
    } else if (userRole === 'impressao') {
        query += ' WHERE sector = $1 AND status = $2';
        params.push('Impressao Digital', 'Pendente');
    }

    query += ' ORDER BY createdAt DESC';

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar ordens de serviço:', err.stack);
        res.status(500).json({ message: 'Erro ao buscar ordens de serviço.' });
    }
});

// GET a single service order by ID
app.get('/api/serviceOrders/:id', async (req, res) => {
    const { id } = req.params;
    const userRole = req.query.role; // Get user role from query parameter

    try {
        // Explicitly cast products to text
        const result = await pool.query('SELECT id, osId, clientName, clientPhone, osDate, description, status, products::text, discountType, discountValue, totalValue, totalDue, sector, createdBy, createdAt FROM service_orders WHERE id = $1', [id]);
        
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
    const productsJson = JSON.stringify(products); // Must stringify for pg driver
    const discountType = discount ? discount.type : null;
    const discountValue = discount ? discount.value : null;

    if (!clientname || !clientphone) {
        return res.status(400).json({ message: 'Nome do cliente e celular são obrigatórios.' });
    }

    try {
        console.log('Iniciando a inserção de nova OS no banco de dados...');
        const result = await pool.query(
            'INSERT INTO service_orders (osId, clientName, clientPhone, osDate, description, status, products, discountType, discountValue, totalValue, totalDue, sector, createdBy) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id',
            [osid, clientname, clientphone, osdate, description, status, productsJson, discountType, discountValue, totalvalue, totaldue, sector, createdby]
        );
        const newOsId = result.rows[0].id;
        
        // Fetch the newly added OS to emit its full data, casting products to text
        const newOsResult = await pool.query('SELECT id, osId, clientName, clientPhone, osDate, description, status, products::text, discountType, discountValue, totalValue, totalDue, sector, createdBy, createdAt FROM service_orders WHERE id = $1', [newOsId]);
        const newOs = newOsResult.rows[0];

        io.emit('newOS', newOs);
        console.log('Evento newOS emitido via Socket.IO.');

        res.status(201).json({ id: newOsId, message: 'Ordem de serviço adicionada com sucesso!' });
    } catch (err) {
        console.error('Erro ao adicionar ordem de serviço:', err.stack);
        res.status(500).json({ message: 'Erro ao adicionar ordem de serviço.', error: err.message });
    }
});

// PUT (update) an existing service order
app.put('/api/serviceOrders/:id', async (req, res) => {
    const { id } = req.params;
    const { osid, clientname, clientphone, osdate, description, status, products, discount, totalvalue, totaldue, sector, createdby, userrole } = req.body;
    const productsJson = JSON.stringify(products); // Must stringify for pg driver
    const discountType = discount ? discount.type : null;
    const discountValue = discount ? discount.value : null;

    if (!clientname || !clientphone) {
        return res.status(400).json({ message: 'Nome do cliente e celular são obrigatórios.' });
    }

    // Security check to prevent tarcio and safira from editing
    if (createdby === 'tarcio' || createdby === 'safira') {
        return res.status(403).json({ message: 'Este usuário não tem permissão para editar Ordens de Serviço.' });
    }

    let newTotalDue = totaldue;
    if (status === 'Paga' && userrole === 'recepcao') {
        newTotalDue = 0;
    }

    try {
        const result = await pool.query(
            'UPDATE service_orders SET osId = $1, clientName = $2, clientPhone = $3, osDate = $4, description = $5, status = $6, products = $7, discountType = $8, discountValue = $9, totalValue = $10, totalDue = $11, sector = $12, createdBy = $13 WHERE id = $14',
            [osid, clientname, clientphone, osdate, description, status, productsJson, discountType, discountValue, totalvalue, newTotalDue, sector, createdby, id]
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

    const userResult = await pool.query('SELECT role FROM users WHERE username = $1', [username]);
    const deleterRole = userResult.rows.length > 0 ? userResult.rows[0].role : '';

    if ((username === 'tarcio' || username === 'safira') && deleterRole === 'recepcao') {
        return res.status(403).json({ message: 'Este usuário não tem permissão para remover Ordens de Serviço.' });
    }

    try {
        const result = await pool.query('DELETE FROM service_orders WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Ordem de serviço não encontrada.' });
        }
        res.json({ message: 'Ordem de serviço removida com sucesso!' });
    } catch (err) {
        console.error('Erro ao remover ordem de serviço:', err.stack);
        res.status(500).json({ message: 'Erro ao remover ordem de serviço.' });
    }
});

// POST a new converter
app.post('/api/converters', async (req, res) => {
    const { name, active, cep, address, number, complement, neighborhood, city, state, phone, email } = req.body;

    if (!name || !phone || !email) {
        return res.status(400).json({ message: 'Nome, Celular e Email são obrigatórios.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO converters (name, active, cep, address, number, complement, neighborhood, city, state, phone, email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
            [name, active, cep, address, number, complement, neighborhood, city, state, phone, email]
        );
        res.status(201).json({ id: result.rows[0].id, message: 'Convertedor registrado com sucesso!' });
    } catch (err) {
        console.error('Erro ao registrar convertedor:', err.stack);
        res.status(500).json({ message: 'Erro ao registrar convertedor.', error: err.message });
    }
});


httpServer.listen(backendPort, () => {
    const url = `http://localhost:${backendPort}`;
    console.log(`Backend server rodando em ${url}`);
    console.log('Funcionalidade de abrir navegador desativada para teste.');
});
