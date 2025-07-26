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
    host: 'localhost', // Replace with your MySQL host
    user: 'root',      // Replace with your MySQL username
    password: 'Shark@9919', // Replace with your MySQL password
    database: 'gerenciador_os_db', // Replace with your database name
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test MySQL connection
pool.getConnection()
    .then(connection => {
        console.log('Conectado ao banco de dados MySQL!');
        connection.release();
        // Create service_orders table if it doesn't exist
        return pool.execute(`
            CREATE TABLE IF NOT EXISTS service_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                osId VARCHAR(255) UNIQUE NOT NULL,
                clientName VARCHAR(255) NOT NULL,
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
        // Check if the 'createdBy' column exists
        return pool.execute(`
            SELECT * FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = 'gerenciador_os_db'
            AND TABLE_NAME = 'service_orders'
            AND COLUMN_NAME = 'createdBy'
        `);
    })
    .then(([rows]) => {
        if (rows.length === 0) {
            // The 'createdBy' column doesn't exist, so add it
            return pool.execute(`
                ALTER TABLE service_orders
                ADD COLUMN createdBy VARCHAR(255) AFTER sector
            `).then(() => {
                console.log('Coluna createdBy adicionada com sucesso.');
            }).catch(addColumnErr => {
                console.error('Erro ao adicionar coluna createdBy:', addColumnErr);
            });
        } else {
            console.log('Coluna createdBy já existe.');
        }
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
        console.error('Erro na inicialização do banco de dados:', err);
    });

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
        console.error('Erro no login:', err);
        res.status(500).json({ message: 'Erro interno no servidor.' });
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
        console.error('Erro ao buscar ordens de serviço:', err);
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
        console.error('Erro ao buscar ordem de serviรงo:', err);
        res.status(500).json({ message: 'Erro ao buscar ordem de serviรงo.' });
    }
});

// POST a new service order
app.post('/api/serviceOrders', async (req, res) => {
    const { osId, clientName, osDate, description, status, products, discount, totalValue, totalDue, sector, createdBy } = req.body; // Added totalDue, sector, and createdBy
    const productsJson = JSON.stringify(products);
    const discountType = discount ? discount.type : null;
    const discountValue = discount ? discount.value : null;

    try {

        const [result] = await pool.execute(
            'INSERT INTO service_orders (osId, clientName, osDate, description, status, products, discountType, discountValue, totalValue, totalDue, sector, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', // Added createdBy column
            [osId, clientName, osDate, description, status, productsJson, discountType, discountValue, totalValue, totalDue, sector, createdBy] // Added createdBy value
        );
        const newOsId = result.insertId;
        // Fetch the newly added OS to emit its full data
        const [newOsRows] = await pool.execute('SELECT * FROM service_orders WHERE id = ?', [newOsId]);
        const newOs = newOsRows[0];

        io.emit('newOS', newOs); // Emit event to all connected clients

        res.status(201).json({ id: newOsId, message: 'Ordem de serviço adicionada com sucesso!' });
    } catch (err) {
        console.error('Erro ao adicionar ordem de serviço:', err);
        res.status(500).json({ message: 'Erro ao adicionar ordem de serviço.', error: err.message });
    }
});

// PUT (update) an existing service order
app.put('/api/serviceOrders/:id', async (req, res) => {
    const { id } = req.params;
    const { osId, clientName, osDate, description, status, products, discount, totalValue, totalDue, sector, createdBy } = req.body; // Added totalDue, sector, and createdBy
    const productsJson = JSON.stringify(products);
    const discountType = discount ? discount.type : null;
    const discountValue = discount ? discount.value : null;

    try {
        const [result] = await pool.execute(
            'UPDATE service_orders SET osId = ?, clientName = ?, osDate = ?, description = ?, status = ?, products = ?, discountType = ?, discountValue = ?, totalValue = ?, totalDue = ?, sector = ?, createdBy = ? WHERE id = ?', // Added createdBy column
            [osId, clientName, osDate, description, status, productsJson, discountType, discountValue, totalValue, totalDue, sector, createdBy, id] // Added createdBy value
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Ordem de serviรงo nรฃo encontrada.' });
        }
        res.json({ message: 'Ordem de serviรงo atualizada com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar ordem de serviço:', err);
        res.status(500).json({ message: 'Erro ao atualizar ordem de serviço.', error: err.message });
    }
});

// DELETE a service order
app.delete('/api/serviceOrders/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.execute('DELETE FROM service_orders WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Ordem de serviรงo nรฃo encontrada.' });
        }
        res.json({ message: 'Ordem de serviรงo removida com sucesso!' });
    } catch (err) {
        console.error('Erro ao remover ordem de serviรงo:', err);
        res.status(500).json({ message: 'Erro ao remover ordem de serviรงo.' });
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
