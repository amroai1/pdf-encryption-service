require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const app = express();
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

const PORT = parseInt(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || './data';

app.use(cors());
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    useTempFiles: true,
    tempFileDir: DATA_DIR
}));
app.use(express.static('public'));
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'pdf-encryption' });
});

app.post('/upload', async function (req, res) {
    let tempPath = null;
    let encryptedPath = null;

    try {
        const pdfFile = req.files?.pdf;
        const password = req.body?.password;
        const filename = req.body?.filename;

        if (!pdfFile) {
            return res.status(400).json({ error: 'No PDF file provided' });
        }

        if (!password) {
            return res.status(400).json({ error: 'No password provided' });
        }

        const uniqueId = uuidv4();
        tempPath = path.join(DATA_DIR, `${uniqueId}.pdf`);
        encryptedPath = path.join(DATA_DIR, `${uniqueId}.encrypted.pdf`);

        await pdfFile.mv(tempPath);

        const qpdfCommand = `qpdf --encrypt "${password}" "${password}" 256 --accessibility=n --extract=n --print=none --modify=none -- "${tempPath}" "${encryptedPath}"`;

        await new Promise((resolve, reject) => {
            exec(qpdfCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('qpdf error:', stderr);
                    reject(new Error(`Encryption failed: ${stderr || error.message}`));
                } else {
                    resolve();
                }
            });
        });

        const returnBase64 = req.body?.return_base64 === 'true' || req.headers['accept'] === 'application/json';

        if (returnBase64) {
            const encryptedBuffer = await fs.readFile(encryptedPath);
            const base64Pdf = encryptedBuffer.toString('base64');

            await fs.unlink(tempPath).catch(console.error);
            await fs.unlink(encryptedPath).catch(console.error);

            return res.json({
                base64: base64Pdf,
                filename: filename || pdfFile.name.replace('.pdf', '.encrypted.pdf')
            });
        } else {
            const downloadName = filename || pdfFile.name.replace('.pdf', '.encrypted.pdf');
            
            res.download(encryptedPath, downloadName, async (error) => {
                if (error) {
                    console.error('Download error:', error);
                }
                await fs.unlink(tempPath).catch(console.error);
                await fs.unlink(encryptedPath).catch(console.error);
            });
        }

    } catch (error) {
        console.error('Error:', error);

        if (tempPath) await fs.unlink(tempPath).catch(() => {});
        if (encryptedPath) await fs.unlink(encryptedPath).catch(() => {});

        res.status(500).json({ error: error.message });
    }
});

app.get('/upload', (req, res) => {
    return res.redirect('/');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`PDF encryption service running on port ${PORT}`);
});