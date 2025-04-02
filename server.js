import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { createServer as createHttpServer } from 'http';
import Replicate from 'replicate';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Environment setup logging
console.log('\n=== Environment Setup ===');
console.log('NODE_ENV:', chalk.cyan(process.env.NODE_ENV || 'development'));
console.log('VITE_REPLICATE_API_TOKEN:', chalk.cyan(process.env.VITE_REPLICATE_API_TOKEN ? '✓ Present' : '✗ Missing'));

const REPLICATE_API_TOKEN = process.env.VITE_REPLICATE_API_TOKEN;

if (!REPLICATE_API_TOKEN) {
  console.error(chalk.red('\n❌ Error: Missing Replicate API token'));
  process.exit(1);
}

// Initialize Replicate client
console.log('\n=== Initializing Replicate Client ===');
const replicate = new Replicate({
  auth: REPLICATE_API_TOKEN,
});
console.log(chalk.green('✓ Replicate client initialized'));

// Proxy endpoint for Replicate API
app.post('/api/replicate/predictions', async (req, res) => {
  console.log(chalk.blue('\n=== Creating Prediction ==='));
  console.log('Request body:', chalk.gray(JSON.stringify(req.body, null, 2)));
  
  try {
    console.log(chalk.yellow('Making request to Replicate API...'));
    const output = await replicate.run(
      "vwtyler/ocr-pdf:58ec1f1841086ea5328423edc70a0130eb680ffbc8dec4cf8915fc76eee235ef",
      {
        input: {
          url: req.body.input.pdf
        }
      }
    );

    console.log(chalk.green('✓ Replicate API request successful'));
    console.log('Response:', chalk.gray(JSON.stringify(output, null, 2)));
    res.json({ status: 'succeeded', output });
  } catch (error) {
    console.error(chalk.red('❌ Replicate API Error:'), error);
    res.status(500).json({ error: 'Failed to create prediction', details: error.message });
  }
});

// Test endpoint to verify server is running
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    replicate: {
      initialized: true,
      token: '✓ Present'
    }
  });
});

async function startServer() {
  try {
    console.log('\n=== Starting Servers ===');
    
    // Create Vite server in middleware mode
    console.log(chalk.yellow('Initializing Vite server...'));
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    console.log(chalk.green('✓ Vite server initialized'));

    // Use Vite's middleware
    app.use(vite.middlewares);
    
    // Create HTTP server
    const httpServer = createHttpServer(app);

    const port = process.env.PORT || 5173;
    httpServer.listen(port, () => {
      console.log(chalk.green(`\n✨ Server running at ${chalk.blue(`http://localhost:${port}`)}`));
      console.log(chalk.green(`Health check available at ${chalk.blue(`http://localhost:${port}/api/health`)}`));
      console.log(chalk.gray('\nPress Ctrl+C to stop the server\n'));
    });

  } catch (error) {
    console.error(chalk.red('\n❌ Failed to start server:'), error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  console.error(chalk.red('\n❌ Unhandled error:'), error);
  process.exit(1);
});