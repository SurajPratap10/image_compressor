const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Use memory storage to avoid writing to disk
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();

// Serve frontend and optimized files
app.use(express.static('public'));
app.use('/optimized', express.static('optimized'));

// Ensure optimized directory exists
if (!fs.access('optimized').catch(() => fs.mkdir('optimized'))) {
  // No action needed, mkdir is handled by catch
}

// Helper function to process a single file
async function processFile(file, compressionLevel, outputFormat) {
  try {
    const outputPath = path.join('optimized', `${Date.now()}-${file.originalname.split('.')[0]}.${outputFormat}`);
    let sharpInstance = sharp(file.buffer); // Use buffer directly from memory

    // Apply compression based on level
    if (compressionLevel === 'best-quality') {
      sharpInstance = sharpInstance[outputFormat === 'png' ? 'png' : outputFormat === 'jpeg' ? 'jpeg' : 'webp']({
        quality: 80,
        compressionLevel: 6
      });
    } else if (compressionLevel === 'smallest-file') {
      sharpInstance = sharpInstance[outputFormat === 'png' ? 'png' : outputFormat === 'jpeg' ? 'jpeg' : 'webp']({
        quality: 50,
        compressionLevel: 9
      });
    } else if (outputFormat === 'svg') {
      // Fallback to PNG for now (SVG conversion needs additional library)
      outputPath = path.join('optimized', `${Date.now()}-${file.originalname.split('.')[0]}.png`);
      sharpInstance = sharpInstance.png({ quality: 80 });
    }

    // Write the processed image directly to the output file
    await sharpInstance.toFile(outputPath);

    return outputPath;
  } catch (err) {
    console.error(`Error processing ${file.originalname}: ${err.message}`);
    throw err;
  }
}

// Optimization and conversion endpoint
app.post('/optimize', upload.array('images'), async (req, res) => {
  const optimizedFiles = [];
  const compressionLevel = req.body.compressionLevel || 'best-quality';
  const outputFormat = req.body.outputFormat || 'png';

  try {
    // Process files sequentially to reduce contention
    for (const file of req.files) {
      const outputPath = await processFile(file, compressionLevel, outputFormat);
      optimizedFiles.push(outputPath);
    }

    res.json({ message: 'Processing complete!', files: optimizedFiles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));