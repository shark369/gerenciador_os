if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
const fs = require('fs');
const logStream = fs.createWriteStream('log.txt', { flags: 'a' });
console.log = function(d) {
  logStream.write(new Date().toISOString() + ': ' + d + '\n');
  process.stdout.write(new Date().toISOString() + ': ' + d + '\n');
};
console.error = console.log;

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const http = require('http'); // Import http module
const { Server } = require('socket.io'); // Import Server from socket.io
// const open = require('open'); // Import open
const path = require('path'); // Import path
const bcrypt = require('bcrypt'); // Import bcrypt
const saltRounds = 10; // for bcrypt

const app = express();
const backendPort = 3001;

const httpServer = http.createServer(app); // Create HTTP server
const io = new Server(httpServer, {
    cors: {
        origin: `http://localhost:${backendPort}`, // Allow frontend origin
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// MySQL Connection Pool
const pool = mysql.createPool({
    uri: process.env.DATABASE_URL, // Use the connection URL from .env
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test MySQL connection
/*
if (!process.env.DATABASE_URL) {
    console.error('ERRO CRÍTICO: A variável de ambiente DATABASE_URL não está definida.');
    process.exit(1);
}
console.log('Tentando conectar ao banco de dados...');
pool.getConnection()
    .then(connection => {
        console.log('Conexão com o banco de dados MySQL estabelecida com sucesso!');
        connection.release();
        // Create service_orders table if it doesn't exist
        return pool.execute(`
            CREATE TABLE IF NOT EXISTS service_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                osId VARCHAR(255) UNIQUE NOT NULL,
                clientName VARCHAR(255) NOT NULL,
                clientPhone VARCHAR(20), -- New column for phone number
                osDate DATE NOT NULL,
                description TEXT,
                status VARCHAR(50) NOT NULL,
                products JSON,
                discountType VARCHAR(50),
                discountValue DECIMAL(10, 2),
                totalValue DECIMAL(10, 2) NOT NULL,
                totalDue DECIMAL(10, 2) NOT NULL,
                sector VARCHAR(50), -- New column for sector
                createdBy VARCHAR(255), -- New column for user who created/saved the OS
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    })
    .then(() => {
        console.log('Tabela service_orders verificada/criada com sucesso.');
        // Use ALTER TABLE with IF NOT EXISTS to safely add columns.
        // Note: MySQL versions older than 8.0 do not support IF NOT EXISTS for ADD COLUMN.
        // Railway uses a modern version, so this is safe.
        const alterTableQueries = `
            ALTER TABLE service_orders 
            ADD COLUMN IF NOT EXISTS clientPhone VARCHAR(20) AFTER clientName,
            ADD COLUMN IF NOT EXISTS createdBy VARCHAR(255) AFTER sector;
        `;
        // We execute this as a raw query. We'll catch errors for older MySQL versions.
        return pool.query(alterTableQueries).catch(err => {
            console.log('Não foi possível executar ALTER TABLE com IF NOT EXISTS (pode ser uma versão antiga do MySQL). As colunas provavelmente já existem.');
        });
    })
    .then(() => {
        // Create users table
        return pool.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    })
    .then(() => {
        console.log('Tabela users verificada/criada com sucesso.');
        // Check if users table is empty
        return pool.execute('SELECT COUNT(*) as count FROM users');
    })
    .then(async ([rows]) => {
        if (rows[0].count === 0) {
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
                await pool.execute(
                    'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                    [user.username, hashedPassword, user.role]
                );
            }
            console.log('Tabela de usuários populada com sucesso.');
        }
    })
    .catch(err => {
        console.error('ERRO CRÍTICO NA INICIALIZAÇÃO DO BANCO DE DADOS:', err.stack);
    });
*/

// API Routes

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }

    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

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
    const userRole = req.query.role; // Get role from query parameter
    let query = 'SELECT * FROM service_orders';
    const params = [];

    if (userRole === 'grafica') {
        query += ' WHERE sector = ? AND status = ?';
        params.push('Grafica', 'Pendente');
    } else if (userRole === 'impressao') {
        query += ' WHERE sector = ? AND status = ?';
        params.push('Impressao Digital', 'Pendente');
    }
    // For recepcao, no additional filtering is applied here, as they see all.
    // If a 'status' query parameter is present for recepcao, it will be handled by frontend filtering in view_os_script.js.

    query += ' ORDER BY createdAt DESC';

    try {
        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar ordens de serviço:', err.stack);
        res.status(500).json({ message: 'Erro ao buscar ordens de serviço.' });
    }
});

// GET a single service order by ID
app.get('/api/serviceOrders/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM service_orders WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Ordem de serviรงo nรฃo encontrada.' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Erro ao buscar ordem de serviço:', err.stack);
        res.status(500).json({ message: 'Erro ao buscar ordem de serviço.' });
    }
});

// POST a new service order
app.post('/api/serviceOrders', async (req, res) => {
    const { osId, clientName, clientPhone, osDate, description, status, products, discount, totalValue, totalDue, sector, createdBy } = req.body;
    const productsJson = JSON.stringify(products);
    const discountType = discount ? discount.type : null;
    const discountValue = discount ? discount.value : null;

    if (!clientName || !clientPhone) {
        return res.status(400).json({ message: 'Nome do cliente e celular são obrigatórios.' });
    }

    try {

        const [result] = await pool.execute(
            'INSERT INTO service_orders (osId, clientName, clientPhone, osDate, description, status, products, discountType, discountValue, totalValue, totalDue, sector, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [osId, clientName, clientPhone, osDate, description, status, productsJson, discountType, discountValue, totalValue, totalDue, sector, createdBy]
        );
        const newOsId = result.insertId;
        // Fetch the newly added OS to emit its full data
        const [newOsRows] = await pool.execute('SELECT * FROM service_orders WHERE id = ?', [newOsId]);
        const newOs = newOsRows[0];

        io.emit('newOS', newOs); // Emit event to all connected clients

        res.status(201).json({ id: newOsId, message: 'Ordem de serviço adicionada com sucesso!' });
    } catch (err) {
        console.error('Erro ao adicionar ordem de serviço:', err.stack);
        res.status(500).json({ message: 'Erro ao adicionar ordem de serviço.', error: err.message });
    }
});

// PUT (update) an existing service order
app.put('/api/serviceOrders/:id', async (req, res) => {
    const { id } = req.params;
    const { osId, clientName, clientPhone, osDate, description, status, products, discount, totalValue, totalDue, sector, createdBy, userRole } = req.body;
    const productsJson = JSON.stringify(products);
    const discountType = discount ? discount.type : null;
    const discountValue = discount ? discount.value : null;

    if (!clientName || !clientPhone) {
        return res.status(400).json({ message: 'Nome do cliente e celular são obrigatórios.' });
    }

    // Security check for edit/remove permissions
    const [userRows] = await pool.execute('SELECT role FROM users WHERE username = ?', [createdBy]);
    const editorRole = userRows.length > 0 ? userRows[0].role : '';

    if ((createdBy === 'tarcio' || createdBy === 'safira') && editorRole === 'recepcao') {
        // Allow them to only change the status
        if (Object.keys(req.body).length > 2 || !req.body.status) { // a simple check
             return res.status(403).json({ message: 'Este usuário não tem permissão para editar a OS, apenas alterar o status.' });
        }
    }

    let newTotalDue = totalDue;
    // If status is changed to "Paga" by recepcao, zero out the totalDue
    if (status === 'Paga' && userRole === 'recepcao') {
        newTotalDue = 0;
    }

    try {
        const [result] = await pool.execute(
            'UPDATE service_orders SET osId = ?, clientName = ?, clientPhone = ?, osDate = ?, description = ?, status = ?, products = ?, discountType = ?, discountValue = ?, totalValue = ?, totalDue = ?, sector = ?, createdBy = ? WHERE id = ?',
            [osId, clientName, clientPhone, osDate, description, status, productsJson, discountType, discountValue, totalValue, newTotalDue, sector, createdBy, id]
        );
        if (result.affectedRows === 0) {
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
    const { username } = req.body; // Get username from request body for security check

    // Security check for delete permissions
    const [userRows] = await pool.execute('SELECT role FROM users WHERE username = ?', [username]);
    const deleterRole = userRows.length > 0 ? userRows[0].role : '';

    if ((username === 'tarcio' || username === 'safira') && deleterRole === 'recepcao') {
        return res.status(403).json({ message: 'Este usuário não tem permissão para remover Ordens de Serviço.' });
    }

    try {
        const [result] = await pool.execute('DELETE FROM service_orders WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Ordem de serviço não encontrada.' });
        }
        res.json({ message: 'Ordem de serviço removida com sucesso!' });
    } catch (err) {
        console.error('Erro ao remover ordem de serviço:', err.stack);
        res.status(500).json({ message: 'Erro ao remover ordem de serviço.' });
    }
});

httpServer.listen(backendPort, () => {
    const url = `http://localhost:${backendPort}`;
    console.log(`Backend server rodando em ${url}`);
    console.log('Funcionalidade de abrir navegador desativada para teste.');
    // Specify Chrome as the browser to open
    // open(url, {app: {name: 'chrome'}}).catch(err => {
    //     console.error('Não foi possível abrir o Chrome. Tente abrir o endereço manualmente:', url);
    //     console.error(err);
    // });
});
